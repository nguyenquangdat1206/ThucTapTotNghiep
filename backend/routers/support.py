from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
import models, schemas, json
from core import get_db, manager

router = APIRouter(tags=["CSKH Support"])

# Từ điển từ khóa của Bot
BOT_RESPONSES = {
    "rút tiền": "🤖 BOT: Hệ thống hỗ trợ rút tiền tối thiểu 50,000đ qua thẻ Ngân hàng. Lệnh rút sẽ được duyệt tự động trong 5-10 phút.",
    "nạp tiền": "🤖 BOT: Bạn có thể nạp tiền vào ví bằng cách vào mục Ví Điện Tử -> Nạp Tiền (Hỗ trợ Momo, VNPay).",
    "hủy đơn": "🤖 BOT: Để hủy đơn, bạn vui lòng vào chi tiết đơn hàng và bấm 'Yêu cầu Hủy'. Quản trị viên sẽ kiểm tra và duyệt.",
    "chào": "🤖 BOT: Chào bạn! Tôi là trợ lý ảo. Bạn cần hỗ trợ vấn đề gì (Rút tiền, Hủy đơn, Nạp tiền...)?",
    "cước phí": "🤖 BOT: Cước phí xe máy là 16.000đ cho 3km đầu. Phí cồng kềnh thêm 20.000đ, phí tận cửa thêm 10.000đ."
}

@router.get("/support/{user_id}/messages")
def get_support_messages(user_id: int, db: Session = Depends(get_db)):
    return db.query(models.SupportMessage).filter(models.SupportMessage.user_id == user_id).order_by(models.SupportMessage.timestamp.asc()).all()

@router.post("/support/messages")
async def send_support_message(msg: schemas.SupportMessageCreate, db: Session = Depends(get_db)):
    # 1. Lưu tin nhắn gốc của người gửi vào Database
    new_msg = models.SupportMessage(user_id=msg.user_id, sender_type=msg.sender_type, content=msg.content)
    db.add(new_msg); db.commit(); db.refresh(new_msg)

    # Nếu Khách hàng nhắn, cho Bot phân tích
    if msg.sender_type == "user":
        text_lower = msg.content.lower()
        bot_reply = next((reply for key, reply in BOT_RESPONSES.items() if key in text_lower), None)
        
        if bot_reply:
            # 2. Trúng từ khóa -> Bot tự trả lời
            bot_msg = models.SupportMessage(user_id=msg.user_id, sender_type="bot", content=bot_reply)
            db.add(bot_msg); db.commit(); db.refresh(bot_msg)
        else:
            # 3. Câu hỏi khó -> Bot báo chờ và hú còi cấp cứu gọi Admin
            wait_msg = models.SupportMessage(user_id=msg.user_id, sender_type="bot", content="🤖 BOT: Câu hỏi đã được ghi nhận. Nhân viên CSKH sẽ phản hồi bạn trong giây lát...")
            db.add(wait_msg); db.commit(); db.refresh(wait_msg)
            
            # Popup báo động cho Admin
            await manager.broadcast(json.dumps({"event": "admin_support_alert", "user_id": msg.user_id}))
            
    # ==========================================
    # [ĐÃ SỬA] CHỐT CHẶN BÁO CÁO REAL-TIME TOÀN HỆ THỐNG
    # Bất kể là User, Admin hay Bot vừa nói, thì đều phải báo cho cả 2 bên cập nhật màn hình!
    # ==========================================
    
    # Ép màn hình Khách hàng tải lại tin nhắn mới
    await manager.send_personal_message(json.dumps({"event": "new_support_msg"}), msg.user_id)
    
    # Ép màn hình Admin tải lại khung chat
    await manager.broadcast(json.dumps({"event": "new_support_msg"}))
    
    return {"message": "Sent"}

@router.get("/admin/support/users")
def get_active_support_users(db: Session = Depends(get_db)):
    # Lấy danh sách các User đã từng nhắn tin CSKH
    subquery = db.query(models.SupportMessage.user_id).distinct()
    users = db.query(models.User).filter(models.User.id.in_(subquery)).all()
    return users