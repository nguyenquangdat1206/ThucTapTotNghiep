import math
from fastapi import WebSocket, WebSocketDisconnect, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from passlib.context import CryptContext
from jose import jwt, JWTError
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from database import SessionLocal
import models

# Bảo mật & JWT
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
SECRET_KEY = "khoa_bi_mat_sieu_cap_logistics" 
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 
security = HTTPBearer()

# Lưu trạng thái Online/Offline của tài xế
driver_ready_states = {} 

# [MỚI] Bộ nhớ lưu tọa độ GPS thời gian thực của tài xế
driver_locations = {}

# Quản lý WebSocket thời gian thực
class ConnectionManager:
    def __init__(self): 
        self.active_connections: dict[int, tuple[WebSocket, str]] = {}
    async def connect(self, user_id: int, role: str, websocket: WebSocket): 
        await websocket.accept()
        self.active_connections[user_id] = (websocket, role)
    def disconnect(self, user_id: int): 
        if user_id in self.active_connections: 
            del self.active_connections[user_id]
    async def send_personal_message(self, message: str, user_id: int):
        if user_id in self.active_connections:
            try: await self.active_connections[user_id][0].send_text(message)
            except: pass
    async def broadcast(self, message: str):
        for user_id, (websocket, role) in self.active_connections.items():
            try: await websocket.send_text(message)
            except: pass

manager = ConnectionManager()

# Các hàm Database & Xác thực
def get_db():
    db = SessionLocal()
    try: yield db
    finally: db.close()

def create_access_token(data: dict):
    to_encode = data.copy()
    to_encode.update({"exp": datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: int = payload.get("user_id")
        db = SessionLocal()
        db_user = db.query(models.User).filter(models.User.id == user_id).first()
        if db_user and not db_user.is_active: raise HTTPException(status_code=401, detail="Tài khoản bị khóa!")
        db.close()
        return {"user_id": user_id, "role": payload.get("role")}
    except JWTError: 
        raise HTTPException(status_code=401, detail="Phiên đăng nhập hết hạn!")

# Thuật toán bản đồ
def calculate_haversine(lat1, lon1, lat2, lon2):
    R = 6371.0 
    dLat = math.radians(lat2 - lat1)
    dLon = math.radians(lon2 - lon1)
    a = math.sin(dLat / 2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dLon / 2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c

def check_same_direction(lat_p1, lon_p1, lat_d1, lon_d1, lat_p2, lon_p2, lat_d2, lon_d2):
    v1_lat = lat_d1 - lat_p1
    v1_lon = lon_d1 - lon_p1
    v2_lat = lat_d2 - lat_p2
    v2_lon = lon_d2 - lon_p2
    return ((v1_lat * v2_lat) + (v1_lon * v2_lon)) > 0