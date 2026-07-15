import React, { useState, useEffect } from 'react';
import { Container, Card, Button, Table, Alert, Badge, Row, Col, Modal, Form } from 'react-bootstrap';
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
      const resBalance = await axios.get(`https://datquang-backend.onrender.com/users/${userInfo.user_id}`);
      setUserBalance(resBalance.data.balance);
      const resPending = await axios.get('https://datquang-backend.onrender.com/orders/pending');
      setPendingOrders(resPending.data);
      const resMy = await axios.get(`https://datquang-backend.onrender.com/users/${userInfo.user_id}/orders/driver`);
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

    const ws = new WebSocket(`wss://datquang-backend.onrender.com/ws/${userInfo.user_id}/${userInfo.role}`);
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.event === 'user_banned') { localStorage.removeItem('userInfo'); navigate('/'); return; }
      if (data.event === 'urgent_order_alert') {
        setUrgentOrder(data.order); 
        setShowUrgentPopup(true);
        const audio = new Audio("https://actions.google.com/sounds/v1/alarms/beep_short.ogg");
        audio.loop = true; 
        audio.play().catch(e=>e);
        setAudioInstance(audio); 
        return;
      }
      fetchData(); // Bất kỳ sự kiện nào khác thì load lại data
    };
    return () => ws.close();
  }, [userInfo.user_id, userInfo.role]);

  const handleToggleReady = async () => {
    const newState = !isReady;
    try {
      await axios.put(`https://datquang-backend.onrender.com/driver/${userInfo.user_id}/toggle_ready?is_ready=${newState}`);
      setIsReady(newState);
      localStorage.setItem(`driver_ready_${userInfo.user_id}`, newState); 
    } catch(e) { console.error(e); }
  };

  const handleAcceptOrder = async (orderId) => {
    try {
      await axios.put(`https://datquang-backend.onrender.com/orders/${orderId}/accept?driver_id=${userInfo.user_id}`);
      setActionMessage(`🎉 Nhận thành công đơn!`);
    } catch (error) { 
      const errorMsg = error.response?.data?.detail || "Lỗi mạng hoặc đơn đã bị nhận!";
      setActionMessage(`❌ ${errorMsg}`);
    }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    try {
      let updatedUser = { ...userInfo };
      const resProfile = await axios.put(`https://datquang-backend.onrender.com/users/${userInfo.user_id}/profile`, profileForm);
      updatedUser = { ...updatedUser, ...resProfile.data };

      if (avatarFile) {
        const formData = new FormData();
        formData.append("file", avatarFile);
        const resAvatar = await axios.post(`https://datquang-backend.onrender.com/users/${userInfo.user_id}/avatar`, formData, { headers: { 'Content-Type': 'multipart/form-data' }});
        updatedUser.avatar_url = resAvatar.data.avatar_url;
      }
      localStorage.setItem('userInfo', JSON.stringify(updatedUser));
      window.location.reload(); 
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
        acc[order.batch_id].total_price += order.price;
        acc[order.batch_id].ids.push(order.id);
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
    <Container className="mt-5">
      <Card className="shadow p-4 border-top border-success border-4 mb-5">
        <h2 className="text-success mb-4">Trạm Điều Phối Đơn Hàng</h2>
        <div className="d-flex justify-content-between align-items-center flex-wrap">
          <div className="d-flex align-items-center mb-3 mb-md-0">
            {userInfo.avatar_url ? (
              <img src={userInfo.avatar_url} alt="avatar" style={{width: '60px', height: '60px', borderRadius: '50%', objectFit: 'cover', marginRight: '15px', border: '2px solid #198754'}} />
            ) : <div style={{width: '60px', height: '60px', borderRadius: '50%', backgroundColor: '#e9ecef', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: '15px', fontSize: '24px'}}>🛵</div>}
            <div>
              <h5 className="mb-1">Xin chào: <strong>{userInfo.name}</strong></h5>
              <div className="d-flex align-items-center mt-2 flex-wrap gap-2">
                <Badge bg={userInfo.role.startsWith('pending') ? "warning" : "info"} text="dark">
                  {userInfo.role === 'driver_express' ? 'TÀI XẾ XE MÁY' : 'TÀI XẾ CONTAINER'}
                </Badge>
                
                <Button variant="success" size="sm" className="fw-bold px-3 rounded-pill shadow-sm" onClick={() => navigate('/wallet')}>
                  💰 Ví: {userBalance.toLocaleString()} đ
                </Button>
                
                <div className="bg-white rounded-pill px-3 py-1 shadow-sm border border-2 d-flex align-items-center" style={{borderColor: isReady ? '#198754' : '#dc3545'}}>
                  <Form.Check 
                    type="switch" id="driver-ready-switch" label={isReady ? "🟢 Đang nhận đơn" : "🔴 Đang nghỉ ngơi"}
                    checked={isReady} onChange={handleToggleReady} className={`fw-bold mb-0 ${isReady ? 'text-success' : 'text-danger'}`}
                  />
                </div>
              </div>
            </div>
          </div>
          <div>
            <Button variant="outline-primary" className="me-2" onClick={() => setShowProfileModal(true)}>✏️ Hồ sơ</Button>
            <Button variant="outline-danger" onClick={handleLogout}>Đăng xuất</Button>
          </div>
        </div>
        <hr />

        {!isReady && (
          <Alert variant="danger" className="text-center shadow-sm fw-bold border-danger border-2 mt-3 p-3">
            <h4 className="mb-2">😴 BẠN ĐANG TRONG TRẠNG THÁI NGHỈ NGƠI!</h4>
            <span>Hệ thống phân đơn Radar đã bị vô hiệu hóa. Bạn sẽ không nhận được đơn hàng mới nào.</span>
          </Alert>
        )}
        
        {actionMessage && <Alert variant={actionMessage.includes('❌') ? 'danger' : 'success'}>{actionMessage}</Alert>}
        
        <div className="mt-3">
          <h4 className="text-warning">Radar: Đơn hàng quanh đây</h4>
          {!isReady ? (
            <div className="bg-light p-4 text-center rounded shadow-sm border border-danger border-2" style={{ borderStyle: 'dashed !important' }}>
              <div className="fs-1 mb-2">📡 ❌</div>
              <h5 className="text-danger fw-bold">Radar đã bị ngắt kết nối</h5>
            </div>
          ) : groupedPendingOrders.length === 0 ? (
            <p className="text-muted">Không có đơn nào mới.</p>
          ) : (
            <Table striped bordered hover responsive>
              <thead className="table-dark"><tr><th>Chuyến</th><th>Lộ trình</th><th>Giá trị</th><th>Thao Tác</th></tr></thead>
              <tbody>
                {groupedPendingOrders.map((order, idx) => (
                  <tr key={idx}>
                    <td>{order.is_batch ? <Badge bg="danger">📦 GHÉP BATCH</Badge> : `#${order.id}`}</td>
                    <td>{order.is_batch ? <span className="fw-bold text-danger">📍 Lộ trình ghép (Nhiều điểm Lấy/Giao)</span> : `${order.pickup_location} → ${order.dropoff_location}`}</td>
                    <td className="text-success fw-bold">{order.total_price.toLocaleString()} đ</td>
                    <td>
                      <Button variant="info" size="sm" className="me-2 text-white" onClick={() => navigate(`/order/${order.ids[0]}`)}>👁️ Xem</Button>
                      <Button variant="success" size="sm" onClick={() => handleAcceptOrder(order.ids[0])}>Nhận cuốc</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}

          <h4 className="text-info mt-5">Cuốc xe của tôi</h4>
          {groupedMyOrders.length === 0 ? <p className="text-muted">Bạn chưa nhận cuốc nào.</p> : (
            <Table striped bordered hover responsive>
              <thead className="table-light"><tr><th>Chuyến</th><th>Trạng thái hiện tại</th><th>Thao tác</th></tr></thead>
              <tbody>
                {groupedMyOrders.map((order, idx) => (
                  <tr key={idx}>
                    <td>{order.is_batch ? <Badge bg="danger" className="fs-6">📦 CHUYẾN GHÉP ({order.ids.length} ĐƠN)</Badge> : <strong className="fs-6">Đơn #{order.id}</strong>}</td>
                    <td>{getStatusBadge(order.status)}</td>
                    <td><Button variant="primary" size="sm" className="fw-bold shadow-sm" onClick={() => navigate(`/order/${order.ids[0]}`)}>🧭 Mở Lộ Trình Lấy / Giao</Button></td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </div>
      </Card>

      <Modal show={showProfileModal} onHide={() => setShowProfileModal(false)} centered>
        <Modal.Header closeButton className="bg-success text-white"><Modal.Title>Hồ Sơ Cá Nhân</Modal.Title></Modal.Header>
        <Form onSubmit={handleUpdateProfile}>
          <Modal.Body>
            <Form.Group className="mb-3"><Form.Label>Họ và Tên</Form.Label><Form.Control type="text" value={profileForm.name} onChange={(e) => setProfileForm({...profileForm, name: e.target.value})} required /></Form.Group>
            <Form.Group className="mb-3"><Form.Label>Số điện thoại</Form.Label><Form.Control type="tel" value={profileForm.phone} onChange={(e) => setProfileForm({...profileForm, phone: e.target.value})} /></Form.Group>
            <Form.Group className="mb-3"><Form.Label>Biển số</Form.Label><Form.Control type="text" value={profileForm.license_plate} onChange={(e) => setProfileForm({...profileForm, license_plate: e.target.value})} required /></Form.Group>
            <Form.Group className="mb-3"><Form.Label>Ảnh đại diện (Tải từ máy)</Form.Label><Form.Control type="file" accept="image/*" onChange={(e) => setAvatarFile(e.target.files[0])} /></Form.Group>
          </Modal.Body>
          <Modal.Footer><Button variant="secondary" onClick={() => setShowProfileModal(false)}>Hủy</Button><Button variant="success" type="submit">Lưu</Button></Modal.Footer>
        </Form>
      </Modal>

      <Modal show={showUrgentPopup} onHide={() => {}} backdrop="static" centered size="lg">
         <Modal.Header className="bg-danger text-white text-center d-block"><Modal.Title>🚨 HỆ THỐNG PHÂN ĐƠN! 🚨</Modal.Title></Modal.Header>
         <Modal.Body className="p-4 text-center">
            {urgentOrder && (
              <div className="bg-light p-4 rounded border text-start fs-5">
                <p>📍 {urgentOrder.pickup} &rarr; 🚩 {urgentOrder.dropoff}</p>
                <div className="text-success fw-bold fs-2">{(urgentOrder.price * 0.8).toLocaleString()} đ</div>
              </div>
            )}
         </Modal.Body>
         <Modal.Footer className="justify-content-center">
           <Button variant="success" size="lg" onClick={() => { stopAlertSound(); setShowUrgentPopup(false); handleAcceptOrder(urgentOrder?.id); }}>🤝 NHẬN CUỐC</Button>
         </Modal.Footer>
      </Modal>
      <SupportWidget userInfo={userInfo} />
    </Container>
  );
}