from fastapi import APIRouter, Depends, HTTPException, File, UploadFile
from sqlalchemy.orm import Session
import models, schemas, json, random, shutil
from datetime import datetime
from core import get_db, get_current_user, manager, calculate_haversine, check_same_direction, driver_ready_states, driver_locations

router = APIRouter(tags=["Orders & Logistics"])

# ==========================================================
# [MỚI] API LƯU TỌA ĐỘ TÀI XẾ (Cập nhật mỗi 5 giây)
# ==========================================================
@router.put("/driver/{user_id}/location")
async def update_driver_location(user_id: int, lat: float, lng: float):
    driver_locations[user_id] = {"lat": lat, "lng": lng, "updated_at": datetime.now()}
    return {"message": "Location updated"}

@router.put("/driver/{user_id}/toggle_ready")
async def toggle_driver_ready(user_id: int, is_ready: bool):
    driver_ready_states[user_id] = is_ready
    return {"message": "Success", "is_ready": is_ready}

@router.post("/orders")
async def create_order(order: schemas.OrderCreate, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    total_p = order.total_price if hasattr(order, 'total_price') and order.total_price > 0 else order.original_price
    discount = getattr(order, 'discount_amount', 0.0)
    real_total_without_discount = total_p + discount
    extra_fees_amount = real_total_without_discount - order.original_price
    default_payout = (order.original_price * 0.8) + extra_fees_amount
    
    if getattr(order, 'promo_id', None):
        promo = db.query(models.Promotion).filter(models.Promotion.id == order.promo_id).first()
        if promo and promo.usage_limit is not None and promo.usage_limit > 0: promo.usage_limit -= 1
    
    new_order = models.Order(
        customer_id=order.customer_id, pickup_address_id=order.pickup_address_id, dropoff_address_id=order.dropoff_address_id, 
        promo_id=getattr(order, 'promo_id', None), package_details=order.package_details, original_price=order.original_price, 
        final_price=total_p, current_status="pending", driver_payout=default_payout, 
        payment_method=getattr(order, 'payment_method', 'cash'), cod_amount=getattr(order, 'cod_amount', 0.0), extra_fees=getattr(order, 'extra_fees', None) 
    )
    db.add(new_order); db.commit(); db.refresh(new_order)
    db.add(models.OrderStatusHistory(order_id=new_order.id, status="pending", changed_by=current_user["user_id"]))
    db.commit()
    
    pickup_addr = db.query(models.Address).filter(models.Address.id == new_order.pickup_address_id).first()
    dropoff_addr = db.query(models.Address).filter(models.Address.id == new_order.dropoff_address_id).first()
    
    is_express = "GIAO NHANH" in (new_order.package_details or "")
    batch_formed, p_order_payout, assigned_driver_id = False, 0, None
    
    if is_express and pickup_addr and dropoff_addr:
        candidate_orders = db.query(models.Order).filter(models.Order.current_status.in_(["pending", "accepted", "arrived_pickup", "picking_up"]), models.Order.id != new_order.id, models.Order.batch_id.is_(None), models.Order.package_details.like("%GIAO NHANH%")).all()
        for p_order in candidate_orders:
            p_pickup = db.query(models.Address).filter(models.Address.id == p_order.pickup_address_id).first()
            p_dropoff = db.query(models.Address).filter(models.Address.id == p_order.dropoff_address_id).first()
            if p_pickup and p_dropoff and calculate_haversine(pickup_addr.latitude, pickup_addr.longitude, p_pickup.latitude, p_pickup.longitude) <= 2.0 and calculate_haversine(dropoff_addr.latitude, dropoff_addr.longitude, p_dropoff.latitude, p_dropoff.longitude) <= 2.0:
                if check_same_direction(pickup_addr.latitude, pickup_addr.longitude, dropoff_addr.latitude, dropoff_addr.longitude, p_pickup.latitude, p_pickup.longitude, p_dropoff.latitude, p_dropoff.longitude):
                    if p_order.driver_id and not driver_ready_states.get(p_order.driver_id, True): continue 
                    batch_code = f"BATCH_{p_order.id}_{new_order.id}"
                    p_order.batch_id = batch_code; new_order.batch_id = batch_code
                    p_order.driver_payout = (p_order.original_price * 0.65) + (p_order.final_price - p_order.original_price)
                    new_order.driver_payout = (new_order.original_price * 0.65) + (new_order.final_price - new_order.original_price)
                    p_order_payout = p_order.driver_payout
                    if p_order.driver_id:
                        assigned_driver_id = p_order.driver_id; new_order.driver_id = assigned_driver_id; new_order.current_status = "accepted" 
                        db.add(models.OrderStatusHistory(order_id=new_order.id, status="accepted", changed_by=current_user["user_id"], note="Gán ghép tự động cùng chiều"))
                    db.commit(); batch_formed = True; break 
                    
    target_role = "driver_express" if "GIAO NHANH" in (new_order.package_details or "") else "driver_container"
    online_drivers = [uid for uid, (ws, role) in manager.active_connections.items() if role == target_role and driver_ready_states.get(uid, True)]
    
    # ==========================================================
    # [MỚI] THUẬT TOÁN QUÉT TÀI XẾ TRONG BÁN KÍNH 3KM
    # ==========================================================
    nearby_drivers = []
    for uid in online_drivers:
        if uid in driver_locations:
            dist = calculate_haversine(pickup_addr.latitude, pickup_addr.longitude, driver_locations[uid]["lat"], driver_locations[uid]["lng"])
            if dist <= 3.0: 
                nearby_drivers.append(uid)

    # Ưu tiên tài xế ở gần (dưới 3km), nếu không có ai thì lấy toàn hệ thống
    dispatch_pool = nearby_drivers if nearby_drivers else online_drivers

    if batch_formed and assigned_driver_id:
        payload = {"event": "urgent_order_alert", "order": {"id": new_order.id, "pickup": pickup_addr.address_text if pickup_addr else "Chưa rõ", "dropoff": dropoff_addr.address_text if dropoff_addr else "Chưa rõ", "price": new_order.driver_payout / 0.8, "details": (new_order.package_details or "") + " [HỆ THỐNG VỪA ÉP THÊM ĐƠN!]"}}
        if assigned_driver_id in manager.active_connections: 
            await manager.send_personal_message(json.dumps(payload), assigned_driver_id)
            
    elif dispatch_pool:
        # [ĐÃ SỬA] Bắn Popup cho TẤT CẢ tài xế online gần đó thay vì chỉ 1 người random
        payload = {"event": "urgent_order_alert", "order": {"id": new_order.id, "pickup": pickup_addr.address_text if pickup_addr else "Chưa rõ", "dropoff": dropoff_addr.address_text if dropoff_addr else "Chưa rõ", "price": (new_order.driver_payout + (p_order_payout if batch_formed else 0)) / 0.8, "details": (new_order.package_details or "") + (" [GHÉP 2 ĐƠN!]" if batch_formed else "")}}
        for uid in dispatch_pool:
            await manager.send_personal_message(json.dumps(payload), uid)
        
    # [ĐÃ SỬA] Luôn phát sóng "status_changed" để Admin và mọi người tải lại bảng dữ liệu mới
    await manager.broadcast(json.dumps({"event": "status_changed"}))
    return {"message": "Tạo đơn thành công!", "is_batched": batch_formed}

@router.get("/orders/pending")
def get_pending_orders(db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    query = db.query(models.Order).filter(models.Order.current_status == "pending")
    if current_user["role"] == "driver_express": query = query.filter(models.Order.package_details.like("%GIAO NHANH%"))
    elif current_user["role"] == "driver_container": query = query.filter(models.Order.package_details.like("%CONTAINER%"))
    orders = query.all(); result = []; processed_batches = set()
    for o in orders:
        pickup = db.query(models.Address).filter(models.Address.id == o.pickup_address_id).first()
        dropoff = db.query(models.Address).filter(models.Address.id == o.dropoff_address_id).first()
        o_dict = o.__dict__.copy(); o_dict["pickup_location"] = pickup.address_text if pickup else ""; o_dict["dropoff_location"] = dropoff.address_text if dropoff else ""
        if o.batch_id:
            if o.batch_id in processed_batches: continue 
            processed_batches.add(o.batch_id)
            batch_orders = db.query(models.Order).filter(models.Order.batch_id == o.batch_id).all()
            o_dict["price"] = sum(bo.driver_payout for bo in batch_orders) / 0.8 
            o_dict["package_details"] = (o.package_details or "") + " [ĐƠN GHÉP BATCH]"
        else: o_dict["price"] = (o.driver_payout if o.driver_payout else (o.final_price * 0.8)) / 0.8
        result.append(o_dict)
    return result

@router.put("/orders/{order_id}/accept")
async def accept_order(order_id: int, driver_id: int, db: Session = Depends(get_db)):
    order = db.query(models.Order).filter(models.Order.id == order_id).first()
    if not order: raise HTTPException(400, "Đơn không hợp lệ!")
    if order.current_status in ["accepted", "arrived_pickup", "picking_up"] and order.driver_id == driver_id: return {"message": "Đã nhận thông báo chuyến ghép!"}
    if order.current_status != "pending": raise HTTPException(400, "Đơn đã bị người khác nhận!")
    batch_orders = db.query(models.Order).filter(models.Order.batch_id == order.batch_id).all() if order.batch_id else [order]
    driver = db.query(models.User).filter(models.User.id == driver_id).first()
    total_commission = sum(o.final_price - (o.driver_payout or (o.final_price * 0.8)) for o in batch_orders)
    if driver.balance < total_commission: raise HTTPException(400, f"Số dư ví không đủ! Cần tối thiểu {total_commission:,.0f}đ.")
    for o in batch_orders:
        o.driver_id = driver_id; o.current_status = "accepted"
        db.add(models.OrderStatusHistory(order_id=o.id, status="accepted", changed_by=driver_id))
    db.commit()
    await manager.broadcast(json.dumps({"event": "status_changed"}))
    return {"message": "Nhận cuốc thành công!"}

# ==========================================================
# [MỚI] API CHỤP ẢNH LÚC LẤY HÀNG (PICKUP POD)
# ==========================================================
@router.post("/orders/{order_id}/pickup_with_pod")
async def pickup_order_with_pod(order_id: int, file: UploadFile = File(...), db: Session = Depends(get_db)):
    order = db.query(models.Order).filter(models.Order.id == order_id).first()
    if not order: raise HTTPException(404)
    file_ext = file.filename.split(".")[-1]
    file_location = f"static/pods/pickup_{order_id}_{datetime.now().strftime('%Y%m%d%H%M%S')}.{file_ext}"
    with open(file_location, "wb+") as f: shutil.copyfileobj(file.file, f)
    
    try: order.pickup_image_url = f"https://datquang-backend.onrender.com/{file_location}"
    except: pass # Phòng hờ user chưa thêm cột trong models.py
    
    order.current_status = "picking_up"
    db.add(models.OrderStatusHistory(order_id=order.id, status="picking_up", changed_by=order.driver_id, note="Có ảnh lấy hàng"))
    db.commit()
    await manager.broadcast(json.dumps({"event": "status_changed"}))
    return {"message": "Thành công"}

@router.post("/orders/{order_id}/complete_with_pod")
async def complete_order_with_pod(order_id: int, file: UploadFile = File(...), db: Session = Depends(get_db)):
    order = db.query(models.Order).filter(models.Order.id == order_id).first()
    if not order: raise HTTPException(404)
    file_ext = file.filename.split(".")[-1]
    file_location = f"static/pods/dropoff_{order_id}_{datetime.now().strftime('%Y%m%d%H%M%S')}.{file_ext}"
    with open(file_location, "wb+") as f: shutil.copyfileobj(file.file, f)
    order.proof_image_url = f"https://datquang-backend.onrender.com/{file_location}"
    if order.current_status != "completed":
        driver = db.query(models.User).filter(models.User.id == order.driver_id).first()
        payout = order.driver_payout or (order.final_price * 0.8); commission = order.final_price - payout
        if order.payment_method == "bank": driver.balance += payout; db.add(models.Payment(user_id=driver.id, order_id=order.id, amount=payout, type="income", method="wallet", status="success"))
        else: driver.balance -= commission; db.add(models.Payment(user_id=driver.id, order_id=order.id, amount=commission, type="deduction", method="wallet", status="success"))
        order.current_status = "completed"
        db.add(models.OrderStatusHistory(order_id=order.id, status="completed", changed_by=driver.id))
    db.commit()
    await manager.broadcast(json.dumps({"event": "status_changed"}))
    await manager.broadcast(json.dumps({"event": "balance_changed"}))
    return {"message": "Thành công"}

@router.put("/orders/{order_id}/status")
async def update_order_status(order_id: int, status: str, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    order = db.query(models.Order).filter(models.Order.id == order_id).first()
    order.current_status = status
    db.add(models.OrderStatusHistory(order_id=order.id, status=status, changed_by=current_user["user_id"]))
    db.commit()
    await manager.broadcast(json.dumps({"event": "status_changed"}))
    return {"message": "Thành công!"}

@router.put("/orders/{order_id}/driver_cancel")
async def driver_cancel_order(order_id: int, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    order = db.query(models.Order).filter(models.Order.id == order_id).first()
    order.driver_id = None; order.current_status = "pending"
    db.add(models.OrderStatusHistory(order_id=order.id, status="driver_cancelled", changed_by=current_user["user_id"], note="Nhả cuốc"))
    db.commit()
    await manager.broadcast(json.dumps({"event": "status_changed"}))
    return {"message": "Thành công!"}

@router.get("/users/{user_id}/orders/customer")
def get_customer_order_history(user_id: int, db: Session = Depends(get_db)):
    return [ {**o.__dict__, "status": o.current_status} for o in db.query(models.Order).filter(models.Order.customer_id == user_id).order_by(models.Order.id.desc()).all() ]

@router.get("/users/{user_id}/orders/driver")
def get_driver_order_history(user_id: int, db: Session = Depends(get_db)):
    return {"order_history": [ {**o.__dict__, "status": o.current_status} for o in db.query(models.Order).filter(models.Order.driver_id == user_id).order_by(models.Order.id.desc()).all() ]}

@router.get("/orders/{order_id}/details")
def get_order_details(order_id: int, db: Session = Depends(get_db)):
    order = db.query(models.Order).filter(models.Order.id == order_id).first()
    if not order: raise HTTPException(404)
    driver = db.query(models.User).filter(models.User.id == order.driver_id).first() if order.driver_id else None
    customer = db.query(models.User).filter(models.User.id == order.customer_id).first()
    pickup = db.query(models.Address).filter(models.Address.id == order.pickup_address_id).first()
    dropoff = db.query(models.Address).filter(models.Address.id == order.dropoff_address_id).first()
    review = db.query(models.Review).filter(models.Review.order_id == order_id).first()
    
    order_data = order.__dict__.copy()
    order_data["pickup_location"] = pickup.address_text if pickup else ""
    order_data["pickup_lat"] = pickup.latitude if pickup else 0
    order_data["pickup_lng"] = pickup.longitude if pickup else 0
    
    order_data["dropoff_location"] = dropoff.address_text if dropoff else ""
    order_data["dropoff_lat"] = dropoff.latitude if dropoff else 0
    order_data["dropoff_lng"] = dropoff.longitude if dropoff else 0
    
    order_data["price"] = order.final_price; order_data["status"] = order.current_status
    order_data["rating"] = review.rating if review else None; order_data["feedback"] = review.feedback if review else None
    order_data["batch_id"] = order.batch_id; order_data["payment_method"] = order.payment_method; order_data["cod_amount"] = order.cod_amount
    order_data["pickup_image_url"] = getattr(order, 'pickup_image_url', None)

    return {"order": order_data, "driver": {"name": driver.name, "phone": driver.phone, "avatar_url": driver.avatar_url} if driver else None, "customer": {"name": customer.name, "phone": customer.phone, "avatar_url": customer.avatar_url}}

@router.get("/orders/batch/{batch_id}/details")
def get_batch_details(batch_id: str, db: Session = Depends(get_db)):
    orders = db.query(models.Order).filter(models.Order.batch_id == batch_id).order_by(models.Order.id.asc()).all()
    result = []
    for o in orders:
        pickup = db.query(models.Address).filter(models.Address.id == o.pickup_address_id).first()
        dropoff = db.query(models.Address).filter(models.Address.id == o.dropoff_address_id).first()
        customer = db.query(models.User).filter(models.User.id == o.customer_id).first()
        result.append({
            "id": o.id, "status": o.current_status,
            "pickup": pickup.address_text if pickup else "", "pickup_lat": pickup.latitude if pickup else 0, "pickup_lng": pickup.longitude if pickup else 0,
            "dropoff": dropoff.address_text if dropoff else "", "dropoff_lat": dropoff.latitude if dropoff else 0, "dropoff_lng": dropoff.longitude if dropoff else 0,
            "customer_name": customer.name, "customer_phone": customer.phone,
            "package_details": o.package_details, "price": o.final_price,
            "payment_method": o.payment_method, "cod_amount": o.cod_amount,
            "proof_image_url": o.proof_image_url, "pickup_image_url": getattr(o, 'pickup_image_url', None)
        })
    return result

@router.post("/orders/{order_id}/messages", response_model=schemas.Message)
async def send_message(order_id: int, message: schemas.MessageCreate, db: Session = Depends(get_db)):
    new_msg = models.Message(order_id=order_id, sender_id=message.sender_id, content=message.content)
    db.add(new_msg); db.commit(); db.refresh(new_msg)
    await manager.broadcast(json.dumps({"event": "new_chat_message", "order_id": order_id}))
    return new_msg

@router.get("/orders/{order_id}/messages", response_model=list[schemas.Message])
def get_order_messages(order_id: int, db: Session = Depends(get_db)):
    return db.query(models.Message).filter(models.Message.order_id == order_id).order_by(models.Message.timestamp.asc()).all()

@router.post("/orders/{order_id}/review")
async def submit_order_review(order_id: int, review: schemas.OrderReview, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    order = db.query(models.Order).filter(models.Order.id == order_id).first()
    if db.query(models.Review).filter(models.Review.order_id == order_id).first(): 
        raise HTTPException(400, "Đã đánh giá!")
    
    db.add(models.Review(order_id=order.id, reviewer_id=current_user["user_id"], reviewee_id=order.driver_id, rating=review.rating, feedback=review.feedback))
    db.commit()
    
    # =========================================================
    # [ĐÃ KHÔI PHỤC] CÒI BÁO ĐỘNG 1 SAO CHO ADMIN
    # =========================================================
    if review.rating == 1:
        alert_payload = {
            "event": "bad_review_alert",
            "order_id": order.id,
            "driver_id": order.driver_id,
            "feedback": review.feedback
        }
        await manager.broadcast(json.dumps(alert_payload))
        
    await manager.broadcast(json.dumps({"event": "status_changed"}))
    return {"message": "Đánh giá thành công!"}