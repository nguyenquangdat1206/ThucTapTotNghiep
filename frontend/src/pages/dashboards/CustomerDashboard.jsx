import React, { useState, useEffect } from 'react';
import { Container, Button, Badge, Modal, Form, Alert, Row, Col } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import DashboardSkeleton from '../../components/DashboardSkeleton';
import SupportWidget from '../../components/SupportWidget';

export default function CustomerDashboard({ userInfo }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [myOrders, setMyOrders] = useState([]); 
  const [actionMessage, setActionMessage] = useState('');
  
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [avatarFile, setAvatarFile] = useState(null);
  const [profileForm, setProfileForm] = useState({ name: userInfo?.name || '', phone: userInfo?.phone || '' });

  const fetchMyOrders = async () => {
    try {
      const t = new Date().getTime();
      const response = await axios.get(`https://datquang-backend.onrender.com/users/${userInfo.user_id}/orders/customer?t=${t}`);
      setMyOrders(response.data);
    } catch (error) { console.error(error); }
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true); await fetchMyOrders(); setTimeout(() => setLoading(false), 500);
    };
    loadData();

    let ws;
    const connectWebSocket = () => {
      ws = new WebSocket(`wss://datquang-backend.onrender.com/ws/${userInfo.user_id}/${userInfo.role}`);
      ws.onopen = () => console.log("🟢 [Radar Khách] Đã kết nối Bất tử!");
      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.event === 'status_changed') fetchMyOrders();
      };
      ws.onclose = () => { setTimeout(connectWebSocket, 3000); };
    };
    connectWebSocket();
    return () => { if (ws) { ws.onclose = null; ws.close(); } };
  }, [userInfo.user_id, userInfo.role]);

  useEffect(() => {
    const interval = setInterval(() => fetchMyOrders(), 5000);
    return () => clearInterval(interval);
  }, []);

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    try {
      let updatedUser = { ...userInfo };
      const resProfile = await axios.put(`https://datquang-backend.onrender.com/users/${userInfo.user_id}/profile`, profileForm);
      updatedUser = { ...updatedUser, ...resProfile.data };
      if (avatarFile) {
        const formData = new FormData(); formData.append("file", avatarFile);
        const resAvatar = await axios.post(`https://datquang-backend.onrender.com/users/${userInfo.user_id}/avatar`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
        updatedUser.avatar_url = resAvatar.data.avatar_url;
      }
      localStorage.setItem('userInfo', JSON.stringify(updatedUser)); window.location.reload(); 
    } catch (error) { setActionMessage("❌ Lỗi cập nhật hồ sơ!"); }
  };

  const handleLogout = () => { localStorage.removeItem('userInfo'); navigate('/'); };

  const getStatusBadge = (status) => {
    switch(status) {
      case 'pending': return <Badge bg="secondary" className="shadow-sm p-2">Đang tìm tài xế</Badge>;
      case 'accepted': return <Badge bg="info" className="shadow-sm p-2">Tài xế đang đến</Badge>;
      case 'picking_up': return <Badge bg="warning" text="dark" className="shadow-sm p-2">Đã lấy hàng</Badge>;
      case 'delivering': return <Badge bg="primary" className="shadow-sm p-2">Đang giao hàng</Badge>;
      case 'completed': return <Badge bg="success" className="shadow-sm p-2">Đã hoàn thành</Badge>;
      case 'cancel_requested': return <Badge bg="danger" className="shadow-sm p-2">Yêu cầu hủy</Badge>;
      case 'cancelled': return <Badge bg="dark" className="shadow-sm p-2">Đã hủy</Badge>;
      default: return <Badge bg="light" text="dark" className="shadow-sm p-2">{status}</Badge>;
    }
  };

  if (loading) return <DashboardSkeleton />;

  return (
    <Container className="mt-5 mb-5" style={{ maxWidth: '900px', position: 'relative', zIndex: 1 }}>
      
      {/* HEADER THỦY TINH */}
      <div className="glass-card p-4 mb-4 border-top border-primary border-4">
        <div className="d-flex justify-content-between align-items-center flex-wrap">
          <div className="d-flex align-items-center mb-3 mb-md-0">
            {userInfo.avatar_url ? (
              <img src={userInfo.avatar_url} alt="avt" style={{width: '70px', height: '70px', borderRadius: '50%', objectFit: 'cover', marginRight: '15px', border: '3px solid rgba(13, 110, 253, 0.5)'}} />
            ) : <div style={{width: '70px', height: '70px', borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: '15px', fontSize: '30px', backdropFilter: 'blur(5px)'}}>👤</div>}
            <div>
              <h4 className="mb-1 fw-bold text-dark">Xin chào, {userInfo.name}!</h4>
              <Badge bg="primary" className="fs-6 shadow-sm">KHÁCH HÀNG</Badge>
            </div>
          </div>
          <div className="d-flex gap-2">
            <Button variant="outline-primary" className="glass-btn" onClick={() => setShowProfileModal(true)}>✏️ Hồ sơ</Button>
            <Button variant="outline-danger" className="glass-btn text-danger fw-bold border-danger" onClick={handleLogout}>Đăng xuất</Button>
          </div>
        </div>
      </div>
        
      {actionMessage && <Alert variant={actionMessage.includes('❌') ? 'danger' : 'success'} className="glass-card fw-bold">{actionMessage}</Alert>}
        
      <div>
        {/* NÚT ĐẶT ĐƠN KHỔNG LỒ */}
        <Button 
            size="lg" 
            className="glass-btn-primary w-100 fw-bold mb-5 shadow-lg d-flex justify-content-center align-items-center gap-2" 
            style={{ height: '70px', fontSize: '1.2rem', borderRadius: '20px' }}
            onClick={() => navigate('/booking')}
        >
            <span className="fs-3">+</span> ĐẶT ĐƠN HÀNG MỚI
        </Button>

        <h4 className="fw-bold text-dark mb-4" style={{ textShadow: '0 2px 4px rgba(255,255,255,0.8)' }}>Lịch sử đơn hàng của tôi</h4>
        
        {myOrders.length === 0 ? (
            <div className="glass-card p-5 text-center text-muted fw-bold border-dashed fs-5">
                Chưa có đơn hàng nào. Hãy đặt ngay một cuốc xe nhé!
            </div>
        ) : (
            <div className="d-flex flex-column gap-3">
              {myOrders.map(order => (
                <div key={order.id} className="glass-card p-4 border-start border-4 border-primary shadow-sm d-flex justify-content-between align-items-center flex-wrap">
                  <div className="mb-3 mb-md-0">
                    <h5 className="fw-bold text-dark mb-2">Mã Đơn: <span className="text-primary">#{order.id}</span></h5>
                    <div className="d-flex align-items-center gap-2">
                        <span className="text-muted fw-bold">Trạng thái: </span>
                        {getStatusBadge(order.status)}
                    </div>
                  </div>
                  <Button variant="outline-primary" className="glass-btn fw-bold px-4 py-2" onClick={() => navigate(`/order/${order.id}`)}>
                      👁️ Xem chi tiết đơn
                  </Button>
                </div>
              ))}
            </div>
        )}
      </div>

      {/* MODAL CẬP NHẬT HỒ SƠ */}
      <Modal show={showProfileModal} onHide={() => setShowProfileModal(false)} centered contentClassName="glass-card border-0">
        <Modal.Header closeButton className="border-bottom border-light">
            <Modal.Title className="fw-bold text-dark">Hồ Sơ Cá Nhân</Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleUpdateProfile}>
          <Modal.Body>
            <Form.Group className="mb-3"><Form.Label className="fw-bold">Họ và Tên</Form.Label><Form.Control type="text" className="glass-input" value={profileForm.name} onChange={(e) => setProfileForm({...profileForm, name: e.target.value})} required /></Form.Group>
            <Form.Group className="mb-3"><Form.Label className="fw-bold">Số điện thoại</Form.Label><Form.Control type="tel" className="glass-input" value={profileForm.phone} onChange={(e) => setProfileForm({...profileForm, phone: e.target.value})} /></Form.Group>
            <Form.Group className="mb-3"><Form.Label className="fw-bold">Ảnh đại diện (Tải từ máy)</Form.Label><Form.Control type="file" className="glass-input" accept="image/*" onChange={(e) => setAvatarFile(e.target.files[0])} /></Form.Group>
          </Modal.Body>
          <Modal.Footer className="border-top border-light">
              <Button variant="secondary" className="glass-btn" onClick={() => setShowProfileModal(false)}>Hủy</Button>
              <Button variant="primary" type="submit" className="glass-btn-primary">Lưu thay đổi</Button>
          </Modal.Footer>
        </Form>
      </Modal>

      <SupportWidget userInfo={userInfo} />
    </Container>
  );
}