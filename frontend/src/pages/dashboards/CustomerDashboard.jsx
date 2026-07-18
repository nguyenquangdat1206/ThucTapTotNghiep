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
      case 'pending': return <Badge bg="secondary" className="px-3 py-2">Đang tìm tài xế</Badge>;
      case 'accepted': return <Badge bg="info" className="px-3 py-2 text-dark">Tài xế đang đến</Badge>;
      case 'arrived_pickup': return <Badge bg="primary" className="px-3 py-2">Đã tới điểm lấy</Badge>; /* <-- ĐÃ BỔ SUNG DÒNG NÀY */
      case 'picking_up': return <Badge bg="warning" className="px-3 py-2 text-dark">Đã lấy hàng</Badge>;
      case 'delivering': return <Badge style={{backgroundColor: 'var(--brand-orange)'}} className="px-3 py-2 text-white">Đang giao hàng</Badge>;
      case 'completed': return <Badge bg="success" className="px-3 py-2">Đã hoàn thành</Badge>;
      case 'cancel_requested': return <Badge bg="danger" className="px-3 py-2">Yêu cầu hủy</Badge>;
      case 'cancelled': return <Badge bg="dark" className="px-3 py-2 border border-secondary">Đã hủy</Badge>;
      default: return <Badge bg="light" className="px-3 py-2 text-dark">{status}</Badge>;
    }
  };

  if (loading) return <DashboardSkeleton />;

  const activeOrders = myOrders.filter(o => ['pending', 'accepted', 'arrived_pickup', 'picking_up', 'delivering'].includes(o.status));

  return (
    <Container fluid className="py-5" style={{ backgroundColor: 'var(--bg-main)', minHeight: '100vh' }}>
      <Container style={{ maxWidth: '900px' }}>
        
        {/* HEADER DARK FOREST */}
        <div className="d-flex justify-content-between align-items-center mb-5 pb-3 border-bottom" style={{ borderColor: 'var(--border-color)' }}>
          <div className="d-flex align-items-center">
            {userInfo.avatar_url ? (
              <img src={userInfo.avatar_url} alt="avt" style={{width: '60px', height: '60px', borderRadius: '12px', objectFit: 'cover', marginRight: '15px', border: '2px solid var(--border-color)'}} />
            ) : <div style={{width: '60px', height: '60px', borderRadius: '12px', backgroundColor: 'var(--bg-card)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: '15px', fontSize: '24px', border: '1px solid var(--border-color)'}}>👤</div>}
            <div>
              <p className="text-muted mb-0" style={{fontSize: '14px'}}>Xin chào,</p>
              <h4 className="fw-bold text-white mb-0">{userInfo.name} 👋</h4>
            </div>
          </div>
          <div className="d-flex gap-2">
            <Button variant="outline-light" style={{borderColor: 'var(--border-color)', color: 'var(--text-muted)'}} onClick={() => setShowProfileModal(true)}>Hồ sơ</Button>
            <Button variant="outline-danger" className="fw-bold" onClick={handleLogout}>Thoát</Button>
          </div>
        </div>
          
        {actionMessage && <Alert variant={actionMessage.includes('❌') ? 'danger' : 'success'} className="logistics-card border-0 fw-bold">{actionMessage}</Alert>}
          
        {/* NÚT ĐẶT ĐƠN KHỔNG LỒ (CALL TO ACTION) */}
        <div className="logistics-card p-4 mb-5 text-center" style={{ border: '1px solid var(--brand-orange)' }}>
            <h4 className="text-white fw-bold mb-2">Bạn đang muốn giao gì hôm nay?</h4>
            <p className="text-muted mb-4">Giao nhanh xe máy, thuê tải chở hàng hay book container đi tỉnh.</p>
            <Button className="btn-orange w-100 py-3 fs-5" onClick={() => navigate('/booking')}>
                + TẠO VẬN ĐƠN MỚI NGAY
            </Button>
        </div>

        {/* THẺ ĐƠN ĐANG CHẠY (NỔI BẬT NẾU CÓ) */}
        {activeOrders.length > 0 && (
          <div className="mb-5">
            <h5 className="fw-bold text-white mb-3 d-flex align-items-center gap-2">
              <span className="spinner-grow spinner-grow-sm text-primary" style={{color: 'var(--brand-orange) !important'}}></span>
              Đơn hàng đang hoạt động
            </h5>
            {activeOrders.map(order => (
              <div key={order.id} className="logistics-card p-4 mb-3" style={{ borderLeft: '4px solid var(--brand-orange)' }}>
                <div className="d-flex justify-content-between align-items-center flex-wrap">
                  <div className="mb-3 mb-md-0">
                    <h6 className="fw-bold text-white mb-2">Vận đơn <span style={{color: 'var(--brand-orange)'}}>#{order.id}</span></h6>
                    <div>{getStatusBadge(order.status)}</div>
                  </div>
                  <Button variant="outline-light" className="fw-bold" style={{borderColor: 'var(--brand-orange)', color: 'var(--brand-orange)'}} onClick={() => navigate(`/order/${order.id}`)}>
                      Theo dõi trực tiếp 📍
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        <h5 className="fw-bold text-white mb-3">Lịch sử giao dịch</h5>
        
        {myOrders.filter(o => !['pending', 'accepted', 'arrived_pickup', 'picking_up', 'delivering'].includes(o.status)).length === 0 ? (
            <div className="logistics-card p-5 text-center text-muted fw-bold border-dashed fs-6" style={{ borderStyle: 'dashed' }}>
                Chưa có lịch sử chuyến đi nào hoàn tất.
            </div>
        ) : (
            <div className="d-flex flex-column gap-3">
              {myOrders.filter(o => !['pending', 'accepted', 'arrived_pickup', 'picking_up', 'delivering'].includes(o.status)).map(order => (
                <div key={order.id} className="logistics-card p-3 d-flex justify-content-between align-items-center flex-wrap">
                  <div className="mb-2 mb-md-0">
                    <strong className="text-white">Mã Đơn: #{order.id}</strong>
                    <div className="mt-2">{getStatusBadge(order.status)}</div>
                  </div>
                  <Button variant="outline-secondary" size="sm" className="fw-bold text-muted border-0" onClick={() => navigate(`/order/${order.id}`)}>
                      Xem chi tiết &rarr;
                  </Button>
                </div>
              ))}
            </div>
        )}

        {/* MODAL CẬP NHẬT HỒ SƠ */}
        <Modal show={showProfileModal} onHide={() => setShowProfileModal(false)} centered contentClassName="logistics-card border-0">
          <Modal.Header closeButton className="border-bottom" style={{borderColor: 'var(--border-color)'}}>
              <Modal.Title className="fw-bold text-white">Hồ Sơ Cá Nhân</Modal.Title>
          </Modal.Header>
          <Form onSubmit={handleUpdateProfile}>
            <Modal.Body className="p-4">
              <Form.Group className="mb-3">
                <Form.Label className="text-muted fw-bold" style={{fontSize: '13px'}}>HỌ VÀ TÊN</Form.Label>
                <Form.Control type="text" className="logistics-input" value={profileForm.name} onChange={(e) => setProfileForm({...profileForm, name: e.target.value})} required />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label className="text-muted fw-bold" style={{fontSize: '13px'}}>SỐ ĐIỆN THOẠI</Form.Label>
                <Form.Control type="tel" className="logistics-input" value={profileForm.phone} onChange={(e) => setProfileForm({...profileForm, phone: e.target.value})} />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label className="text-muted fw-bold" style={{fontSize: '13px'}}>ẢNH ĐẠI DIỆN</Form.Label>
                <Form.Control type="file" className="logistics-input" accept="image/*" onChange={(e) => setAvatarFile(e.target.files[0])} />
              </Form.Group>
            </Modal.Body>
            <Modal.Footer className="border-top" style={{borderColor: 'var(--border-color)'}}>
                <Button variant="outline-secondary" className="text-muted border-0" onClick={() => setShowProfileModal(false)}>Hủy</Button>
                <Button type="submit" className="btn-orange px-4">Lưu thay đổi</Button>
            </Modal.Footer>
          </Form>
        </Modal>

        <SupportWidget userInfo={userInfo} />
      </Container>
    </Container>
  );
}