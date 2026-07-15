from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
import models, schemas, json
from core import get_db, manager

router = APIRouter(tags=["Admin Control"])

@router.get("/admin/orders")
def get_all_orders_for_admin(db: Session = Depends(get_db)):
    return [ {**o.__dict__, "status": o.current_status, "price": o.final_price} for o in db.query(models.Order).order_by(models.Order.id.desc()).all() ]

@router.get("/admin/users")
def get_all_users_for_admin(db: Session = Depends(get_db)):
    return db.query(models.User).filter(models.User.role != "admin").order_by(models.User.id.desc()).all()

@router.put("/admin/users/{user_id}/toggle_active")
async def toggle_user_active(user_id: int, request: schemas.BanRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    user.is_active = not user.is_active 
    db.commit()
    await manager.broadcast(json.dumps({"event": "user_banned", "user_id": user_id, "reason": request.reason}))
    return {"is_active": user.is_active}

# [Bổ sung] API duyệt/từ chối tài xế cho bảng Dashboard của bạn
@router.put("/admin/users/{user_id}/approve_driver")
async def approve_driver(user_id: int, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if user and user.role.startswith("pending_"):
        user.role = user.role.replace("pending_", "")
        db.commit()
        await manager.broadcast(json.dumps({"event": "status_changed"}))
        return {"message": "Duyệt thành công"}
    raise HTTPException(400, "Lỗi duyệt")

@router.delete("/admin/users/{user_id}/reject_driver")
async def reject_driver(user_id: int, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if user:
        db.delete(user); db.commit()
        return {"message": "Từ chối thành công"}
    raise HTTPException(400, "Lỗi từ chối")

@router.get("/admin/drivers/{driver_id}/profile")
def get_driver_profile_admin(driver_id: int, db: Session = Depends(get_db)):
    driver = db.query(models.User).filter(models.User.id == driver_id).first()
    orders = db.query(models.Order).filter(models.Order.driver_id == driver_id).order_by(models.Order.id.desc()).all()
    dp = db.query(models.DriverProfile).filter(models.DriverProfile.user_id == driver.id).first()
    vehicle = db.query(models.Vehicle).filter(models.Vehicle.driver_id == dp.id).first() if dp else None
    
    driver_dict = driver.__dict__.copy()
    if vehicle: driver_dict["license_plate"] = vehicle.license_plate
    
    result_orders = []
    for o in orders:
        review = db.query(models.Review).filter(models.Review.order_id == o.id).first()
        result_orders.append({**o.__dict__, "status": o.current_status, "price": o.final_price, "rating": review.rating if review else None})
    return {"driver": driver_dict, "orders": result_orders}

@router.get("/admin/promotions")
def get_all_promotions(db: Session = Depends(get_db)):
    return db.query(models.Promotion).order_by(models.Promotion.id.desc()).all()

@router.post("/admin/promotions")
def create_promotion(promo: schemas.PromotionCreate, db: Session = Depends(get_db)):
    if db.query(models.Promotion).filter(models.Promotion.code == promo.code.upper()).first(): raise HTTPException(400, "Mã đã tồn tại!")
    new_promo = models.Promotion(code=promo.code.upper(), discount_value=promo.discount_value, discount_type=promo.discount_type, min_order_value=promo.min_order_value, usage_limit=promo.usage_limit)
    db.add(new_promo); db.commit(); db.refresh(new_promo)
    return new_promo