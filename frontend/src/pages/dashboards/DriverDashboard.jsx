import React, { useState, useEffect } from 'react';
import { Container, Button, Alert, Badge, Modal, Form } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import DashboardSkeleton from '../../components/DashboardSkeleton';
import SupportWidget from '../../components/SupportWidget';

export default function DriverDashboard({ userInfo }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [pendingOrders, setPendingOrders] = useState([]);
  const [myOrders, setMyOrders] = useState([]); 
  const [actionMessage, setActionMessage] = useState('');
  const [userBalance, setUserBalance] = useState(0); 

  const [showUrgentPopup, setShowUrgentPopup] = useState(false);
  const [urgentOrder, setUrgentOrder] = useState(null);
  const [audioInstance, setAudioInstance] = useState(null);
  
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [avatarFile, setAvatarFile] = useState(null);
  const [profileForm, setProfileForm] = useState({ name: userInfo?.name || '', phone: userInfo?.phone || '', license_plate: userInfo?.license_plate || '' });

  const [isReady, setIsReady] = useState(() => {
    const stored = localStorage.getItem(`driver_ready_${userInfo?.user_id}`);
    return stored !== 'false'; 
  });

  const fetchData = async () => {
    try {
      const t = new Date().getTime();
      const resBalance = await axios.get(`https://datquang-backend.onrender.com/users/${userInfo.user_id}?t=${t}`);
      setUserBalance(resBalance.data.balance);
      const resPending = await axios.get(`https://datquang-backend.onrender.com/orders/pending?t=${t}`);
      setPendingOrders(resPending.data);
      const resMy = await axios.get(`https://datquang-backend.onrender.com/users/${userInfo.user_id}/orders/driver?t=${t}`);
      setMyOrders(resMy.data.order_history); 
    } catch (error) { console.error(error); }
  };

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await fetchData();
      axios.put(`https://datquang-backend.onrender.com/driver/${userInfo.user_id}/toggle_ready?is_ready=${isReady}`).catch(e=>e);
      setTimeout(() => setLoading(false), 600);
    };
    init();

    let ws;
    const connectWebSocket = () => {
      ws = new WebSocket(`wss://datquang-backend.onrender.com/ws/${userInfo.user_id}/${userInfo.role}`);
      ws.onopen = () => console.log("🟢 [Radar Tài xế] Đã kết nối Bất tử!");
      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.event === 'user_banned') { localStorage.removeItem('userInfo'); navigate('/'); return; }
        if (data.event === 'urgent_order_alert' && data.target_role === userInfo.role) {
             setUrgentOrder(data.order); 
             setShowUrgentPopup(true);
             const audio = new Audio("https://actions.google.com/sounds/v1/alarms/beep_short.ogg");
             audio.loop = true; audio.play().catch(e=>e); setAudioInstance(audio); 
        }
        fetchData(); 
      };
      ws.onclose = () => { setTimeout(connectWebSocket, 3000); };
    };
    connectWebSocket();
    return () => { if (ws) { ws.onclose = null; ws.close(); } };
  }, [userInfo.user_id, userInfo.role, isReady]);

  useEffect(() => {
    if (!isReady) return;
    const interval = setInterval(() => { fetchData(); }, 5000);
    return () => clearInterval(interval);
  }, [isReady]);

  const handleToggleReady = async () => {
    const newState = !isReady;
    try {
      await axios.put(`https://datquang-backend.onrender.com/driver/${userInfo.user_id}/toggle_ready?is_ready=${newState}`);
      setIsReady(newState); localStorage.setItem(`driver_ready_${userInfo.user_id}`, newState); 
    } catch(e) {}
  };

  const handleAcceptOrder = async (orderId) => {
    try {
      await axios.put(`https://datquang-backend.onrender.com/orders/${orderId}/accept?driver_id=${userInfo.user_id}`);
      setActionMessage(`🎉 Nhận thành công đơn!`); fetchData();
    } catch (error) { setActionMessage(`❌ Lỗi hoặc đơn đã bị nhận!`); }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    try {
      let updatedUser = { ...userInfo };
      const resProfile = await axios.put(`https://datquang-backend.onrender.com/users/${userInfo.user_id}/profile`, profileForm);
      updatedUser = { ...updatedUser, ...resProfile.data };
      if (avatarFile) {
        const formData = new FormData(); formData.append("file", avatarFile);
        const resAvatar = await axios.post(`https://datquang-backend.onrender.com/users/${userInfo.user_id}/avatar`, formData, { headers: { 'Content-Type': 'multipart/form-data' }});
        updatedUser.avatar_url = resAvatar.data.avatar_url;
      }
      localStorage.setItem('userInfo', JSON.stringify(updatedUser)); window.location.reload(); 
    } catch (error) { setActionMessage("❌ Lỗi cập nhật hồ sơ!"); }
  };

  const stopAlertSound = () => { if (audioInstance) { audioInstance.pause(); setAudioInstance(null); } };
  const handleLogout = () => { stopAlertSound(); localStorage.removeItem('userInfo'); navigate('/'); };

  const getStatusBadge = (status) => {
    switch(status) {
      case 'pending': return <Badge bg="secondary">Đang tìm tài xế</Badge>;
      case 'accepted': return <Badge bg="info">Tài xế đang đến</Badge>;
      case 'arrived_pickup': return <Badge bg="primary">Đã tới điểm lấy</Badge>;
      case 'picking_up': return <Badge bg="warning" text="dark">Đã lấy hàng</Badge>;
      case 'delivering': return <Badge bg="danger">Đã tới điểm giao</Badge>;
      case 'completed': return <Badge bg="success">Đã hoàn thành</Badge>;
      case 'cancel_requested': return <Badge bg="danger">Yêu cầu hủy</Badge>;
      case 'cancelled': return <Badge bg="dark">Đã hủy</Badge>;
      default: return <Badge bg="light" text="dark">{status}</Badge>;
    }
  };

  if (loading) return <DashboardSkeleton />;

  const groupedPendingOrders = Object.values(pendingOrders.reduce((acc, order) => {
    if (order.batch_id) {
        if (!acc[order.batch_id]) acc[order.batch_id] = { ...order, is_batch: true, total_price: 0, ids: [] };
        acc[order.batch_id].total_price += order.price; acc[order.batch_id].ids.push(order.id);
    } else { acc[order.id] = { ...order, total_price: order.price, ids: [order.id] }; }
    return acc;
  }, {}));

  const groupedMyOrders = Object.values(myOrders.reduce((acc, order) => {
    if (order.batch_id) {
        if (!acc[order.batch_id]) acc[order.batch_id] = { ...order, is_batch: true, ids: [] };
        else {
            const statusPriority = { 'pending': 1, 'accepted': 2, 'arrived_pickup': 3, 'picking_up': 4, 'delivering': 5, 'cancel_requested': 6, 'completed': 7, 'cancelled': 8 };
            const currentPrio = statusPriority[acc[order.batch_id].status] || 7;
            const newPrio = statusPriority[order.status] || 7;
            if (newPrio < currentPrio) acc[order.batch_id].status = order.status;
        }
        acc[order.batch_id].ids.push(order.id);
    } else { acc[order.id] = { ...order, is_batch: false, ids: [order.id] }; }
    return acc;
  }, {}));

  return (
    <Container className="mt-5 mb-5" style={{ position: 'relative', zIndex: 1 }}>
      
      {/* HEADER THỦY TINH */}
      <div className="glass-card p-4 mb-4 border-top border-success border-4">
        <div className="d-flex justify-content-between align-items-center flex-wrap">
          <div className="d-flex align-items-center mb-3 mb-md-0">
            {userInfo.avatar_url ? (
              <img src={userInfo.avatar_url} alt="avatar" style={{width: '70px', height: '70px', borderRadius: '50%', objectFit: 'cover', marginRight: '15px', border: '3px solid rgba(25, 135, 84, 0.5)'}} />
            ) : <div style={{width: '70px', height: '70px', borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: '15px', fontSize: '30px', backdropFilter: 'blur(5px)'}}>🛵</div>}
            
            <div>
              <h4 className="mb-1 fw-bold text-dark">Xin chào, {userInfo.name}!</h4>
              <div className="d-flex align-items-center mt-2 flex-wrap gap-2">
                <Badge bg={userInfo.role.startsWith('pending') ? "warning" : "info"} text="dark" className="fs-6 shadow-sm">
                  {userInfo.role === 'driver_express' ? 'TÀI XẾ XE MÁY' : 'TÀI XẾ CONTAINER'}
                </Badge>
                <Button variant="success" size="sm" className="glass-btn-primary px-3 shadow-sm" onClick={() => navigate('/wallet')}>💰 Ví: {userBalance.toLocaleString()} đ</Button>
                <div className="glass-card px-3 py-1 shadow-sm d-flex align-items-center" style={{ borderLeft: isReady ? '4px solid #198754' : '4px solid #dc3545' }}>
                  <Form.Check type="switch" id="driver-ready-switch" label={isReady ? "🟢 Đang nhận đơn" : "🔴 Nghỉ ngơi"} checked={isReady} onChange={handleToggleReady} className={`fw-bold mb-0 ${isReady ? 'text-success' : 'text-danger'}`} />
                </div>
              </div>
            </div>
          </div>
          <div className="d-flex gap-2">
            <Button variant="outline-dark" className="glass-btn" onClick={() => setShowProfileModal(true)}>✏️ Hồ sơ</Button>
            <Button variant="outline-danger" className="glass-btn text-danger fw-bold border-danger" onClick={handleLogout}>Đăng xuất</Button>
          </div>
        </div>
      </div>

      {!isReady && (
        <Alert variant="danger" className="glass-card text-center shadow-sm fw-bold border-danger border-start border-4 mt-3 p-3">
          <h4 className="mb-2 text-danger">😴 BẠN ĐANG TRONG TRẠNG THÁI NGHỈ NGƠI!</h4>
          <span className="text-dark">Hệ thống phân đơn Radar đã bị vô hiệu hóa. Bạn sẽ không nhận được đơn hàng mới nào.</span>
        </Alert>
      )}
      
      {actionMessage && <Alert variant={actionMessage.includes('❌') ? 'danger' : 'success'} className="glass-card fw-bold">{actionMessage}</Alert>}
      
      <div className="mt-4">
        <h4 className="fw-bold text-dark mb-3" style={{ textShadow: '0 2px 4px rgba(255,255,255,0.8)' }}>📡 Radar: Đơn hàng quanh đây</h4>
        
        {!isReady ? (
          <div className="glass-card p-5 text-center shadow-sm border-danger border-2" style={{ borderStyle: 'dashed !important' }}>
            <div className="fs-1 mb-2">📡 ❌</div>
            <h5 className="text-danger fw-bold">Radar đã bị ngắt kết nối</h5>
          </div>
        ) : groupedPendingOrders.length === 0 ? (
          <div className="glass-card p-4 text-center text-muted fw-bold">Không có đơn nào mới quanh bạn.</div>
        ) : (
          <div className="d-flex flex-column gap-3">
            {groupedPendingOrders.map((order, idx) => (
              <div key={idx} className="glass-card p-4 border-start border-4 border-warning shadow-sm transition-hover">
                <div className="d-flex justify-content-between align-items-center flex-wrap">
                  <div className="mb-3 mb-md-0">
                    <h5 className="fw-bold mb-2">
                      {order.is_batch ? <Badge bg="danger" className="fs-6 shadow-sm">📦 GHÉP BATCH</Badge> : <span className="text-primary">Đơn #{order.id}</span>}
                    </h5>
                    <div className="text-dark fs-6" style={{ maxWidth: '600px' }}>
                      {order.is_batch ? (
                        <span className="fw-bold text-danger">📍 Lộ trình ghép (Nhiều điểm Lấy / Giao)</span>
                      ) : (
                        <>
                          <div className="mb-1"><strong>📍 Lấy:</strong> {order.pickup_location}</div>
                          <div><strong>🚩 Giao:</strong> {order.dropoff_location}</div>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="text-end">
                    <h3 className="text-success fw-bold mb-3" style={{ textShadow: '1px 1px 2px rgba(255,255,255,0.8)' }}>{order.total_price.toLocaleString()} đ</h3>
                    <div className="d-flex gap-2 justify-content-end">
                        <Button variant="outline-primary" className="glass-btn px-4" onClick={() => navigate(`/order/${order.ids[0]}`)}>👁️ Xem</Button>
                        <Button variant="success" className="glass-btn-primary px-4" onClick={() => handleAcceptOrder(order.ids[0])}>🤝 Nhận Cuốc</Button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <h4 className="fw-bold text-dark mt-5 mb-3" style={{ textShadow: '0 2px 4px rgba(255,255,255,0.8)' }}>🏍️ Cuốc xe của tôi</h4>
        {groupedMyOrders.length === 0 ? (
          <div className="glass-card p-4 text-center text-muted fw-bold">Bạn chưa nhận cuốc nào.</div>
        ) : (
          <div className="d-flex flex-column gap-3">
            {groupedMyOrders.map((order, idx) => (
              <div key={idx} className="glass-card p-3 border-start border-4 border-info shadow-sm d-flex justify-content-between align-items-center flex-wrap">
                <div className="mb-2 mb-md-0">
                  <h5 className="fw-bold mb-2">
                    {order.is_batch ? <Badge bg="danger" className="shadow-sm">📦 CHUYẾN GHÉP ({order.ids.length} ĐƠN)</Badge> : <span className="text-dark">Đơn #{order.id}</span>}
                  </h5>
                  <div>{getStatusBadge(order.status)}</div>
                </div>
                <Button variant="info" className="glass-btn text-primary border-info fw-bold px-4" onClick={() => navigate(`/order/${order.ids[0]}`)}>🧭 Mở Lộ Trình</Button>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal show={showProfileModal} onHide={() => setShowProfileModal(false)} centered contentClassName="glass-card border-0">
        <Modal.Header closeButton className="border-bottom border-light">
            <Modal.Title className="fw-bold text-dark">Hồ Sơ Cá Nhân</Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleUpdateProfile}>
          <Modal.Body>
            <Form.Group className="mb-3"><Form.Label className="fw-bold">Họ và Tên</Form.Label><Form.Control type="text" className="glass-input" value={profileForm.name} onChange={(e) => setProfileForm({...profileForm, name: e.target.value})} required /></Form.Group>
            <Form.Group className="mb-3"><Form.Label className="fw-bold">Số điện thoại</Form.Label><Form.Control type="tel" className="glass-input" value={profileForm.phone} onChange={(e) => setProfileForm({...profileForm, phone: e.target.value})} /></Form.Group>
            <Form.Group className="mb-3"><Form.Label className="fw-bold">Biển số</Form.Label><Form.Control type="text" className="glass-input" value={profileForm.license_plate} onChange={(e) => setProfileForm({...profileForm, license_plate: e.target.value})} required /></Form.Group>
            <Form.Group className="mb-3"><Form.Label className="fw-bold">Ảnh đại diện</Form.Label><Form.Control type="file" className="glass-input" accept="image/*" onChange={(e) => setAvatarFile(e.target.files[0])} /></Form.Group>
          </Modal.Body>
          <Modal.Footer className="border-top border-light">
              <Button variant="secondary" className="glass-btn" onClick={() => setShowProfileModal(false)}>Hủy</Button>
              <Button variant="success" type="submit" className="glass-btn-primary">Lưu thay đổi</Button>
          </Modal.Footer>
        </Form>
      </Modal>

      <Modal show={showUrgentPopup} onHide={() => {}} backdrop="static" centered size="lg" contentClassName="glass-card border-danger border-4">
         <Modal.Header className="bg-danger text-white text-center d-block border-0 rounded-top" style={{ opacity: 0.9 }}>
             <Modal.Title className="fw-bold fs-3">🚨 HỆ THỐNG PHÂN ĐƠN! 🚨</Modal.Title>
         </Modal.Header>
         <Modal.Body className="p-5 text-center">
            {urgentOrder && (
              <div>
                <p className="fs-4 text-dark fw-bold mb-4">📍 {urgentOrder.pickup} <br/><br/>⬇️<br/><br/>🚩 {urgentOrder.dropoff}</p>
                <div className="text-success fw-bold" style={{ fontSize: '3rem', textShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                    {(urgentOrder.price * 0.8).toLocaleString()} đ
                </div>
                <div className="text-danger fw-bold mt-3 fs-5">{urgentOrder.details}</div>
              </div>
            )}
         </Modal.Body>
         <Modal.Footer className="justify-content-center border-0 pb-4">
           <Button variant="success" size="lg" className="glass-btn-primary fw-bold px-5 py-3 fs-4 shadow-lg" onClick={() => { stopAlertSound(); setShowUrgentPopup(false); handleAcceptOrder(urgentOrder?.id); }}>
               🤝 NHẬN CUỐC NGAY
           </Button>
         </Modal.Footer>
      </Modal>
      <SupportWidget userInfo={userInfo} />
    </Container>
  );
}