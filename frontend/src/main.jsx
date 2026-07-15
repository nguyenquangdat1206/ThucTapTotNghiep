import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import 'bootstrap/dist/css/bootstrap.min.css';
import { BrowserRouter } from 'react-router-dom';
import axios from 'axios'; // Import thêm axios

// ==============================================================
// AXIOS INTERCEPTOR: Tự động kẹp thẻ & Xử lý thẻ hết hạn
// ==============================================================
axios.interceptors.request.use(
  (config) => {
    const userInfoString = localStorage.getItem('userInfo');
    if (userInfoString) {
      const userInfo = JSON.parse(userInfoString);
      if (userInfo.access_token) {
        config.headers.Authorization = `Bearer ${userInfo.access_token}`;
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// THÊM MỚI: Người gác cổng chiều về (Xử lý lỗi từ Server)
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    // Nếu lỗi là 401 (Lỗi thẻ bài/Bảo mật)
    if (error.response && error.response.status === 401) {
      console.log("Thẻ hết hạn hoặc không hợp lệ, tự động đăng xuất!");
      localStorage.removeItem('userInfo'); // Xóa két sắt
      window.location.href = '/'; // Đá văng về trang Đăng nhập
    }
    return Promise.reject(error);
  }
);

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
)