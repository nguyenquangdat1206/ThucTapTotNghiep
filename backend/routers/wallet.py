from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
import models, schemas, json
from datetime import timedelta
from core import get_db, get_current_user, manager

router = APIRouter(tags=["Wallet & Promotions"])

@router.get("/users/{user_id}/transactions")
def get_user_transactions(user_id: int, db: Session = Depends(get_db)):
    transactions = []
    payments = db.query(models.Payment).filter(models.Payment.user_id == user_id).all()
    for p in payments:
        if p.type == "topup": transactions.append({"id": f"PAY_{p.id}", "type": "topup", "title": "Nạp tiền vào ví (+)", "amount": p.amount, "timestamp": p.created_at.isoformat(), "order_id": p.order_id})
        elif p.type == "withdrawal": transactions.append({"id": f"PAY_{p.id}", "type": "withdrawal", "title": "Rút tiền về Ngân hàng (-)", "amount": -p.amount, "timestamp": p.created_at.isoformat(), "order_id": p.order_id})
        elif p.type == "deduction": transactions.append({"id": f"PAY_{p.id}", "type": "deduction", "title": f"Khấu trừ hoa hồng (Đơn #{p.order_id})", "amount": -p.amount, "timestamp": p.created_at.isoformat(), "order_id": p.order_id})
        elif p.type == "income":
            order = db.query(models.Order).filter(models.Order.id == p.order_id).first()
            extra_sum = 0
            fees_data = {}
            if order and order.extra_fees:
                try: fees_data = json.loads(order.extra_fees); extra_sum = sum(fees_data.values())
                except: pass
            transactions.append({"id": f"PAY_{p.id}_BASE", "type": "income", "title": f"Cước phí ship (Đơn #{p.order_id})", "amount": p.amount - extra_sum, "timestamp": p.created_at.isoformat(), "order_id": p.order_id})
            if fees_data.get("tip", 0) > 0: transactions.append({"id": f"PAY_{p.id}_TIP", "type": "tip", "title": f"Tiền Tip từ khách (Đơn #{p.order_id})", "amount": fees_data["tip"], "timestamp": (p.created_at + timedelta(seconds=1)).isoformat(), "order_id": p.order_id})
            if fees_data.get("bulky_fee", 0) > 0: transactions.append({"id": f"PAY_{p.id}_BULKY", "type": "surcharge", "title": f"Phí cồng kềnh (Đơn #{p.order_id})", "amount": fees_data["bulky_fee"], "timestamp": (p.created_at + timedelta(seconds=2)).isoformat(), "order_id": p.order_id})
            if fees_data.get("door_delivery_fee", 0) > 0: transactions.append({"id": f"PAY_{p.id}_DOOR", "type": "surcharge", "title": f"Phí tận cửa (Đơn #{p.order_id})", "amount": fees_data["door_delivery_fee"], "timestamp": (p.created_at + timedelta(seconds=3)).isoformat(), "order_id": p.order_id})
    transactions.sort(key=lambda x: x["timestamp"], reverse=True)
    return transactions

@router.post("/users/{user_id}/withdraw")
async def withdraw_money(user_id: int, request: schemas.WithdrawRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if user.balance < request.amount: raise HTTPException(400, "Số dư không đủ để rút!")
    user.balance -= request.amount
    db.add(models.Payment(user_id=user.id, amount=request.amount, type="withdrawal", method="bank", status="success"))
    db.commit()
    await manager.broadcast(json.dumps({"event": "balance_changed"})) 
    return {"message": "Rút tiền thành công"}

@router.post("/users/{user_id}/topup")
async def user_topup_wallet(user_id: int, request: schemas.TopUpRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    user.balance += request.amount
    db.add(models.Payment(user_id=user.id, amount=request.amount, type="topup", method="bank", status="success"))
    db.commit()
    await manager.broadcast(json.dumps({"event": "balance_changed"})) 
    return {"message": "Nạp tiền thành công"}

@router.post("/promotions/apply")
def apply_promotion(request: schemas.PromotionApplyRequest, db: Session = Depends(get_db)):
    promo = db.query(models.Promotion).filter(models.Promotion.code == request.code.upper()).first()
    if not promo: raise HTTPException(404, "Mã khuyến mãi không tồn tại!")
    if promo.usage_limit is not None and promo.usage_limit <= 0: raise HTTPException(400, "Mã này đã hết lượt!")
    if request.order_value < promo.min_order_value: raise HTTPException(400, f"Đơn hàng chưa đạt mức {promo.min_order_value:,.0f}đ!")
    
    discount_amount = request.order_value * (promo.discount_value / 100.0) if promo.discount_type == "percentage" else promo.discount_value
    discount_amount = min(discount_amount, request.order_value)
    
    return {"promo_id": promo.id, "code": promo.code, "discount_amount": discount_amount, "message": "Áp dụng mã thành công!"}