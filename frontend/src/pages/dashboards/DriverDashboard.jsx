import React, { useState, useEffect, useRef } from 'react';
import { Container, Button, Alert, Badge, Modal, Form, Row, Col, Nav } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import DashboardSkeleton from '../../components/DashboardSkeleton';
import SupportWidget from '../../components/SupportWidget';

// --- BỔ SUNG LEAFLET MAP ---
import 'leaflet/dist/leaflet.css';
import { MapContainer, TileLayer, Marker, Circle, Popup } from 'react-leaflet';
import L from 'leaflet';
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

// Fix lỗi mất icon mặc định của Leaflet khi dùng chung với React
let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;
// ---------------------------

export default function DriverDashboard({ userInfo }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [pendingOrders, setPendingOrders] = useState([]);
  const [myOrders, setMyOrders] = useState([]); 
  const [actionMessage, setActionMessage] = useState('');
  const [userBalance, setUserBalance] = useState(0); 

  // --- STATE TỌA ĐỘ GPS ---
  // Mặc định set ở trung tâm TP.HCM, sẽ tự cập nhật khi lấy được GPS
  const [driverLocation, setDriverLocation] = useState({ lat: 10.762622, lng: 106.660172 });

  // --- STATE CHIA TAB LỊCH SỬ ---
  const [driverTab, setDriverTab] = useState('active');

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

  const isReadyRef = useRef(isReady);
  const prevPendingRef = useRef([]);
  const audioRef = useRef(null);

  useEffect(() => { isReadyRef.current = isReady; }, [isReady]);

  // EFFECT: Lấy tọa độ GPS thật của thiết bị
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setDriverLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (error) => {
          console.error("Lỗi lấy vị trí GPS: ", error);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    }
  }, []);

  const fetchData = async (isFirstLoad = false) => {
    try {
      const t = new Date().getTime();
      const resBalance = await axios.get(`https://datquang-backend.onrender.com/users/${userInfo.user_id}?t=${t}`);
      setUserBalance(resBalance.data.balance);
      
      const resPending = await axios.get(`https://datquang-backend.onrender.com/orders/pending?t=${t}`);
      const newPendingList = resPending.data;

      if (!isFirstLoad && isReadyRef.current) {
         const newRawOrders = newPendingList.filter(n => !prevPendingRef.current.some(p => p.id === n.id));
         
         if (newRawOrders.length > 0) {
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
      await fetchData(true);
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
      fetchData(true); 
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

  const getDriverStatusBadge = (status) => {
    switch(status) {
        case 'completed': return <Badge bg="success" className="px-2 py-1 border border-success">Đã hoàn thành</Badge>;
        case 'cancelled': return <Badge bg="danger" className="px-2 py-1 border border-danger">Đã hủy</Badge>;
        case 'cancelled_timeout': return <Badge bg="dark" className="px-2 py-1 border border-warning text-warning">Hủy (Quá hạn)</Badge>;
        default: return <Badge bg="secondary" className="px-2 py-1">{status}</Badge>;
    }
  };

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

  const historyStatuses = ['completed', 'cancelled', 'cancelled_timeout'];
  const activeMyOrders = groupedMyOrders.filter(o => !historyStatuses.includes(o.status));
  const historyMyOrders = groupedMyOrders.filter(o => historyStatuses.includes(o.status));

  const renderOrderCard = (order, isHistory) => {
    const driverEarnings = order.calculated_price * 0.8;
    const pickupStr = order.pickup_address?.address_text || order.pickup_address_text || order.pickup_location || order.pickup;
    const dropoffStr = order.dropoff_address?.address_text || order.dropoff_address_text || order.dropoff_location || order.dropoff;
    
    return (
      <div 
          key={order.ids[0]} 
          className="logistics-card overflow-hidden p-0 shadow-sm transition-hover"
          style={{ cursor: 'pointer', border: '1px solid var(--border-color)', opacity: isHistory ? 0.8 : 1 }}
          onClick={() => navigate(`/order/${order.ids[0]}`)}
          onMouseOver={(e) => e.currentTarget.style.borderColor = 'var(--brand-orange)'}
          onMouseOut={(e) => e.currentTarget.style.borderColor = 'var(--border-color)'}
      >
        <div className="p-3 border-bottom" style={{ borderColor: 'var(--border-color)', backgroundColor: 'rgba(255,255,255,0.02)' }}>
          <div className="d-flex justify-content-between align-items-center mb-1">
            <h5 className={isHistory ? "text-muted fw-bold mb-0" : "text-danger fw-bold mb-0"} style={{ letterSpacing: '1px' }}>
              {order.is_batch ? `📦 GHÉP-${order.ids[0]}` : `#${order.id}`}
            </h5>
            <div className="d-flex align-items-center gap-2">
                {isHistory ? getDriverStatusBadge(order.status) : (
                   <span className="text-warning fw-bold fs-6">
                     🚚 {userInfo.role === 'driver_express' ? 'Express' : userInfo.role === 'driver_truck' ? 'Truck' : 'Container'}
                   </span>
                )}
            </div>
          </div>
          <div className="text-white fw-bold fs-5 mt-1">
              {driverEarnings > 0 ? `${driverEarnings.toLocaleString()}đ` : 'Đang cập nhật giá...'}
          </div>
        </div>
        
        <div className="p-3 position-relative">
           <div className="position-absolute" style={{ left: '23px', top: '32px', bottom: '45px', width: '2px', backgroundColor: 'var(--border-color)', zIndex: 1 }}></div>
           
           <div className="d-flex mb-4 position-relative" style={{ zIndex: 2 }}>
              <div className="me-3 mt-1">
                 <div style={{width:'14px', height:'14px', borderRadius:'50%', backgroundColor: isHistory ? '#555' : '#FF4D4D', border:'2px solid var(--bg-card)'}}></div>
              </div>
              <div className="flex-grow-1">
                 <div className="d-flex justify-content-between align-items-start mb-1">
                     <div className="text-muted fw-bold">
                        Lấy: <span className={isHistory ? "text-muted" : "text-white"}>{order.sender_name || (order.is_batch ? 'Nhiều điểm lấy' : 'Người gửi')}</span>
                     </div>
                 </div>
                 <div className={isHistory ? "text-muted mb-2 fw-bold" : "text-white mb-2 fw-bold"} style={{fontSize: '14.5px', lineHeight: '1.4'}}>
                    {pickupStr || <span className="text-info fst-italic">Nhấn vào để xem tọa độ / địa chỉ ↗</span>}
                 </div>
                 {!isHistory && (
                    <div>
                        <span className="fw-bold px-2 py-1" style={{ color: '#FF4D4D', border: '1px solid #FF4D4D', borderRadius: '4px', fontSize: '12px', backgroundColor: 'rgba(255, 77, 77, 0.1)' }}>Lấy ngay</span>
                    </div>
                 )}
              </div>
           </div>

           <div className="d-flex position-relative" style={{ zIndex: 2 }}>
              <div className="me-3 mt-1">
                 <div style={{width:'14px', height:'14px', borderRadius:'50%', backgroundColor: isHistory ? '#555' : '#4ADE80', border:'2px solid var(--bg-card)'}}></div>
              </div>
              <div className="flex-grow-1">
                 <div className="d-flex justify-content-between align-items-start mb-1">
                     <div className="text-muted fw-bold">
                        Giao: <span className={isHistory ? "text-muted" : "text-white"}>{order.receiver_name || (order.is_batch ? 'Nhiều điểm giao' : 'Người nhận')}</span>
                     </div>
                 </div>
                 <div className={isHistory ? "text-muted mb-2 fw-bold" : "text-white mb-2 fw-bold"} style={{fontSize: '14.5px', lineHeight: '1.4'}}>
                    {dropoffStr || <span className="text-info fst-italic">Nhấn vào để xem tọa độ / địa chỉ ↗</span>}
                 </div>
                 <div className="d-flex gap-2 align-items-center">
                    {!isHistory && (
                        <span className="fw-bold px-2 py-1" style={{ color: '#4ADE80', border: '1px solid #4ADE80', borderRadius: '4px', fontSize: '12px', backgroundColor: 'rgba(74, 222, 128, 0.1)' }}>Giao ngay</span>
                    )}
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
    );
  };

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

        {/* BẢN ĐỒ RADAR 1.5KM (Chỉ hiện khi Online) */}
        {isReady && (
          <div className="logistics-card p-3 mb-4" style={{ border: '1px solid var(--border-color)', borderRadius: '16px', overflow: 'hidden' }}>
            <h6 className="fw-bold text-white mb-3 d-flex align-items-center gap-2">
              <span className="fs-5" style={{ animation: 'pulse 2s infinite' }}>📡</span> RADAR QUÉT ĐƠN (1.5KM)
            </h6>
            
            <div style={{ height: '250px', width: '100%', borderRadius: '12px', overflow: 'hidden' }}>
              <MapContainer 
                key={`${driverLocation.lat}-${driverLocation.lng}`} // Ép render lại khi có GPS mới
                center={[driverLocation.lat, driverLocation.lng]} 
                zoom={14} 
                style={{ height: '100%', width: '100%' }}
                zoomControl={false}
              >
                <TileLayer
                  url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                  attribution='&copy; <a href="https://carto.com/">CARTO</a>'
                />
                
                <Marker position={[driverLocation.lat, driverLocation.lng]}>
                  <Popup className="fw-bold text-center text-dark">
                    Vị trí hiện tại của bạn <br/> Đang phát sóng tìm đơn...
                  </Popup>
                </Marker>
                
                <Circle 
                  center={[driverLocation.lat, driverLocation.lng]} 
                  radius={1500} 
                  pathOptions={{ 
                    color: '#FF6633', 
                    fillColor: '#FF6633', 
                    fillOpacity: 0.15, 
                    weight: 2, 
                    dashArray: '5, 5' 
                  }} 
                />
              </MapContainer>
            </div>
          </div>
        )}
        
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

          {/* KHU VỰC TABS CHUYẾN ĐI (CHIA ĐANG CHẠY & LỊCH SỬ) */}
          <div className="d-flex justify-content-between align-items-center mt-5 mb-3">
            <h5 className="fw-bold text-white mb-0 d-flex align-items-center gap-2">
               <span className="fs-5">🏍️</span> CHUYẾN ĐI CỦA TÔI
            </h5>
            <Nav variant="pills" className="gap-2" activeKey={driverTab} onSelect={(k) => setDriverTab(k)}>
              <Nav.Item>
                <Nav.Link eventKey="active" className={`fw-bold px-3 py-1 ${driverTab === 'active' ? 'btn-orange text-white' : 'text-muted border'}`} style={{ borderRadius: '20px', borderColor: 'var(--border-color)', fontSize: '13px' }}>Đang chạy</Nav.Link>
              </Nav.Item>
              <Nav.Item>
                <Nav.Link eventKey="history" className={`fw-bold px-3 py-1 ${driverTab === 'history' ? 'btn-orange text-white' : 'text-muted border'}`} style={{ borderRadius: '20px', borderColor: 'var(--border-color)', fontSize: '13px' }}>Lịch sử</Nav.Link>
              </Nav.Item>
            </Nav>
          </div>
          
          {/* RENDER DỮ LIỆU DỰA THEO TAB */}
          {driverTab === 'active' && (
             activeMyOrders.length === 0 ? (
               <div className="logistics-card p-4 text-center text-muted fw-bold">Bạn chưa nhận chuyến xe nào.</div>
             ) : (
               <div className="d-flex flex-column gap-3">
                 {activeMyOrders.map((order, idx) => renderOrderCard(order, false))}
               </div>
             )
          )}

          {driverTab === 'history' && (
             historyMyOrders.length === 0 ? (
               <div className="logistics-card p-4 text-center text-muted fw-bold">Chưa có dữ liệu lịch sử chuyến đi.</div>
             ) : (
               <div className="d-flex flex-column gap-3">
                 {historyMyOrders.map((order, idx) => renderOrderCard(order, true))}
               </div>
             )
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

        {/* MODAL NỔ ĐƠN TOÀN MÀN HÌNH */}
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