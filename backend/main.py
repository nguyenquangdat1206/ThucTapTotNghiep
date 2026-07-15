import os
import json
import asyncio
from datetime import datetime, timedelta

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware

import models
from database import engine, SessionLocal
from core import manager, pwd_context

# Import đầy đủ các phòng ban (Bao gồm cả support)
from routers import auth, orders, wallet, admin, support

# Khởi tạo DB
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Logistics Core Backend", version="2.0")

# ==========================================
# 1. CẤU HÌNH CORS (CẤP GIẤY THÔNG HÀNH API)
# ==========================================
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Cho phép tất cả các domain gọi tới
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==========================================
# 2. CẤU HÌNH THƯ MỤC LƯU TRỮ TĨNH (ẢNH)
# ==========================================
os.makedirs("static/avatars", exist_ok=True)
os.makedirs("static/pods", exist_ok=True)
app.mount("/static", StaticFiles(directory="static"), name="static")

# ==========================================
# 3. ĐĂNG KÝ CÁC PHÒNG BAN (ROUTERS)
# ==========================================
app.include_router(auth.router)
app.include_router(orders.router)
app.include_router(wallet.router)
app.include_router(admin.router)
app.include_router(support.router)

# ==========================================
# 4. WEBSOCKET (KẾT NỐI REAL-TIME)
# ==========================================
@app.websocket("/ws/{user_id}/{role}")
async def websocket_endpoint(websocket: WebSocket, user_id: int, role: str):
    await manager.connect(user_id, role, websocket)
    try:
        while True: 
            await websocket.receive_text()
    except WebSocketDisconnect: 
        manager.disconnect(user_id)


# =========================================================
# 5. BACKGROUND TASKS & HÀM GIEO MẦM DATABASE
# =========================================================
def seed_database():
    db = SessionLocal()
    try:
        if not db.query(models.User).first():
            admin_user = models.User(name="DQ", email="admin@gmail.com", password_hash=pwd_context.hash("1"), role="admin", is_active=True)
            customer = models.User(name="Đạt Quang", email="nguyenquangdat898@gmail.com", password_hash=pwd_context.hash("1"), role="customer", phone="0868923294", is_active=True)
            driver1 = models.User(name="Xế 1", email="taixe1@gmail.com", password_hash=pwd_context.hash("1"), role="driver_express", phone="0987654321", balance=500000.0, is_active=True)
            driver2 = models.User(name="Xế 2", email="taixe2@gmail.com", password_hash=pwd_context.hash("1"), role="driver_container", phone="0123456789", balance=500000.0, is_active=True)
            db.add_all([admin_user, customer, driver1, driver2])
            db.commit()

            addr1 = models.Address(user_id=customer.id, label="Đại học Sài Gòn", latitude=10.762622, longitude=106.660172, address_text="273 An Dương Vương, Phường 3, Quận 5", is_default=True)
            addr2 = models.Address(user_id=customer.id, label="Nhà", latitude=10.776889, longitude=106.700806, address_text="Phố đi bộ Nguyễn Huệ, Quận 1", is_default=False)
            db.add_all([addr1, addr2])
            
            dp1 = models.DriverProfile(user_id=driver1.id, verify_status="approved")
            dp2 = models.DriverProfile(user_id=driver2.id, verify_status="approved")
            db.add_all([dp1, dp2])
            db.commit()
            
            v1 = models.Vehicle(driver_id=dp1.id, type="motorcycle", license_plate="59H2-21646", brand="Honda Winner X")
            v2 = models.Vehicle(driver_id=dp2.id, type="container", license_plate="51H-26439", brand="Hyundai")
            db.add_all([v1, v2])
            db.commit()
            print("🌱 Đã tự động gieo mầm (Seed) Database 4 tài khoản thành công!")
    except Exception as e:
        print("Lỗi tạo tài khoản test:", e)
    finally:
        db.close()

async def auto_cancel_expired_orders():
    while True:
        await asyncio.sleep(60)
        db = SessionLocal()
        try:
            cutoff_time = datetime.utcnow() - timedelta(minutes=5)
            expired_orders = db.query(models.Order).filter(models.Order.current_status == "pending", models.Order.created_at < cutoff_time).all()
            if expired_orders:
                for order in expired_orders:
                    order.current_status = "cancelled_timeout"
                    db.add(models.OrderStatusHistory(order_id=order.id, status="cancelled_timeout", changed_by=order.customer_id, note="Hệ thống tự hủy"))
                db.commit()
                await manager.broadcast(json.dumps({"event": "status_changed"}))
        except Exception: 
            pass
        finally: 
            db.close()

@app.on_event("startup")
async def startup_event(): 
    seed_database() 
    asyncio.create_task(auto_cancel_expired_orders())