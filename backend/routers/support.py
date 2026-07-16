from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
import models, schemas, json
from core import get_db, manager

router = APIRouter(tags=["CSKH Support"])

# Từ điển từ khóa của Bot
BOT_RESPONSES = {
    # Nhóm: Chào hỏi & Điều hướng
    "chào": "🤖 BOT: Chào bạn! Tôi là trợ lý ảo Đạt Quang Logistics. Bạn cần hỗ trợ vấn đề gì (Rút tiền, Hủy đơn, Đền bù, Nạp tiền...)?",
    "gặp nhân viên": "🤖 BOT: Yêu cầu của bạn đã được chuyển. Quản trị viên (Admin) sẽ vào chat với bạn ngay bây giờ, vui lòng giữ máy nhé!",
    "admin": "🤖 BOT: Đang kết nối với tổng đài viên... Bạn vui lòng nhắn chi tiết vấn đề xuống bên dưới nhé.",
    
    # Nhóm: Cước phí & Khuyến mãi
    "cước phí": "🤖 BOT: Cước phí xe máy cơ bản là 16.000đ/3km đầu. Phí cồng kềnh thêm 20.000đ, phí giao tận cửa/lên lầu thêm 10.000đ.",
    "mã giảm giá": "🤖 BOT: Bạn có thể nhập mã giảm giá ở bước Thanh toán. Lưu ý mỗi mã chỉ có giới hạn số lượt sử dụng nhất định.",
    "voucher": "🤖 BOT: Hãy theo dõi Fanpage của chúng tôi để cập nhật các Voucher freeship mới nhất hàng tuần nhé!",
    
    # Nhóm: Xử lý Đơn hàng
    "hủy đơn": "🤖 BOT: Nếu đơn chưa có tài xế, bạn có thể tự hủy. Nếu tài xế đang đến, vui lòng vào chi tiết đơn và bấm 'Yêu cầu Hủy' để Admin xét duyệt.",
    "đổi địa chỉ": "🤖 BOT: Hiện tại hệ thống chưa hỗ trợ tự đổi địa chỉ sau khi đặt. Bạn vui lòng hủy đơn cũ và đặt lại đơn mới giúp hệ thống nhé.",
    "thêm món": "🤖 BOT: Tài xế chỉ giao hàng theo đúng thông tin trên app. Nếu bạn muốn gửi thêm đồ, vui lòng thỏa thuận riêng với tài xế.",
    "giao chậm": "🤖 BOT: Xin lỗi bạn vì sự chậm trễ. Bạn có thể gọi trực tiếp cho tài xế trong phần chi tiết đơn. Nếu không gọi được, hãy báo lại Admin.",
    "chưa thấy tài xế": "🤖 BOT: Đôi khi kẹt xe hoặc mưa lớn khiến tài xế di chuyển chậm hơn dự kiến. Mong bạn thông cảm chờ thêm ít phút nhé!",
    
    # Nhóm: Khiếu nại & Sự cố
    "mất hàng": "🤖 BOT: Đây là sự cố nghiêm trọng! Vui lòng cung cấp mã đơn hàng, hình ảnh (nếu có). Admin sẽ khóa tài khoản tài xế và đền bù 100% giá trị hàng hóa.",
    "hư hỏng": "🤖 BOT: Rất tiếc về sự cố này. Bạn vui lòng chụp ảnh tình trạng hàng hóa bị hỏng và gửi mã đơn hàng lên đây để Admin xử lý đền bù.",
    "thái độ": "🤖 BOT: Chúng tôi rất tiếc về trải nghiệm này. Hãy vào chi tiết đơn hàng, đánh giá 1 SAO và ghi rõ lý do. Hệ thống sẽ có biện pháp phạt tài xế.",
    "đánh giá": "🤖 BOT: Đánh giá của bạn giúp chúng tôi cải thiện dịch vụ. Bạn có thể đánh giá tài xế sau khi chuyến đi hoàn tất.",

    # Nhóm: Tài khoản & Ví (Dành cho tài xế/khách)
    "nạp tiền": "🤖 BOT: Để nạp tiền vào ví, bạn vào mục 'Ví Đối Tác' -> 'Nạp Tiền'. Hệ thống hỗ trợ chuyển khoản ngân hàng 24/7.",
    "rút tiền": "🤖 BOT: Hệ thống hỗ trợ rút tiền tối thiểu 50,000đ. Lệnh rút sẽ được tự động chuyển về tài khoản ngân hàng của bạn trong 5-10 phút.",
    "chưa nhận được tiền": "🤖 BOT: Nếu lệnh rút tiền đã báo thành công mà ngân hàng chưa nổ ting ting, vui lòng đợi thêm 24h hoặc nhắn tin để Admin đối soát lại.",
    "quên mật khẩu": "🤖 BOT: Hiện tại tính năng cấp lại mật khẩu tự động đang bảo trì. Vui lòng nhắn [Email + SĐT] để Admin hỗ trợ cấp lại mật khẩu.",
    
    # Nhóm: Tuyển dụng (Tài xế)
    "đăng ký tài xế": "🤖 BOT: Để chạy xe, bạn hãy đăng xuất, tạo tài khoản mới với vai trò 'Tài xế'. Sau đó cập nhật đầy đủ Hồ sơ (Biển số xe) và chờ Admin duyệt.",
    "chưa được duyệt": "🤖 BOT: Hồ sơ tài xế thường được duyệt trong vòng 2-4 tiếng. Vui lòng đảm bảo bạn đã điền đủ Số điện thoại và Biển số xe trong phần Hồ sơ nhé!"
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