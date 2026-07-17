import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register'; 
import Dashboard from './pages/Dashboard';
import Booking from './pages/Booking';
import OrderDetail from './pages/OrderDetail';
import WalletPage from './pages/WalletPage';
import DriverProfileAdmin from './pages/DriverProfileAdmin';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/booking" element={<Booking />} />
      <Route path="/order/:id" element={<OrderDetail />} />
      <Route path="/wallet" element={<WalletPage />} />
      <Route path="/admin/driver/:id" element={<DriverProfileAdmin />} />
    </Routes>
  );
}

export default App;