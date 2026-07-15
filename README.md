# 🚀 Hệ Thống Điều Phối & Giao Nhận Thông Minh (Smart Logistics & Delivery System)

Một hệ thống nền tảng giao hàng công nghệ thời gian thực (Real-time Delivery Platform) được thiết kế theo kiến trúc Micro-components. Dự án mô phỏng chính xác luồng vận hành của các siêu ứng dụng gọi xe hiện nay, tập trung vào thuật toán điều phối động và trải nghiệm thực tế của Đối tác Tài xế.

## 🌟 Tính Năng Nổi Bật (Key Features)

### 1. Thuật Toán Lõi (Core Algorithms)
* **Dynamic Batching (Gom đơn động):** Thuật toán sử dụng công thức **Haversine** (tính khoảng cách tọa độ) và **Tích Vô Hướng Vector** (Dot Product) để tự động nhận diện và ép ghép các đơn hàng cùng chiều di chuyển vào một chuyến xe, giúp tối ưu hóa thu nhập cho tài xế.
* **Location-based Dispatching:** Quét và "nổ" đơn trực tiếp cho các tài xế đang Online trong bán kính 3km xung quanh điểm lấy hàng.
* **Geofencing & POD (Proof of Delivery):** Chặn tài xế hoàn thành đơn nếu cách vị trí ghim trên bản đồ quá 500m. Yêu cầu bắt buộc chụp ảnh xác thực tại Điểm lấy và Điểm giao.

### 2. Dành cho Khách Hàng (Customer App)
* Đặt đơn thông minh qua bản đồ tương tác (Leaflet + OSRM Routing).
* Tự động tính toán cước phí dựa trên khoảng cách thực tế, phụ thu cồng kềnh, phí tận cửa.
* Hệ thống áp dụng **Mã Khuyến Mãi (Vouchers)** thông minh.
* Theo dõi lộ trình đơn hàng và Chat thời gian thực với Tài xế / Admin.
* Kênh hỗ trợ CSKH tự động (Chatbot) nhận diện từ khóa.

### 3. Dành cho Đối tác Tài xế (Driver App)
* Công tắc trạng thái (Online / Nghỉ ngơi) để điều khiển Radar quét đơn.
* Giao diện vuốt để xác nhận (Swipe to Action) mượt mà.
* **Ví Điện Tử (Driver Wallet):** Tự chủ nạp/rút tiền. Sổ cái giao dịch ghi nhận chi tiết: Cước phí, Tiền Tip, Phụ phí cồng kềnh, Khấu trừ hoa hồng.
* Liên kết trực tiếp Google Maps bằng tọa độ GPS chuẩn xác.

### 4. Dành cho Quản trị viên (Admin Dashboard)
* Thống kê dòng tiền, doanh thu và lợi nhuận thực tế theo thời gian thực.
* Quản lý trạng thái hồ sơ người dùng (Duyệt hồ sơ tài xế mới, Khóa/Mở tài khoản).
* **Còi báo động 1-Sao:** Cảnh báo đỏ tức thời qua WebSocket khi có tài xế nhận đánh giá 1 sao.
* Quản lý tạo/hủy Mã Khuyến Mãi.
* Trực tiếp can thiệp và chat hỗ trợ giải quyết khiếu nại của khách hàng.

---

## 🛠️ Công Nghệ Sử Dụng (Tech Stack)

### Backend (Core Engine)
* **Framework:** Python / FastAPI
* **Database:** SQLite & SQLAlchemy (ORM)
* **Authentication:** JWT (JSON Web Tokens) & Passlib (Bcrypt)
* **Real-time Communication:** WebSockets

### Frontend (User Interface)
* **Framework:** ReactJS (Vite)
* **Styling & UI Components:** React-Bootstrap
* **Maps & Routing:** Leaflet, React-Leaflet, OSRM API, ArcGIS Geocoding API
* **State Management & Data Fetching:** React Hooks, Axios

---

## ⚙️ Hướng Dẫn Cài Đặt & Khởi Chạy (Installation)

### 1. Khởi chạy Backend (Server)
Yêu cầu: Đã cài đặt Python 3.9+
```bash
# Di chuyển vào thư mục backend
cd backend

# Cài đặt đồng loạt tất cả thư viện từ file requirements
pip install -r requirements.txt

# Khởi chạy server FastAPI (Mặc định chạy ở cổng 8000)
uvicorn main:app --reload

Lưu ý: Ngay lần chạy đầu tiên, hệ thống sẽ tự động gieo mầm (Seed) Database và tạo ra 4 tài khoản mẫu (Admin, Khách hàng, Tài xế Xe máy, Tài xế Container) với mật khẩu mặc định là 1.

2. Khởi chạy Frontend (Client)
Yêu cầu: Đã cài đặt Node.js (v16+)

# Di chuyển vào thư mục frontend
cd frontend

# Cài đặt các modules từ package.json
npm install

# Khởi chạy giao diện web
npm run dev

📂 Cấu Trúc Thư Mục Tiêu Biểu (Clean Architecture)

📦 Project
 ┣ 📂 backend
 ┃ ┣ 📂 routers/           # Chứa các API phân theo module (auth, orders, wallet, admin, support)
 ┃ ┣ 📜 main.py            # File cấu hình gốc, đăng ký Routers và WebSockets
 ┃ ┣ 📜 core.py            # Trái tim hệ thống: JWT, WebSockets Manager, Thuật toán Haversine
 ┃ ┣ 📜 models.py          # Định nghĩa Database Tables (SQLAlchemy)
 ┃ ┗ 📜 schemas.py         # Định nghĩa Pydantic Models để validate dữ liệu
 ┃
 ┗ 📂 frontend
   ┣ 📂 src
   ┃ ┣ 📂 components/      # Các thành phần tái sử dụng (SwipeButton, Map, ChatBox, Skeleton)
   ┃ ┣ 📂 pages/           # Các trang chính (Booking, OrderDetail, WalletPage)
   ┃ ┃ ┗ 📂 dashboards/    # Trạm điều phối riêng biệt cho từng Role (Customer, Driver, Admin)
   ┃ ┗ 📜 App.jsx          # Cấu hình React Router DOM