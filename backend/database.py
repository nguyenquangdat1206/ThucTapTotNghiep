from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# Chuỗi kết nối (Hiện tại dùng file SQLite cục bộ)
SQLALCHEMY_DATABASE_URL = "sqlite:///./logistics.db"

# Khởi tạo Engine để giao tiếp với DB
engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)

# Tạo Session để thực hiện các phiên làm việc (Query, Thêm, Sửa, Xóa)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Lớp Base để các model sau này kế thừa
Base = declarative_base()