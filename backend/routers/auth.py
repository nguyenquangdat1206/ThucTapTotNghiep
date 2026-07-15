from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
import models, schemas, shutil, json
from core import get_db, get_current_user, pwd_context, create_access_token, manager

router = APIRouter(tags=["Auth & Users"])

@router.post("/register")
async def register_user(user: schemas.UserCreate, db: Session = Depends(get_db)):
    if db.query(models.User).filter(models.User.email == user.email).first(): raise HTTPException(400, "Email đã tồn tại!")
    final_role = f"pending_{user.role}" if user.role.startswith("driver") else user.role
    new_user = models.User(name=user.name, email=user.email, password_hash=pwd_context.hash(user.password), role=final_role, phone=user.phone, is_active=True)
    db.add(new_user); db.commit(); db.refresh(new_user)
    if user.role.startswith("driver"):
        new_dp = models.DriverProfile(user_id=new_user.id)
        db.add(new_dp); db.commit(); db.refresh(new_dp)
        db.add(models.Vehicle(driver_id=new_dp.id, type="motorcycle" if "express" in user.role else "container", license_plate=user.license_plate)); db.commit()
    await manager.broadcast(json.dumps({"event": "user_registered"}))
    return {"message": "Thành công!", "user_id": new_user.id}

@router.post("/login")
def login_user(user: schemas.UserLogin, db: Session = Depends(get_db)):
    db_user = db.query(models.User).filter(models.User.email == user.email).first()
    if not db_user or not pwd_context.verify(user.password, db_user.password_hash): raise HTTPException(400, "Sai thông tin!")
    if not db_user.is_active: raise HTTPException(400, "Tài khoản bị khóa!")
    if db_user.role.startswith("pending_"): raise HTTPException(400, "Đang chờ Admin duyệt!")
    return {"user_id": db_user.id, "role": db_user.role, "name": db_user.name, "access_token": create_access_token({"user_id": db_user.id, "role": db_user.role})}

@router.get("/users/{user_id}", response_model=schemas.User)
def get_user_info(user_id: int, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user: raise HTTPException(404, "Not found")
    return user

@router.post("/users/{user_id}/avatar")
async def upload_avatar(user_id: int, file: UploadFile = File(...), db: Session = Depends(get_db)):
    db_user = db.query(models.User).filter(models.User.id == user_id).first()
    file_location = f"static/avatars/{user_id}_{file.filename}"
    with open(file_location, "wb+") as f: shutil.copyfileobj(file.file, f)
    db_user.avatar_url = f"https://datquang-backend.onrender.com/{file_location}"
    db.commit()
    return {"avatar_url": db_user.avatar_url}

@router.get("/users/{user_id}/addresses")
def get_user_addresses(user_id: int, db: Session = Depends(get_db)):
    return db.query(models.Address).filter(models.Address.user_id == user_id).all()

@router.post("/users/{user_id}/addresses")
def create_user_address(user_id: int, address: schemas.AddressCreate, db: Session = Depends(get_db)):
    new_addr = models.Address(user_id=user_id, label=address.label, latitude=address.latitude, longitude=address.longitude, address_text=address.address_text, is_default=address.is_default)
    db.add(new_addr); db.commit(); db.refresh(new_addr)
    return new_addr
