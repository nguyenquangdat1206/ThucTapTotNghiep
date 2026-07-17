from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime

# --- USERS ---
class UserBase(BaseModel):
    name: str
    email: EmailStr
    role: str = "customer"
    phone: Optional[str] = None
    avatar_url: Optional[str] = None

class UserCreate(UserBase):
    password: str

class User(UserBase):
    id: int
    balance: float
    is_active: bool
    created_at: datetime
    class Config:
        from_attributes = True

class UserLogin(BaseModel):
    email: str  
    password: str

class BanRequest(BaseModel):
    reason: Optional[str] = None

# --- ADDRESSES ---
class AddressCreate(BaseModel):
    label: Optional[str] = None
    latitude: float
    longitude: float
    address_text: str
    is_default: bool = False

# --- ORDERS ---
class OrderCreate(BaseModel):
    customer_id: int
    pickup_address_id: int
    dropoff_address_id: int
    promo_id: Optional[int] = None
    package_details: Optional[str] = None
    original_price: float
    total_price: float = 0.0      
    payment_method: str = "cash"
    cod_amount: float = 0.0
    extra_fees: Optional[str] = None 
    discount_amount: float = 0.0  
    
    # [MỚI] 4 CỘT THÔNG TIN NGƯỜI GỬI / NHẬN
    sender_name: Optional[str] = None
    sender_phone: Optional[str] = None
    receiver_name: Optional[str] = None
    receiver_phone: Optional[str] = None

class Order(BaseModel):
    id: int
    customer_id: int
    driver_id: Optional[int] = None
    pickup_address_id: int
    dropoff_address_id: int
    package_details: Optional[str] = None
    final_price: float
    current_status: str
    proof_image_url: Optional[str] = None 
    created_at: datetime
    class Config:
        from_attributes = True

# --- REVIEWS & PAYMENTS ---
class OrderReview(BaseModel):
    rating: int
    feedback: Optional[str] = None

class TopUpRequest(BaseModel): 
    amount: float

class WithdrawRequest(BaseModel):
    amount: float

# --- MESSAGES ---
class MessageCreate(BaseModel):
    sender_id: int
    content: str

class Message(BaseModel):
    id: int
    order_id: int
    sender_id: int
    content: str
    timestamp: datetime
    class Config:
        from_attributes = True
        
# --- PROMOTIONS (KHUYẾN MÃI) ---
class PromotionCreate(BaseModel):
    code: str
    discount_value: float
    discount_type: str = "fixed_amount"
    min_order_value: float = 0.0
    usage_limit: Optional[int] = None

class PromotionApplyRequest(BaseModel):
    code: str
    order_value: float
    
class SupportMessageCreate(BaseModel):
    user_id: int
    sender_type: str = "user"
    content: str