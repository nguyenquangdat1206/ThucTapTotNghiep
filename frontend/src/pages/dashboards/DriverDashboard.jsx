import React, { useState, useEffect, useRef } from 'react';
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

  // --- STATE CHO POPUP NỔ ĐƠN TỰ ĐỘNG ---
  const [showIncomingPopup, setShowIncomingPopup] = useState(false);
  const [incomingOrder, setIncomingOrder] = useState(null);
  
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [avatarFile, setAvatarFile] = useState(null);
  const [profileForm, setProfileForm] = useState({ name: userInfo?.name || '', phone: userInfo?.phone || '', license_plate: userInfo?.license_plate || '' });

  const [isReady, setIsReady] = useState(() => {
    const stored = localStorage.getItem(`driver_ready_${userInfo?.user_id}`);
    return stored !== 'false'; 
  });

  // Sử dụng Refs để tránh bị stale closure (dữ liệu cũ) trong hàm fetchData
  const isReadyRef = useRef(isReady);
  const prevPendingRef = useRef([]);
  const audioRef = useRef(null);

  useEffect(() => { isReadyRef.current = isReady; }, [isReady]);

  const fetchData = async (isFirstLoad = false) => {
    try {
      const t = new Date().getTime();
      const resBalance = await axios.get(`https://datquang-backend.onrender.com/users/${userInfo.user_id}?t=${t}`);
      setUserBalance(resBalance.data.balance);
      
      const resPending = await axios.get(`https://datquang-backend.onrender.com/orders/pending?t=${t}`);
      const newPendingList = resPending.data;

      // THUẬT TOÁN QUÉT ĐƠN MỚI ĐỂ BẬT POPUP NỔ ĐƠN
      if (!isFirstLoad && isReadyRef.current) {
         const newRawOrders = newPendingList.filter(n => !prevPendingRef.current.some(p => p.id === n.id));
         
         if (newRawOrders.length > 0) {
            // Gom nhóm lại để tính giá Batch nếu có
            const grouped = Object.values(newPendingList.reduce((acc, order) => {
                const itemPrice = parseFloat(order.total_price) || parseFloat(order.original_price) || parseFloat(order.price) || 0;
                if (order.batch_id) {
                    if (!acc[order.batch_id]) acc[order.batch_id] = { ...order, is_batch: true, calculated_price: 0, ids: [] };
                    acc[order.batch_id].calculated_price += itemPrice;
                    acc[order.batch_id].ids.push(order.id);
                } else { acc[order.id] = { ...order, is_batch: false, calculated_price: itemPrice, ids: [order.id] }; }
                return acc;
            }, {}));
            
            const orderToPop = grouped.find(g => g.ids.includes(newRawOrders[0].id));
            
            if (orderToPop) {
                setIncomingOrder(orderToPop);
                setShowIncomingPopup(true);
                if (!audioRef.current) {
                    const audio = new Audio("https://actions.google.com/sounds/v1/alarms/beep_short.ogg");
                    audio.loop = true; audio.play().catch(e=>console.log(e)); 
                    audioRef.current = audio;
                }
            }
         }
      }

      prevPendingRef.current = newPendingList;
      setPendingOrders(newPendingList);

      const resMy = await axios.get(`https://datquang-backend.onrender.com/users/${userInfo.user_id}/orders/driver?t=${t}`);
      setMyOrders(resMy.data.order_history); 
    } catch (error) { console.error(error); }
  };

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await fetchData(true); // Lần đầu tải trang sẽ không nổ popup
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
        if (data.event === 'user_banned') { stopAlertSound(); localStorage.removeItem('userInfo'); navigate('/'); return; }
        // Bất kỳ sự thay đổi trạng thái nào cũng sẽ kích hoạt tải lại dữ liệu để quét đơn mới
        if (data.event === 'status_changed' || data.event === 'urgent_order_alert') {
             fetchData(false); 
        }
      };
      ws.onclose = () => { setTimeout(connectWebSocket, 3000); };
    };
    connectWebSocket();
    return () => { if (ws) { ws.onclose = null; ws.close(); stopAlertSound(); } };
  }, [userInfo.user_id, userInfo.role]);

  useEffect(() => {
    if (!isReady) return;
    const interval = setInterval(() => { fetchData(false); }, 5000);
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
      setActionMessage(`🎉 Nhận thành công đơn!`); 
      fetchData(true); // Bỏ qua quét popup khi tự bấm chốt
    } catch (error) { setActionMessage(`❌ Lỗi hoặc đơn đã bị tài xế khác nhận!`); }
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

  const stopAlertSound = () => { if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; } };
  
  const handleLogout = () => { stopAlertSound(); localStorage.removeItem('userInfo'); navigate('/'); };

  if (loading) return <DashboardSkeleton />;

  const getSafePrice = (order) => { return parseFloat(order.total_price) || parseFloat(order.original_price) || parseFloat(order.price) || 0; };

  const groupedPendingOrders = Object.values(pendingOrders.reduce((acc, order) => {
    const itemPrice = getSafePrice(order);
    if (order.batch_id) {
        if (!acc[order.batch_id]) acc[order.batch_id] = { ...order, is_batch: true, calculated_price: 0, ids: [] };
        acc[order.batch_id].calculated_price += itemPrice;
        acc[order.batch_id].ids.push(order.id);
    } else { acc[order.id] = { ...order, calculated_price: itemPrice, ids: [order.id] }; }
    return acc;
  }, {}));

  const groupedMyOrders = Object.values(myOrders.reduce((acc, order) => {
    const itemPrice = getSafePrice(order);
    if (order.batch_id) {
        if (!acc[order.batch_id]) acc[order.batch_id] = { ...order, is_batch: true, ids: [], calculated_price: 0 };
        else {
            const statusPriority = { 'pending': 1, 'accepted': 2, 'arrived_pickup': 3, 'picking_up': 4, 'delivering': 5, 'cancel_requested': 6, 'completed': 7, 'cancelled': 8 };
            const currentPrio = statusPriority[acc[order.batch_id].status] || 7;
            const newPrio = statusPriority[order.status] || 7;
            if (newPrio < currentPrio) acc[order.batch_id].status = order.status;
        }
        acc[order.batch_id].calculated_price += itemPrice;
        acc[order.batch_id].ids.push(order.id);
    } else { acc[order.id] = { ...order, is_batch: false, ids: [order.id], calculated_price: itemPrice }; }
    return acc;
  }, {}));

  return (
    <Container fluid className="py-5" style={{ backgroundColor: 'var(--bg-main)', minHeight: '100vh' }}>
      <Container style={{ maxWidth: '900px' }}>
        
        {/* HEADER DRIVER */}
        <div className="logistics-card p-4 mb-4 d-flex justify-content-between align-items-center flex-wrap" style={{ borderTop: '4px solid var(--brand-orange)' }}>
          <div className="d-flex align-items-center mb-3 mb-md-0">
            {userInfo.avatar_url ? (
              <img src={userInfo.avatar_url} alt="avatar" style={{width: '65px', height: '60px', borderRadius: '12px', objectFit: 'cover', marginRight: '15px'}} />
            ) : <div style={{width: '60px', height: '60px', borderRadius: '12px', backgroundColor: 'var(--bg-input)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: '15px', fontSize: '24px', border: '1px solid var(--border-color)'}}>🛵</div>}
            <div>
              <h5 className="mb-1 fw-bold text-white">{userInfo.name}</h5>
              <div className="d-flex align-items-center gap-2">
                <Badge bg="dark" className="border border-secondary text-white px-2 py-1">
                  {userInfo.role === 'driver_express' ? 'XE MÁY' : userInfo.role === 'driver_truck' ? 'XE TẢI' : 'CONTAINER'}
                </Badge>
                <Badge bg="success" className="px-2 py-1 cursor-pointer fw-bold border border-success" onClick={() => navigate('/wallet')}>💰 {userBalance.toLocaleString()}đ</Badge>
              </div>
            </div>
          </div>
          <div className="d-flex gap-2">
            <Button variant="outline-light" style={{borderColor: 'var(--border-color)'}} onClick={() => setShowProfileModal(true)}>Hồ sơ</Button>
            <Button variant="outline-danger" onClick={handleLogout}>Thoát</Button>
          </div>
        </div>

        {/* CÔNG TẮC TRỰC TUYẾN / NGOẠI TUYẾN */}
        <div className="logistics-card p-4 mb-4 text-center">
            <h6 className="text-muted text-uppercase fw-bold mb-3 tracking-wide" style={{ fontSize: '13px' }}>TRẠNG THÁI HOẠT ĐỘNG</h6>
            <div className="d-flex justify-content-center">
                <Button 
                    className={`fw-bold px-5 py-3 ${isReady ? 'btn-orange shadow-lg' : 'btn-secondary text-white'}`}
                    style={{ borderRadius: '30px', border: 'none', minWidth: '280px', backgroundColor: isReady ? 'var(--brand-orange)' : '#333', letterSpacing: '1px' }}
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
            <div className="logistics-card p-5 text-center text-muted fw-bold border-dashed" style={{ borderStyle: 'dashed', borderColor: 'var(--border-color) !important' }}>
              Vui lòng bật trạng thái Đang Nhận Đơn để quét chuyến.
            </div>
          ) : groupedPendingOrders.length === 0 ? (
            <div className="logistics-card p-5 text-center text-muted fw-bold">
              Chưa có tín hiệu đơn hàng mới...
            </div>
          ) : (
            <div className="d-flex flex-column gap-3">
              {groupedPendingOrders.map((order, idx) => (
                <div key={idx} className="logistics-card p-4" style={{ borderLeft: '4px solid #4ADE80' }}>
                  <div className="d-flex justify-content-between align-items-center flex-wrap">
                    <div className="mb-3 mb-md-0" style={{ maxWidth: '600px' }}>
                      <h6 className="fw-bold text-white mb-3">
                        {order.is_batch ? <Badge bg="danger" className="me-2 px-2 py-1">📦 GHÉP BATCH</Badge> : <span className="text-muted me-2">Mã: #{order.id}</span>}
                      </h6>
                      <div className="text-muted fs-6">
                        {order.is_batch ? (
                          <span className="fw-bold text-white">📍 Chuyến đi nhiều trạm (Ghép lộ trình)</span>
                        ) : (
                          <>
                            <div className="mb-2">
                               <span className="d-inline-block text-center me-2" style={{ width: '20px' }}>📍</span>
                               <span className="text-white">{order.pickup_location || order.pickup}</span>
                            </div>
                            <div>
                               <span className="d-inline-block text-center me-2" style={{ width: '20px' }}>🚩</span>
                               <span className="text-white">{order.dropoff_location || order.dropoff}</span>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="text-end mt-3 mt-md-0">
                      <h3 className="fw-bold mb-3" style={{ color: '#4ADE80' }}>{order.calculated_price.toLocaleString()} đ</h3>
                      <div className="d-flex gap-2 justify-content-end">
                          <Button variant="outline-light" style={{borderColor: 'var(--border-color)'}} onClick={() => navigate(`/order/${order.ids[0]}`)}>Chi tiết</Button>
                          <Button className="btn-orange px-4 fw-bold" onClick={() => handleAcceptOrder(order.ids[0])}>🤝 CHỐT ĐƠN</Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <h5 className="fw-bold text-white mt-5 mb-3 d-flex align-items-center gap-2">
             <span className="fs-5">🏍️</span> CHUYẾN ĐI CỦA TÔI
          </h5>
          
          {groupedMyOrders.length === 0 ? (
            <div className="logistics-card p-4 text-center text-muted fw-bold">Bạn chưa nhận chuyến xe nào.</div>
          ) : (
            <div className="d-flex flex-column gap-3">
              {groupedMyOrders.map((order, idx) => {
                const driverEarnings = order.calculated_price * 0.8;
                const pickupStr = order.pickup_address?.address_text || order.pickup_address_text || order.pickup_location || order.pickup;
                const dropoffStr = order.dropoff_address?.address_text || order.dropoff_address_text || order.dropoff_location || order.dropoff;
                
                return (
                <div 
                    key={idx} 
                    className="logistics-card overflow-hidden p-0 shadow-sm transition-hover"
                    style={{ cursor: 'pointer', border: '1px solid var(--border-color)' }}
                    onClick={() => navigate(`/order/${order.ids[0]}`)}
                    onMouseOver={(e) => e.currentTarget.style.borderColor = 'var(--brand-orange)'}
                    onMouseOut={(e) => e.currentTarget.style.borderColor = 'var(--border-color)'}
                >
                  {/* THANH TRÊN CÙNG */}
                  <div className="p-3 border-bottom" style={{ borderColor: 'var(--border-color)', backgroundColor: 'rgba(255,255,255,0.02)' }}>
                    <div className="d-flex justify-content-between align-items-center mb-1">
                      <h5 className="text-danger fw-bold mb-0" style={{ letterSpacing: '1px' }}>
                        {order.is_batch ? `📦 GHÉP-${order.ids[0]}` : `#${order.id}`}
                      </h5>
                      <div className="d-flex align-items-center gap-2">
                         <span className="text-warning fw-bold fs-6">
                           🚚 {userInfo.role === 'driver_express' ? 'Express' : userInfo.role === 'driver_truck' ? 'Truck' : 'Container'}
                         </span>
                      </div>
                    </div>
                    <div className="text-white fw-bold fs-5 mt-1">
                        {driverEarnings > 0 ? `${driverEarnings.toLocaleString()}đ` : 'Đang cập nhật giá...'}
                    </div>
                  </div>
                  
                  {/* CHI TIẾT ĐIỂM LẤY / GIAO */}
                  <div className="p-3 position-relative">
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
                           <div className="text-white mb-2 fw-bold" style={{fontSize: '14.5px', lineHeight: '1.4'}}>
                              {pickupStr || <span className="text-info fst-italic">Nhấn vào để xem tọa độ / địa chỉ ↗</span>}
                           </div>
                           <div>
                              <span className="fw-bold px-2 py-1" style={{ color: '#FF4D4D', border: '1px solid #FF4D4D', borderRadius: '4px', fontSize: '12px', backgroundColor: 'rgba(255, 77, 77, 0.1)' }}>Lấy ngay</span>
                           </div>
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
                           <div className="text-white mb-2 fw-bold" style={{fontSize: '14.5px', lineHeight: '1.4'}}>
                              {dropoffStr || <span className="text-info fst-italic">Nhấn vào để xem tọa độ / địa chỉ ↗</span>}
                           </div>
                           <div className="d-flex gap-2 align-items-center">
                              <span className="fw-bold px-2 py-1" style={{ color: '#4ADE80', border: '1px solid #4ADE80', borderRadius: '4px', fontSize: '12px', backgroundColor: 'rgba(74, 222, 128, 0.1)' }}>Giao ngay</span>
                              {order.distance && (
                                <span className="fw-bold px-2 py-1 text-muted" style={{ border: '1px solid var(--border-color)', borderRadius: '4px', fontSize: '12px', backgroundColor: 'var(--bg-input)' }}>
                                  {parseFloat(order.distance).toFixed(1)} km
                                </span>
                              )}
                           </div>
                        </div>
                     </div>
                  </div>
                </div>
              )})}
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
              <Form.Group className="mb-3"><Form.Label className="text-muted fw-bold" style={{fontSize: '13px'}}>HỌ VÀ TÊN</Form.Label><Form.Control type="text" className="logistics-input" value={profileForm.name} onChange={(e) => setProfileForm({...profileForm, name: e.target.value})} required /></Form.Group>
              <Form.Group className="mb-3"><Form.Label className="text-muted fw-bold" style={{fontSize: '13px'}}>SỐ ĐIỆN THOẠI</Form.Label><Form.Control type="tel" className="logistics-input" value={profileForm.phone} onChange={(e) => setProfileForm({...profileForm, phone: e.target.value})} /></Form.Group>
              <Form.Group className="mb-3"><Form.Label className="text-muted fw-bold" style={{fontSize: '13px'}}>BIỂN SỐ XE</Form.Label><Form.Control type="text" className="logistics-input text-uppercase" value={profileForm.license_plate} onChange={(e) => setProfileForm({...profileForm, license_plate: e.target.value})} required /></Form.Group>
              <Form.Group className="mb-3"><Form.Label className="text-muted fw-bold" style={{fontSize: '13px'}}>ẢNH ĐẠI DIỆN</Form.Label><Form.Control type="file" className="logistics-input" accept="image/*" onChange={(e) => setAvatarFile(e.target.files[0])} /></Form.Group>
            </Modal.Body>
            <Modal.Footer className="border-top" style={{borderColor: 'var(--border-color)'}}>
                <Button variant="outline-secondary" className="text-muted border-0" onClick={() => setShowProfileModal(false)}>Hủy</Button>
                <Button type="submit" className="btn-orange px-4">Cập nhật hồ sơ</Button>
            </Modal.Footer>
          </Form>
        </Modal>

        {/* MODAL NỔ ĐƠN TOÀN MÀN HÌNH MỚI */}
        <Modal show={showIncomingPopup} onHide={() => {}} backdrop="static" centered size="lg" contentClassName="border-0 bg-transparent">
           <div className="p-1 rounded-4 shadow-lg" style={{ background: 'linear-gradient(45deg, #FF4D4D, #FF6633, #4ADE80)', animation: 'pulse-border 1.5s infinite' }}>
             <div className="logistics-card p-4 p-md-5 text-center rounded-4 border-0">
               <h2 className="fw-bold mb-4 text-white" style={{ letterSpacing: '2px' }}>🚨 CÓ ĐƠN HÀNG MỚI! 🚨</h2>
               
               {incomingOrder && (
                 <div className="bg-dark p-4 rounded-3 mb-4 border" style={{ borderColor: 'var(--border-color)' }}>
                   <div className="d-flex flex-column align-items-center mb-4">
                       <div className="text-muted fw-bold mb-2">ĐIỂM LẤY HÀNG</div>
                       <h5 className="text-white fw-bold px-3">{incomingOrder.pickup || incomingOrder.pickup_location}</h5>
                       
                       <div className="my-3 text-warning fs-3">⬇</div>
                       
                       <div className="text-muted fw-bold mb-2">ĐIỂM GIAO HÀNG</div>
                       <h5 className="text-white fw-bold px-3">{incomingOrder.dropoff || incomingOrder.dropoff_location}</h5>
                   </div>
                   
                   <div className="border-top pt-4" style={{ borderColor: 'var(--border-color) !important' }}>
                      <div className="text-muted fw-bold mb-1">THU NHẬP DỰ KIẾN</div>
                      <div className="fw-bold" style={{ fontSize: '3.5rem', color: '#4ADE80', textShadow: '0 0 20px rgba(74, 222, 128, 0.4)' }}>
                          {(incomingOrder.calculated_price * 0.8).toLocaleString()} đ
                      </div>
                   </div>
                   
                   {incomingOrder.details && <div className="text-danger fw-bold mt-3 fs-6 px-3">{incomingOrder.details}</div>}
                 </div>
               )}
               
               <Row className="g-3 justify-content-center">
                 <Col xs={12} md={5}>
                    <Button variant="outline-light" size="lg" className="w-100 fw-bold py-3" style={{ borderColor: 'var(--border-color)' }} onClick={() => { stopAlertSound(); setShowIncomingPopup(false); }}>
                        BỎ QUA LẦN NÀY
                    </Button>
                 </Col>
                 <Col xs={12} md={7}>
                    <Button size="lg" className="btn-orange fw-bold py-3 w-100 fs-4 shadow-lg" onClick={() => { stopAlertSound(); setShowIncomingPopup(false); handleAcceptOrder(incomingOrder?.ids ? incomingOrder.ids[0] : incomingOrder?.id); }}>
                        🤝 NHẬN CUỐC NGAY
                    </Button>
                 </Col>
               </Row>
             </div>
           </div>
        </Modal>
        
        <SupportWidget userInfo={userInfo} />
      </Container>
    </Container>
  );
}