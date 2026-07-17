from sqlalchemy import Column, Integer, String, Float, Boolean, ForeignKey, DateTime
from datetime import datetime
from database import Base

# ================= THÔNG TIN CƠ BẢN & PHÂN QUYỀN =================
class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    email = Column(String(100), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(50), default="customer")
    balance = Column(Float, default=0.0)
    is_active = Column(Boolean, default=True)
    phone = Column(String(20), unique=True, nullable=True)
    avatar_url = Column(String(500), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class DriverProfile(Base):
    __tablename__ = "driver_profiles"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    ban_reason = Column(String(500), nullable=True)
    verify_status = Column(String(50), default="pending") 
    total_trips = Column(Integer, default=0)
    avg_rating = Column(Float, default=0.0)

class Vehicle(Base):
    __tablename__ = "vehicles"
    id = Column(Integer, primary_key=True, index=True)
    driver_id = Column(Integer, ForeignKey("driver_profiles.id"), nullable=False)
    type = Column(String(50), nullable=False) 
    license_plate = Column(String(50), unique=True, nullable=False)
    brand = Column(String(100), nullable=True)
    color = Column(String(50), nullable=True)

class Address(Base):
    __tablename__ = "addresses"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    label = Column(String(100), nullable=True) 
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    address_text = Column(String(500), nullable=False)
    is_default = Column(Boolean, default=False)

# ================= VẬN HÀNH ĐƠN HÀNG =================
class Order(Base):
    __tablename__ = "orders"
    id = Column(Integer, primary_key=True, index=True)
    customer_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    driver_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    pickup_address_id = Column(Integer, ForeignKey("addresses.id"), nullable=False)
    dropoff_address_id = Column(Integer, ForeignKey("addresses.id"), nullable=False)
    promo_id = Column(Integer, ForeignKey("promotions.id"), nullable=True)
    package_details = Column(String(255), nullable=True)
    original_price = Column(Float, nullable=False)
    final_price = Column(Float, nullable=False)
    current_status = Column(String(50), default="pending")
    proof_image_url = Column(String(500), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # [ĐÃ BỔ SUNG ĐỦ CÁC CỘT NGHIỆP VỤ]
    batch_id = Column(String(50), nullable=True) 
    driver_payout = Column(Float, nullable=True) 
    payment_method = Column(String(50), default="cash")
    cod_amount = Column(Float, default=0.0)
    extra_fees = Column(String(500), nullable=True) 
    pickup_image_url = Column(String, nullable=True) 

    # [MỚI] THÔNG TIN LIÊN LẠC NGƯỜI GỬI / NGƯỜI NHẬN
    sender_name = Column(String(100), nullable=True)
    sender_phone = Column(String(20), nullable=True)
    receiver_name = Column(String(100), nullable=True)
    receiver_phone = Column(String(20), nullable=True)
    
class OrderStatusHistory(Base):
    __tablename__ = "order_status_history"
    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False)
    status = Column(String(50), nullable=False)
    changed_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    note = Column(String(500), nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow)

# ================= TÀI CHÍNH & KHUYẾN MÃI =================
class Payment(Base):
    __tablename__ = "payments"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=True)
    amount = Column(Float, nullable=False)
    type = Column(String(50), nullable=False) 
    method = Column(String(50), nullable=False) 
    status = Column(String(50), default="pending") 
    created_at = Column(DateTime, default=datetime.utcnow)

class Promotion(Base):
    __tablename__ = "promotions"
    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(50), unique=True, nullable=False)
    discount_value = Column(Float, nullable=False)
    discount_type = Column(String(50), default="fixed_amount") 
    min_order_value = Column(Float, default=0.0)
    valid_until = Column(DateTime, nullable=True)
    usage_limit = Column(Integer, nullable=True)

# ================= TƯƠNG TÁC & CSKH =================
class Message(Base):
    __tablename__ = "messages"
    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False)
    sender_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    content = Column(String(1000), nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow)

class Review(Base):
    __tablename__ = "reviews"
    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False)
    reviewer_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    reviewee_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    rating = Column(Integer, nullable=False)
    feedback = Column(String(1000), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class Notification(Base):
    __tablename__ = "notifications"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    title = Column(String(200), nullable=False)
    content = Column(String(1000), nullable=False)
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

class SupportTicket(Base):
    __tablename__ = "support_tickets"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=True)
    issue_type = Column(String(100), nullable=False)
    status = Column(String(50), default="open") 
    resolution = Column(String(1000), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
class SupportMessage(Base):
    __tablename__ = "support_messages"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer)  
    sender_type = Column(String)  
    content = Column(String)
    timestamp = Column(DateTime, default=datetime.utcnow)