import React from 'react';
import { Container } from 'react-bootstrap';
import { Navigate } from 'react-router-dom';
import CustomerDashboard from './dashboards/CustomerDashboard';
import DriverDashboard from './dashboards/DriverDashboard';
import AdminDashboard from './dashboards/AdminDashboard';

export default function Dashboard() {
  const userInfoString = localStorage.getItem('userInfo');
  const userInfo = userInfoString ? JSON.parse(userInfoString) : null;

  // Nếu chưa đăng nhập, đá văng ra trang chủ
  if (!userInfo) return <Navigate to="/" />;

  // Phân luồng giao diện
  if (userInfo.role === 'customer') {
      return <CustomerDashboard userInfo={userInfo} />;
  } 
  else if (userInfo.role.startsWith('driver') || userInfo.role.startsWith('pending_driver')) {
      return <DriverDashboard userInfo={userInfo} />;
  } 
  else if (userInfo.role === 'admin') {
      return <AdminDashboard userInfo={userInfo} />;
  }

  return (
      <Container className="mt-5 text-center">
          <h3 className="text-danger">Vai trò không hợp lệ! Vui lòng liên hệ Admin.</h3>
      </Container>
  );
}