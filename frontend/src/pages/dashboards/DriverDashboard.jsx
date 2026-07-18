import React, { useState, useEffect } from 'react';
import { Container, Button, Alert, Badge, Modal, Form, Row, Col } from 'react-bootstrap';
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
    <Container fluid className="py-5" style={{ backgroundColor: 'var(--bg-main)', minHeight: '100vh' }}>
      <Container style={{ maxWidth: '900px' }}>
        
        {/* HEADER DRIVER */}
        <div className="logistics-card p-4 mb-4 d-flex justify-content-between align-items-center flex-wrap">
          <div className="d-flex align-items-center mb-3 mb-md-0">
            {userInfo.avatar_url ? (
              <img src={userInfo.avatar_url} alt="avatar" style={{width: '65px', height: '60px', borderRadius: '12px', objectFit: 'cover', marginRight: '15px'}} />
            ) : <div style={{width: '60px', height: '60px', borderRadius: '12px', backgroundColor: 'var(--bg-input)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: '15px', fontSize: '24px', border: '1px solid var(--border-color)'}}>🛵</div>}
            <div>
              <h5 className="mb-1 fw-bold text-white">{userInfo.name}</h5>
              <div className="d-flex align-items-center gap-2">
                <Badge bg="dark" className="border border-secondary text-white">
                  {userInfo.role === 'driver_express' ? 'XE MÁY' : 'CONTAINER'}
                </Badge>
                <Badge bg="success" className="px-2 cursor-pointer" onClick={() => navigate('/wallet')}>💰 {userBalance.toLocaleString()}đ</Badge>
              </div>
            </div>
          </div>
          <div className="d-flex gap-2">
            <Button variant="outline-light" style={{borderColor: 'var(--border-color)'}} onClick={() => setShowProfileModal(true)}>Hồ sơ</Button>
            <Button variant="outline-danger" onClick={handleLogout}>Thoát</Button>
          </div>
        </div>

        {/* CÔNG TẮC TRỰC TUYẾN / NGOẠI TUYẾN CHUYÊN NGHIỆP */}
        <div className="logistics-card p-4 mb-4 text-center">
            <h6 className="text-muted text-uppercase fw-bold mb-3">TRẠNG THÁI HOẠT ĐỘNG</h6>
            <div className="d-flex justify-content-center">
                <Button 
                    className={`fw-bold px-5 py-2 ${isReady ? 'btn-orange' : 'btn-secondary text-white'}`}
                    style={{ borderRadius: '30px', border: 'none', minWidth: '250px', backgroundColor: isReady ? 'var(--brand-orange)' : '#333' }}
                    onClick={handleToggleReady}
                >
                    {isReady ? '🟢 ĐANG NHẬN ĐƠN (ONLINE)' : '😴 ĐANG NGHỈ NGƠI (OFFLINE)'}
                </Button>
            </div>
            {!isReady && <small className="text-danger d-block mt-3 fw-bold">Hệ thống phân đơn Radar đang tạm dừng!</small>}
        </div>
        
        {actionMessage && <Alert variant={actionMessage.includes('❌') ? 'danger' : 'success'} className="logistics-card border-0 fw-bold">{actionMessage}</Alert>}
        
        {/* RADAR QUÉT ĐƠN HÀNG */}
        <div className="mt-5">
          <h5 className="fw-bold text-white mb-3 d-flex align-items-center gap-2">
             <span className="fs-5">📡</span> ĐƠN HÀNG MỚI XUNG QUANH
          </h5>
          
          {!isReady ? (
            <div className="logistics-card p-5 text-center text-muted fw-bold border-dashed" style={{ borderStyle: 'dashed' }}>
              Vui lòng bật trạng thái Đang Nhận Đơn để quét chuyến.
            </div>
          ) : groupedPendingOrders.length === 0 ? (
            <div className="logistics-card p-4 text-center text-muted fw-bold">
              Chưa có tín hiệu đơn hàng mới...
            </div>
          ) : (
            <div className="d-flex flex-column gap-3">
              {groupedPendingOrders.map((order, idx) => (
                <div key={idx} className="logistics-card p-4" style={{ borderLeft: '4px solid #4ADE80' }}>
                  <div className="d-flex justify-content-between align-items-center flex-wrap">
                    <div className="mb-3 mb-md-0" style={{ maxWidth: '600px' }}>
                      <h6 className="fw-bold text-white mb-2">
                        {order.is_batch ? <Badge bg="danger" className="me-2">📦 GHÉP BATCH</Badge> : <span className="text-muted me-2">Mã: #{order.id}</span>}
                      </h6>
                      <div className="text-muted fs-6">
                        {order.is_batch ? (
                          <span className="fw-bold text-white">📍 Chuyến đi nhiều trạm (Ghép lộ trình)</span>
                        ) : (
                          <>
                            <div className="mb-1"><strong>📍 Điểm lấy:</strong> <span className="text-white">{order.pickup_location}</span></div>
                            <div><strong>🚩 Điểm giao:</strong> <span className="text-white">{order.dropoff_location}</span></div>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="text-end">
                      <h3 className="fw-bold mb-3" style={{ color: '#4ADE80' }}>{order.total_price.toLocaleString()} đ</h3>
                      <div className="d-flex gap-2 justify-content-end">
                          <Button variant="outline-light" style={{borderColor: 'var(--border-color)'}} onClick={() => navigate(`/order/${order.ids[0]}`)}>Chi tiết</Button>
                          <Button className="btn-orange px-4" onClick={() => handleAcceptOrder(order.ids[0])}>🤝 CHỐT ĐƠN</Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <h5 className="fw-bold text-white mt-5 mb-3">🏍️ CHUYẾN ĐI CỦA TÔI</h5>
          {groupedMyOrders.length === 0 ? (
            <div className="logistics-card p-4 text-center text-muted fw-bold">Bạn chưa nhận chuyến xe nào.</div>
          ) : (
            <div className="d-flex flex-column gap-3">
              {groupedMyOrders.map((order, idx) => (
                <div key={idx} className="logistics-card overflow-hidden p-0 shadow-sm">
                  
                  {/* THANH TRÊN CÙNG: MÃ ĐƠN & GIÁ */}
                  <div className="p-3 border-bottom d-flex justify-content-between align-items-center" style={{ borderColor: 'var(--border-color)', backgroundColor: 'rgba(255,255,255,0.02)' }}>
                    <h5 className="text-danger fw-bold mb-0" style={{ letterSpacing: '1px' }}>
                      {order.is_batch ? `📦 GHÉP-${order.ids[0]}` : `${order.id}`}
                    </h5>
                    <div className="d-flex align-items-center gap-2">
                       <span className="text-warning fw-bold fs-5">{order.total_price?.toLocaleString() || order.price?.toLocaleString()}đ</span>
                       <span className="text-muted" style={{fontSize: '12px'}}>🚚 Delivery</span>
                    </div>
                  </div>
                  
                  {/* CHI TIẾT ĐIỂM LẤY / GIAO (MÔ PHỎNG SHOPEEFOOD) */}
                  <div className="p-3 position-relative">
                     {/* Thanh nối dọc */}
                     <div className="position-absolute" style={{ left: '23px', top: '32px', bottom: '45px', width: '2px', backgroundColor: 'var(--border-color)', zIndex: 1 }}></div>
                     
                     {/* ĐIỂM LẤY */}
                     <div className="d-flex mb-4 position-relative" style={{ zIndex: 2 }}>
                        <div className="me-3 mt-1">
                           <div style={{width:'14px', height:'14px', borderRadius:'50%', backgroundColor:'#FF4D4D', border:'2px solid var(--bg-card)'}}></div>
                        </div>
                        <div className="flex-grow-1">
                           <div className="d-flex justify-content-between align-items-start mb-1">
                               <div className="text-muted fw-bold">
                                  Lấy: <span className="text-white">{order.sender_name || (order.is_batch ? 'Nhiều điểm lấy' : 'Người gửi')}</span>
                               </div>
                           </div>
                           <div className="text-white mb-2" style={{fontSize: '14.5px', lineHeight: '1.4'}}>
                              {order.pickup_location || order.pickup || 'Xem chi tiết trong lộ trình'}
                           </div>
                           <Button size="sm" variant="outline-danger" className="fw-bold px-3 py-1" style={{ borderRadius: '4px' }} onClick={() => navigate(`/order/${order.ids[0]}`)}>
                              Lấy ngay
                           </Button>
                        </div>
                     </div>

                     {/* ĐIỂM GIAO */}
                     <div className="d-flex position-relative" style={{ zIndex: 2 }}>
                        <div className="me-3 mt-1">
                           <div style={{width:'14px', height:'14px', borderRadius:'50%', backgroundColor:'#4ADE80', border:'2px solid var(--bg-card)'}}></div>
                        </div>
                        <div className="flex-grow-1">
                           <div className="d-flex justify-content-between align-items-start mb-1">
                               <div className="text-muted fw-bold">
                                  Giao: <span className="text-white">{order.receiver_name || (order.is_batch ? 'Nhiều điểm giao' : 'Người nhận')}</span>
                               </div>
                           </div>
                           <div className="text-white mb-2" style={{fontSize: '14.5px', lineHeight: '1.4'}}>
                              {order.dropoff_location || order.dropoff || 'Xem chi tiết trong lộ trình'}
                           </div>
                           <Button size="sm" variant="outline-success" className="fw-bold px-3 py-1" style={{ color: '#4ADE80', borderColor: '#4ADE80', borderRadius: '4px' }} onClick={() => navigate(`/order/${order.ids[0]}`)}>
                              Giao ngay
                           </Button>
                        </div>
                     </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* MODAL CẬP NHẬT HỒ SƠ */}
        <Modal show={showProfileModal} onHide={() => setShowProfileModal(false)} centered contentClassName="logistics-card border-0">
          <Modal.Header closeButton className="border-bottom" style={{borderColor: 'var(--border-color)'}}>
              <Modal.Title className="fw-bold text-white">Hồ Sơ Đối Tác</Modal.Title>
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
                <Form.Label className="text-muted fw-bold" style={{fontSize: '13px'}}>BIỂN SỐ XE</Form.Label>
                <Form.Control type="text" className="logistics-input text-uppercase" value={profileForm.license_plate} onChange={(e) => setProfileForm({...profileForm, license_plate: e.target.value})} required />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label className="text-muted fw-bold" style={{fontSize: '13px'}}>ẢNH ĐẠI DIỆN</Form.Label>
                <Form.Control type="file" className="logistics-input" accept="image/*" onChange={(e) => setAvatarFile(e.target.files[0])} />
              </Form.Group>
            </Modal.Body>
            <Modal.Footer className="border-top" style={{borderColor: 'var(--border-color)'}}>
                <Button variant="outline-secondary" className="text-muted border-0" onClick={() => setShowProfileModal(false)}>Hủy</Button>
                <Button type="submit" className="btn-orange px-4">Cập nhật hồ sơ</Button>
            </Modal.Footer>
          </Form>
        </Modal>

        {/* POPUP BÁO ĐỘNG ĐƠN KHẨN CẤP */}
        <Modal show={showUrgentPopup} onHide={() => {}} backdrop="static" centered size="lg" contentClassName="logistics-card border-0" style={{ border: '2px solid var(--brand-orange) !important', boxShadow: '0 0 30px rgba(255, 102, 51, 0.4)' }}>
           <Modal.Header className="text-center d-block border-0 rounded-top pb-0 mt-3">
               <Modal.Title className="fw-bold fs-3 text-white">🚨 CÓ ĐƠN ĐIỀU PHỐI KHẨN CẤP! 🚨</Modal.Title>
           </Modal.Header>
           <Modal.Body className="p-4 text-center">
              {urgentOrder && (
                <div className="bg-dark p-4 rounded-3 border" style={{ borderColor: 'var(--border-color)' }}>
                  <p className="fs-5 text-muted fw-bold mb-4">📍 {urgentOrder.pickup} <br/><br/><span className="text-white fs-4">⬇️</span><br/><br/>🚩 {urgentOrder.dropoff}</p>
                  <div className="fw-bold" style={{ fontSize: '3rem', color: '#4ADE80' }}>
                      {(urgentOrder.price * 0.8).toLocaleString()} đ
                  </div>
                  <div className="text-danger fw-bold mt-3 fs-5">{urgentOrder.details}</div>
                </div>
              )}
           </Modal.Body>
           <Modal.Footer className="justify-content-center border-0 pb-5 pt-0">
             <Button size="lg" className="btn-orange fw-bold px-5 py-3 fs-4 w-75" onClick={() => { stopAlertSound(); setShowUrgentPopup(false); handleAcceptOrder(urgentOrder?.id); }}>
                 🤝 NHẬN CUỐC NGAY
             </Button>
           </Modal.Footer>
        </Modal>
        
        <SupportWidget userInfo={userInfo} />
      </Container>
    </Container>
  );
}