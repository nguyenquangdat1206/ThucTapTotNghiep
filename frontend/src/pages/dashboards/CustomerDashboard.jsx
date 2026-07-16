import React, { useState, useEffect } from 'react';
import { Container, Card, Button, Table, Badge, Modal, Form, Alert } from 'react-bootstrap';
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
      // BÙA CHỐNG CACHE TRÌNH DUYỆT
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

  // BÙA AUTO-POLLING LÀM MỚI LIÊN TỤC
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
      case 'pending': return <Badge bg="secondary">Đang tìm tài xế</Badge>;
      case 'accepted': return <Badge bg="info">Tài xế đang đến</Badge>;
      case 'picking_up': return <Badge bg="warning" text="dark">Đã lấy hàng</Badge>;
      case 'delivering': return <Badge bg="primary">Đang giao hàng</Badge>;
      case 'completed': return <Badge bg="success">Đã hoàn thành</Badge>;
      case 'cancel_requested': return <Badge bg="danger">Yêu cầu hủy</Badge>;
      case 'cancelled': return <Badge bg="dark">Đã hủy</Badge>;
      default: return <Badge bg="light" text="dark">{status}</Badge>;
    }
  };

  if (loading) return <DashboardSkeleton />;

  return (
    <Container className="mt-5" style={{ maxWidth: '800px' }}>
      <Card className="shadow p-4 border-top border-primary border-4 mb-5">
        <h2 className="text-primary mb-4">Trạm Đặt Hàng</h2>
        <div className="d-flex justify-content-between align-items-center flex-wrap">
          <div className="d-flex align-items-center mb-3">
            {userInfo.avatar_url ? (
              <img src={userInfo.avatar_url} alt="avt" style={{width: '60px', height: '60px', borderRadius: '50%', objectFit: 'cover', marginRight: '15px'}} />
            ) : <div style={{width: '60px', height: '60px', borderRadius: '50%', backgroundColor: '#e9ecef', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: '15px', fontSize: '24px'}}>👤</div>}
            <div>
              <h5 className="mb-1">Xin chào: <strong>{userInfo.name}</strong></h5>
              <Badge bg="primary">KHÁCH HÀNG</Badge>
            </div>
          </div>
          <div>
            <Button variant="outline-primary" className="me-2" onClick={() => setShowProfileModal(true)}>✏️ Hồ sơ</Button>
            <Button variant="outline-danger" onClick={handleLogout}>Đăng xuất</Button>
          </div>
        </div>
        <hr />
        
        {actionMessage && <Alert variant={actionMessage.includes('❌') ? 'danger' : 'success'}>{actionMessage}</Alert>}
        
        <div className="mt-3">
          <Button variant="primary" size="lg" className="w-100 fw-bold mb-4 shadow-sm" onClick={() => navigate('/booking')}>+ ĐẶT ĐƠN HÀNG MỚI</Button>
          <h5 className="text-info fw-bold mb-3">Lịch sử đơn hàng của tôi</h5>
          <Table striped bordered hover responsive className="shadow-sm">
            <thead className="table-light"><tr><th>Mã Đơn</th><th>Trạng thái</th><th>Thao tác</th></tr></thead>
            <tbody>
              {myOrders.length === 0 ? <tr><td colSpan="3" className="text-center text-muted">Chưa có đơn hàng nào.</td></tr> : myOrders.map(order => (
                <tr key={order.id}>
                  <td><strong>#{order.id}</strong></td>
                  <td>{getStatusBadge(order.status)}</td>
                  <td><Button size="sm" variant="info" className="text-white" onClick={() => navigate(`/order/${order.id}`)}>👁️ Xem chi tiết</Button></td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      </Card>

      <Modal show={showProfileModal} onHide={() => setShowProfileModal(false)} centered>
        <Modal.Header closeButton className="bg-primary text-white"><Modal.Title>Hồ Sơ Cá Nhân</Modal.Title></Modal.Header>
        <Form onSubmit={handleUpdateProfile}>
          <Modal.Body>
            <Form.Group className="mb-3"><Form.Label>Họ và Tên</Form.Label><Form.Control type="text" value={profileForm.name} onChange={(e) => setProfileForm({...profileForm, name: e.target.value})} required /></Form.Group>
            <Form.Group className="mb-3"><Form.Label>Số điện thoại</Form.Label><Form.Control type="tel" value={profileForm.phone} onChange={(e) => setProfileForm({...profileForm, phone: e.target.value})} /></Form.Group>
            <Form.Group className="mb-3"><Form.Label>Ảnh đại diện (Tải từ máy)</Form.Label><Form.Control type="file" accept="image/*" onChange={(e) => setAvatarFile(e.target.files[0])} /></Form.Group>
          </Modal.Body>
          <Modal.Footer><Button variant="secondary" onClick={() => setShowProfileModal(false)}>Hủy</Button><Button variant="success" type="submit">Lưu</Button></Modal.Footer>
        </Form>
      </Modal>
      <SupportWidget userInfo={userInfo} />
    </Container>
  );
}