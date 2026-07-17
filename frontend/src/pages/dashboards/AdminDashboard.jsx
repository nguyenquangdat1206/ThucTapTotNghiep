import React, { useState, useEffect, useRef } from 'react';
import { Container, Card, Button, Table, Badge, Row, Col, Nav, Modal, Form, Alert, InputGroup, ListGroup } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import RevenueChart from '../../components/RevenueChart'; 
import DashboardSkeleton from '../../components/DashboardSkeleton'; 

export default function AdminDashboard({ userInfo }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [myOrders, setMyOrders] = useState([]); 
  const [usersList, setUsersList] = useState([]); 
  const [promotions, setPromotions] = useState([]); 
  const [adminTab, setAdminTab] = useState('orders'); 
  const [actionMessage, setActionMessage] = useState('');
  
  const [adminTotalRevenue, setAdminTotalRevenue] = useState(0);
  const [adminPlatformProfit, setAdminPlatformProfit] = useState(0); 

  const [showProfileModal, setShowProfileModal] = useState(false);
  const [avatarFile, setAvatarFile] = useState(null);
  const [profileForm, setProfileForm] = useState({ name: userInfo?.name || '', phone: userInfo?.phone || '' });

  const [showPromoModal, setShowPromoModal] = useState(false);
  const [promoForm, setPromoForm] = useState({
    code: '', discount_value: '', discount_type: 'fixed_amount', min_order_value: 0, usage_limit: 100
  });

  const [supportUsers, setSupportUsers] = useState([]);
  const [selectedSupportUserId, setSelectedSupportUserId] = useState(null);
  const [supportMessages, setSupportMessages] = useState([]);
  const [supportInput, setSupportInput] = useState('');
  const supportEndRef = useRef(null);

  const selectedUserRef = useRef(selectedSupportUserId);
  useEffect(() => {
    selectedUserRef.current = selectedSupportUserId;
  }, [selectedSupportUserId]);

  const fetchData = async () => {
    try {
      const resOrders = await axios.get('https://datquang-backend.onrender.com/admin/orders');
      setMyOrders(resOrders.data);
      const resUsers = await axios.get('https://datquang-backend.onrender.com/admin/users');
      setUsersList(resUsers.data);
      const resPromos = await axios.get('https://datquang-backend.onrender.com/admin/promotions');
      setPromotions(resPromos.data);
      const resSupport = await axios.get('https://datquang-backend.onrender.com/admin/support/users');
      setSupportUsers(resSupport.data);

      const completed = resOrders.data.filter(o => o.status === 'completed');
      setAdminTotalRevenue(completed.reduce((sum, o) => sum + o.price, 0));
      setAdminPlatformProfit(completed.reduce((sum, o) => sum + (o.price - (o.driver_payout !== null ? o.driver_payout : (o.price * 0.8))), 0));
    } catch (error) { console.error(error); }
  };

  const loadSupportChat = async (userId) => {
    setSelectedSupportUserId(userId);
    try {
      const res = await axios.get(`https://datquang-backend.onrender.com/support/${userId}/messages`);
      setSupportMessages(res.data);
    } catch(e) {}
  };

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await fetchData();
      setTimeout(() => setLoading(false), 500);
    };
    init();

    let ws;
    let pingInterval;
    let reconnectTimeout;

    const connectWebSocket = () => {
      ws = new WebSocket(`wss://datquang-backend.onrender.com/ws/${userInfo.user_id}/${userInfo.role}`);

      ws.onopen = () => {
        pingInterval = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "ping_keep_alive" }));
          }
        }, 30000);
      };

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.event === 'status_changed') fetchData(); 
        if (data.event === 'bad_review_alert') {
           alert(`🚨 CẢNH BÁO NGHIÊM TRỌNG:\n\nTài xế #${data.driver_id} vừa bị khách hàng đánh giá 1 SAO ở đơn hàng #${data.order_id}!\n\n💬 Lời nhắn của khách: "${data.feedback}"`);
        }
        if (data.event === 'admin_support_alert') {
            alert(`🎧 CSKH: Người dùng #${data.user_id} đang cần hỗ trợ từ Admin!`);
            fetchData();
        }
        if (data.event === 'new_support_msg') {
            fetchData(); 
            if (selectedUserRef.current) loadSupportChat(selectedUserRef.current);
        }
      };

      ws.onclose = () => {
        clearInterval(pingInterval);
        reconnectTimeout = setTimeout(connectWebSocket, 3000);
      };
    };

    connectWebSocket();

    return () => {
      clearInterval(pingInterval);
      clearTimeout(reconnectTimeout);
      if (ws) { ws.onclose = null; ws.close(); }
    };
  }, [userInfo.user_id, userInfo.role]);

  useEffect(() => { supportEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [supportMessages]);

  const handleCreatePromo = async (e) => {
    e.preventDefault();
    try {
      await axios.post('https://datquang-backend.onrender.com/admin/promotions', {
        ...promoForm,
        code: promoForm.code.toUpperCase(),
        discount_value: parseFloat(promoForm.discount_value),
        min_order_value: parseFloat(promoForm.min_order_value),
        usage_limit: parseInt(promoForm.usage_limit)
      });
      setActionMessage("✅ Tạo mã khuyến mãi thành công!");
      setShowPromoModal(false);
      setPromoForm({code: '', discount_value: '', discount_type: 'fixed_amount', min_order_value: 0, usage_limit: 100});
      fetchData();
    } catch (error) {
      setActionMessage("❌ " + (error.response?.data?.detail || "Lỗi tạo mã!"));
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

  const handleToggleUserActive = async (userId, userEmail, currentStatus) => {
    let reason = "";
    if (currentStatus) {
      reason = window.prompt(`Khóa tài khoản ${userEmail}.\nNhập lý do:`, "Vi phạm chính sách nền tảng");
      if (reason === null) return; 
    } else {
      if (!window.confirm(`Mở khóa cho tài khoản ${userEmail}?`)) return;
    }
    try { await axios.put(`https://datquang-backend.onrender.com/admin/users/${userId}/toggle_active`, { reason }); fetchData(); } 
    catch (error) { setActionMessage("❌ Lỗi khi thay đổi trạng thái!"); }
  };

  const handleApproveDriver = async (userId, name) => {
    if (!window.confirm(`Xác nhận DUYỆT hồ sơ tài xế: ${name}?`)) return;
    try { await axios.put(`https://datquang-backend.onrender.com/admin/users/${userId}/approve_driver`); fetchData(); } catch (e) {}
  };

  const handleRejectDriver = async (userId, name) => {
    if (!window.confirm(`TỪ CHỐI và xóa hồ sơ tài xế: ${name}?`)) return;
    try { await axios.delete(`https://datquang-backend.onrender.com/admin/users/${userId}/reject_driver`); fetchData(); } catch (e) {}
  };

  const handleAdminApproveCancel = async (orderId) => {
    if (!window.confirm(`Xác nhận ĐỒNG Ý HỦY đơn hàng #${orderId}?`)) return;
    try { await axios.put(`https://datquang-backend.onrender.com/orders/${orderId}/status?status=cancelled`); setActionMessage(`✅ Đã hủy đơn #${orderId}`); fetchData(); } catch (e) {}
  };

  const handleAdminRejectCancel = async (orderId) => {
    if (!window.confirm(`Từ chối yêu cầu hủy và đưa đơn #${orderId} về Chờ Tài Xế?`)) return;
    try { await axios.put(`https://datquang-backend.onrender.com/orders/${orderId}/status?status=pending`); setActionMessage(`ℹ️ Đã từ chối hủy đơn #${orderId}.`); fetchData(); } catch (e) {}
  };

  const handleSendSupport = async (e) => {
    e.preventDefault();
    if (!supportInput.trim() || !selectedSupportUserId) return;
    try {
      await axios.post('https://datquang-backend.onrender.com/support/messages', { user_id: selectedSupportUserId, sender_type: "admin", content: supportInput });
      setSupportInput(''); loadSupportChat(selectedSupportUserId);
    } catch(e) {}
  };

  const handleLogout = () => { localStorage.removeItem('userInfo'); navigate('/'); };

  const getStatusBadge = (status) => {
    switch(status) {
      case 'pending': return <Badge bg="secondary" className="shadow-sm p-2">Đang tìm tài xế</Badge>;
      case 'accepted': return <Badge bg="info" className="shadow-sm p-2">Tài xế đang đến</Badge>;
      case 'arrived_pickup': return <Badge bg="primary" className="shadow-sm p-2">Đã tới điểm lấy</Badge>;
      case 'picking_up': return <Badge bg="warning" text="dark" className="shadow-sm p-2">Đã lấy hàng</Badge>;
      case 'delivering': return <Badge bg="danger" className="shadow-sm p-2">Đã tới điểm giao</Badge>;
      case 'completed': return <Badge bg="success" className="shadow-sm p-2">Đã hoàn thành</Badge>;
      case 'cancel_requested': return <Badge bg="danger" className="shadow-sm p-2 text-uppercase fw-bold border border-white">Yêu cầu hủy</Badge>;
      case 'cancelled': return <Badge bg="dark" className="shadow-sm p-2">Đã hủy</Badge>;
      default: return <Badge bg="light" text="dark">{status}</Badge>;
    }
  };

  if (loading) return <DashboardSkeleton />;

  const adminTotalOrders = myOrders.length;
  const adminCompletedOrders = myOrders.filter(o => o.status === 'completed');
  const pendingDriversList = usersList.filter(u => u.role.startsWith('pending_'));
  const activeUsersList = usersList.filter(u => !u.role.startsWith('pending_'));

  return (
    <Container className="mt-5 mb-5" style={{ maxWidth: '1200px', position: 'relative', zIndex: 1 }}>
      
      {/* HEADER THỦY TINH */}
      <div className="glass-card p-4 mb-4 border-top border-danger border-4 shadow-sm">
        <div className="d-flex justify-content-between align-items-center flex-wrap">
          <div className="d-flex align-items-center mb-3 mb-md-0">
            {userInfo.avatar_url ? (
              <img src={userInfo.avatar_url} alt="avatar" style={{width: '70px', height: '70px', borderRadius: '50%', objectFit: 'cover', marginRight: '15px', border: '3px solid rgba(220, 53, 69, 0.5)'}} />
            ) : <div style={{width: '70px', height: '70px', borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: '15px', fontSize: '30px', backdropFilter: 'blur(5px)'}}>👑</div>}
            <div>
              <h4 className="mb-1 fw-bold text-dark">Xin chào, {userInfo.name}!</h4>
              <div className="d-flex gap-2 mt-2">
                 <Badge bg="danger" className="fs-6 shadow-sm">SUPER ADMIN</Badge>
                 <Button variant="warning" size="sm" className="glass-btn text-dark fw-bold px-3 shadow-sm border-warning" onClick={() => navigate('/wallet')}>💳 Quản lý Ví Đối Tác</Button>
              </div>
            </div>
          </div>
          <div className="d-flex gap-2">
            <Button variant="outline-primary" className="glass-btn" onClick={() => setShowProfileModal(true)}>✏️ Hồ sơ</Button>
            <Button variant="outline-danger" className="glass-btn text-danger fw-bold border-danger" onClick={handleLogout}>Đăng xuất</Button>
          </div>
        </div>
      </div>
        
      {actionMessage && <Alert variant={actionMessage.includes('❌') ? 'danger' : 'success'} className="glass-card fw-bold shadow-sm">{actionMessage}</Alert>}
        
      <div>
            {/* 4 KHỐI THỐNG KÊ THỦY TINH */}
            <Row className="mb-4 g-3">
              <Col md={3}>
                <div className="glass-card p-4 text-center h-100 shadow-sm" style={{ borderBottom: '4px solid #0d6efd' }}>
                  <h6 className="text-muted fw-bold mb-3 text-uppercase">Tổng Đơn Hàng</h6>
                  <h2 className="text-primary fw-bold mb-0" style={{ fontSize: '2.5rem' }}>{adminTotalOrders}</h2>
                </div>
              </Col>
              <Col md={3}>
                <div className="glass-card p-4 text-center h-100 shadow-sm" style={{ borderBottom: '4px solid #198754' }}>
                  <h6 className="text-muted fw-bold mb-3 text-uppercase">Đã Hoàn Thành</h6>
                  <h2 className="text-success fw-bold mb-0" style={{ fontSize: '2.5rem' }}>{adminCompletedOrders.length}</h2>
                </div>
              </Col>
              <Col md={3}>
                <div className="glass-card p-4 text-center h-100 shadow-sm" style={{ borderBottom: '4px solid #6c757d' }}>
                  <h6 className="text-muted fw-bold mb-3 text-uppercase">Tổng Dòng Tiền</h6>
                  <h3 className="text-dark fw-bold mb-0">{adminTotalRevenue.toLocaleString()} đ</h3>
                </div>
              </Col>
              <Col md={3}>
                <div className="glass-card p-4 text-center h-100 shadow-lg" style={{ background: 'rgba(255, 193, 7, 0.2)', borderBottom: '4px solid #dc3545' }}>
                  <h6 className="text-dark fw-bold mb-3 text-uppercase">Lợi Nhuận Hệ Thống</h6>
                  <h3 className="text-danger fw-bold mb-0">{adminPlatformProfit.toLocaleString()} đ</h3>
                </div>
              </Col>
            </Row>

            {/* TAB ĐIỀU HƯỚNG BẰNG KÍNH */}
            <div className="glass-card mb-4 p-2 shadow-sm">
                <Nav variant="pills" className="justify-content-center" activeKey={adminTab} onSelect={(k) => setAdminTab(k)}>
                <Nav.Item><Nav.Link eventKey="orders" className={`fw-bold text-uppercase px-4 ${adminTab === 'orders' ? 'bg-primary text-white shadow-sm' : 'text-dark'}`} style={{ borderRadius: '15px' }}>🛒 Quản Lý Đơn</Nav.Link></Nav.Item>
                <Nav.Item><Nav.Link eventKey="users" className={`fw-bold text-uppercase px-4 ${adminTab === 'users' ? 'bg-success text-white shadow-sm' : 'text-dark'}`} style={{ borderRadius: '15px' }}>👥 Người Dùng</Nav.Link></Nav.Item>
                <Nav.Item><Nav.Link eventKey="promotions" className={`fw-bold text-uppercase px-4 ${adminTab === 'promotions' ? 'bg-danger text-white shadow-sm' : 'text-danger'}`} style={{ borderRadius: '15px' }}>🎁 Khuyến Mãi</Nav.Link></Nav.Item>
                <Nav.Item><Nav.Link eventKey="cskh" className={`fw-bold text-uppercase px-4 ${adminTab === 'cskh' ? 'bg-info text-white shadow-sm' : 'text-info'}`} style={{ borderRadius: '15px' }}>🎧 Hỗ Trợ CSKH</Nav.Link></Nav.Item>
                </Nav>
            </div>

            {/* KHUNG NỘI DUNG CHÍNH TRONG SUỐT */}
            <div className="glass-card p-4 shadow-sm" style={{ minHeight: '500px' }}>
                {adminTab === 'orders' && (
                <div className="table-responsive">
                    <Table hover className="bg-transparent align-middle mb-0">
                        <thead className="bg-white bg-opacity-50">
                            <tr>
                                <th className="py-3 text-dark fw-bold border-bottom-0">Mã Đơn</th>
                                <th className="py-3 text-dark fw-bold border-bottom-0">Mã BATCH</th>
                                <th className="py-3 text-dark fw-bold border-bottom-0">Khách hàng</th>
                                <th className="py-3 text-dark fw-bold border-bottom-0">Tài Xế</th>
                                <th className="py-3 text-dark fw-bold border-bottom-0">Cước phí</th>
                                <th className="py-3 text-dark fw-bold border-bottom-0">Trạng thái</th>
                                <th className="py-3 text-dark fw-bold border-bottom-0 text-center">Thao tác</th>
                            </tr>
                        </thead>
                        <tbody>
                            {myOrders.map(order => (
                            <tr key={order.id} className={order.status === 'cancel_requested' ? 'bg-danger bg-opacity-25 border-danger border-2' : 'bg-white bg-opacity-25'}>
                                <td className="py-3 fw-bold text-dark">#{order.id}</td>
                                <td>{order.batch_id ? <Badge bg="danger" className="text-wrap shadow-sm" style={{maxWidth:'100px'}}>{order.batch_id}</Badge> : <span className="text-muted fst-italic">Đơn lẻ</span>}</td>
                                <td className="fw-bold text-secondary">ID: #{order.customer_id}</td>
                                <td>{order.driver_id ? <span className="text-primary fw-bold">ID: #{order.driver_id}</span> : <span className="text-muted fst-italic">Chưa có</span>}</td>
                                <td className="fw-bold text-success fs-6">{order.price.toLocaleString()} đ</td>
                                <td>{getStatusBadge(order.status)}</td>
                                <td className="text-center">
                                <Button size="sm" variant="info" className="glass-btn text-primary border-info fw-bold me-2" onClick={() => navigate(`/order/${order.id}`)}>👁️ Mở Đơn</Button>
                                {order.status === 'cancel_requested' && (
                                    <>
                                        <Button size="sm" variant="success" className="glass-btn-primary fw-bold me-2 shadow-sm" onClick={() => handleAdminApproveCancel(order.id)}>✅ Duyệt Hủy</Button>
                                        <Button size="sm" variant="danger" className="glass-btn text-danger border-danger fw-bold shadow-sm" onClick={() => handleAdminRejectCancel(order.id)}>❌ Từ chối</Button>
                                    </>
                                )}
                                </td>
                            </tr>
                            ))}
                        </tbody>
                    </Table>
                </div>
                )}

                {adminTab === 'users' && (
                <div>
                    {pendingDriversList.length > 0 && (
                    <div className="mb-5 p-3 rounded bg-warning bg-opacity-10 border border-warning border-2">
                        <h5 className="text-danger fw-bold mb-3 d-flex align-items-center gap-2"><span className="fs-3">⚠️</span> Hồ sơ tài xế đang chờ duyệt</h5>
                        <div className="table-responsive">
                            <Table hover className="bg-transparent align-middle mb-0">
                                <tbody>
                                    {pendingDriversList.map(user => (
                                    <tr key={user.id} className="bg-white bg-opacity-50">
                                        <td className="py-3 text-muted fw-bold">#{user.id}</td>
                                        <td className="py-3"><strong className="text-dark fs-5">{user.name}</strong></td>
                                        <td className="py-3"><Badge bg="dark" className="shadow-sm px-3 py-2">{user.role}</Badge></td>
                                        <td className="py-3 text-end">
                                            <Button size="sm" variant="success" className="glass-btn-primary fw-bold me-2 px-4 shadow-sm" onClick={() => handleApproveDriver(user.id, user.name)}>✅ Cho phép chạy</Button>
                                            <Button size="sm" variant="danger" className="glass-btn text-danger border-danger fw-bold px-4 shadow-sm" onClick={() => handleRejectDriver(user.id, user.name)}>❌ Xóa hồ sơ</Button>
                                        </td>
                                    </tr>
                                    ))}
                                </tbody>
                            </Table>
                        </div>
                    </div>
                    )}

                    <h5 className="text-primary fw-bold mb-3">👥 Danh sách người dùng hệ thống</h5>
                    <div className="table-responsive">
                        <Table hover className="bg-transparent align-middle mb-0">
                        <thead className="bg-white bg-opacity-50">
                            <tr>
                                <th className="py-3 text-dark fw-bold border-bottom-0">ID</th>
                                <th className="py-3 text-dark fw-bold border-bottom-0">Họ và Tên</th>
                                <th className="py-3 text-dark fw-bold border-bottom-0">SĐT / Biển số</th>
                                <th className="py-3 text-dark fw-bold border-bottom-0">Vai trò</th>
                                <th className="py-3 text-dark fw-bold border-bottom-0 text-center">Thao Tác</th>
                            </tr>
                        </thead>
                        <tbody>
                            {activeUsersList.map(user => (
                            <tr key={user.id} className="bg-white bg-opacity-25">
                                <td className="py-3 text-muted fw-bold">#{user.id}</td>
                                <td>
                                <div className="d-flex align-items-center">
                                    {user.avatar_url ? (
                                    <img src={user.avatar_url} alt="avt" width="40" height="40" className="rounded-circle me-3 border border-secondary shadow-sm" style={{objectFit:'cover'}}/>
                                    ) : (
                                    <div className="bg-light rounded-circle me-3 d-flex align-items-center justify-content-center border shadow-sm" style={{width:'40px', height:'40px'}}>👤</div>
                                    )}
                                    <span className="fw-bold text-dark fs-6">{user.name}</span>
                                </div>
                                </td>
                                <td>
                                <div className="text-dark fw-bold" style={{fontSize: '14px'}}>📞 {user.phone || 'Chưa cập nhật'}</div>
                                {user.role.startsWith('driver') && <div className="text-danger fw-bold mt-1" style={{fontSize: '14px'}}>🛵 {user.license_plate || 'Chưa cập nhật'}</div>}
                                </td>
                                <td>
                                <Badge bg={user.role.startsWith('driver') ? 'info' : 'primary'} className="px-3 py-2 shadow-sm">
                                    {user.role === 'driver_express' ? 'Tài xế (Xe máy)' : user.role === 'driver_container' ? 'Tài xế (Container)' : 'Khách hàng'}
                                </Badge>
                                </td>
                                <td className="text-center">
                                {user.role.startsWith('driver') && (
                                    <Button size="sm" variant="info" className="glass-btn text-primary border-info fw-bold shadow-sm me-2" onClick={() => navigate(`/admin/driver/${user.id}`)}>
                                    👁️ Xem Lý Lịch
                                    </Button>
                                )}
                                <Button size="sm" variant={user.is_active ? "danger" : "secondary"} className={`fw-bold shadow-sm ${user.is_active ? 'glass-btn bg-danger text-white border-danger' : 'glass-btn border-secondary text-secondary'}`} onClick={() => handleToggleUserActive(user.id, user.email, user.is_active)}>
                                    {user.is_active ? "🔒 Khóa T.Khoản" : "🔓 Mở Khóa"}
                                </Button>
                                </td>
                            </tr>
                            ))}
                        </tbody>
                        </Table>
                    </div>
                </div>
                )}

                {adminTab === 'promotions' && (
                <div>
                    <div className="d-flex justify-content-between align-items-center mb-4">
                        <h5 className="text-danger fw-bold mb-0">🎁 Quản Lý Mã Khuyến Mãi</h5>
                        <Button variant="danger" className="glass-btn-primary fw-bold shadow-sm px-4 bg-danger border-danger" onClick={() => setShowPromoModal(true)}>+ PHÁT HÀNH MÃ MỚI</Button>
                    </div>
                    <div className="table-responsive">
                        <Table hover className="bg-transparent align-middle mb-0 text-center">
                        <thead className="bg-danger bg-opacity-10">
                            <tr>
                                <th className="py-3 text-danger fw-bold border-bottom-0 text-start">Mã Code</th>
                                <th className="py-3 text-danger fw-bold border-bottom-0">Mức giảm</th>
                                <th className="py-3 text-danger fw-bold border-bottom-0">Đơn tối thiểu</th>
                                <th className="py-3 text-danger fw-bold border-bottom-0">Trạng thái (Lượt)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {promotions.map(promo => (
                            <tr key={promo.id} className="bg-white bg-opacity-25">
                                <td className="py-3 text-start"><Badge bg="dark" className="fs-5 shadow-sm px-3 py-2" style={{ letterSpacing: '2px' }}>{promo.code}</Badge></td>
                                <td className="py-3 fw-bold text-success fs-5">
                                {promo.discount_type === 'percentage' ? `${promo.discount_value}%` : `${promo.discount_value.toLocaleString()} đ`}
                                </td>
                                <td className="py-3 text-dark fw-bold fs-6">{promo.min_order_value.toLocaleString()} đ</td>
                                <td className="py-3">{promo.usage_limit > 0 ? <Badge bg="success" className="px-3 py-2 shadow-sm">Còn {promo.usage_limit} lượt</Badge> : <Badge bg="danger" className="px-3 py-2 opacity-75">Hết hạn</Badge>}</td>
                            </tr>
                            ))}
                        </tbody>
                        </Table>
                    </div>
                </div>
                )}

                {adminTab === 'cskh' && (
                <Row className="h-100">
                    <Col md={4} className="border-end border-secondary">
                        <h5 className="text-primary fw-bold mb-3 border-bottom border-primary pb-2">Kênh Hỗ Trợ Trực Tuyến</h5>
                        <ListGroup variant="flush" className="bg-transparent">
                            {supportUsers.length === 0 && <p className="text-muted fst-italic text-center mt-4">Tất cả khách hàng đều đang hài lòng. Không có yêu cầu hỗ trợ.</p>}
                            {supportUsers.map(u => (
                            <ListGroup.Item action key={u.id} active={selectedSupportUserId === u.id} onClick={() => loadSupportChat(u.id)} className={`fw-bold mb-2 rounded-3 border-0 ${selectedSupportUserId === u.id ? 'glass-btn-primary shadow-sm' : 'glass-btn text-dark'}`}>
                                👤 {u.name} <span className="ms-1" style={{fontSize:'12px', opacity:0.8}}>(ID: #{u.id})</span>
                            </ListGroup.Item>
                            ))}
                        </ListGroup>
                    </Col>
                    <Col md={8}>
                    {selectedSupportUserId ? (
                        <div className="d-flex flex-column h-100" style={{ minHeight: '500px', maxHeight: '500px' }}>
                            <div className="bg-primary bg-opacity-10 p-3 rounded-top-4 border-bottom border-primary text-primary fw-bold d-flex align-items-center gap-2">
                                <span className="fs-4">🎧</span> Đang trò chuyện trực tiếp với User #{selectedSupportUserId}
                            </div>
                            
                            <div className="p-3 bg-white bg-opacity-25 flex-grow-1" style={{ overflowY: 'auto' }}>
                                {supportMessages.map((msg, idx) => {
                                const isAdmin = msg.sender_type === 'admin';
                                return (
                                    <div key={idx} className={`d-flex mb-3 ${isAdmin ? 'justify-content-end' : 'justify-content-start'}`}>
                                    <div className={`p-3 rounded-4 shadow-sm ${isAdmin ? 'bg-primary text-white' : 'bg-white border text-dark'}`} style={{ maxWidth: '80%', borderBottomRightRadius: isAdmin ? '5px' : '20px', borderBottomLeftRadius: !isAdmin ? '5px' : '20px' }}>
                                        <div className="fw-bold">{msg.content}</div>
                                    </div>
                                    </div>
                                );
                                })}
                                <div ref={supportEndRef} />
                            </div>
                            
                            <div className="p-3 bg-white bg-opacity-50 rounded-bottom-4 border-top">
                                <Form onSubmit={handleSendSupport}>
                                    <InputGroup>
                                    <Form.Control type="text" className="glass-input fw-bold px-4" placeholder="Nhập câu trả lời để giải quyết sự cố..." value={supportInput} onChange={e => setSupportInput(e.target.value)} style={{ borderRadius: '20px 0 0 20px' }} />
                                    <Button variant="primary" type="submit" className="glass-btn-primary px-4 fw-bold" style={{ borderRadius: '0 20px 20px 0' }}>GỬI TRẢ LỜI</Button>
                                    </InputGroup>
                                </Form>
                            </div>
                        </div>
                    ) : (
                        <div className="d-flex justify-content-center align-items-center h-100 text-muted opacity-50">
                            <div className="text-center">
                                <div className="fs-1 mb-3">👈 🎧</div>
                                <h5 className="fw-bold">Chọn một người dùng bên trái để bắt đầu phiên CSKH</h5>
                            </div>
                        </div>
                    )}
                    </Col>
                </Row>
                )}
            </div>
        </div>

      <Modal show={showProfileModal} onHide={() => setShowProfileModal(false)} centered contentClassName="glass-card border-0">
        <Modal.Header closeButton className="border-bottom border-light">
            <Modal.Title className="fw-bold text-dark">Hồ Sơ Quản Trị Viên</Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleUpdateProfile}>
          <Modal.Body>
            <Form.Group className="mb-3"><Form.Label className="fw-bold text-dark">Họ và Tên</Form.Label><Form.Control type="text" className="glass-input fw-bold" value={profileForm.name} onChange={(e) => setProfileForm({...profileForm, name: e.target.value})} required /></Form.Group>
            <Form.Group className="mb-3"><Form.Label className="fw-bold text-dark">Ảnh đại diện (Tải từ máy)</Form.Label><Form.Control type="file" className="glass-input" accept="image/*" onChange={(e) => setAvatarFile(e.target.files[0])} /></Form.Group>
          </Modal.Body>
          <Modal.Footer className="border-top border-light">
              <Button variant="secondary" className="glass-btn" onClick={() => setShowProfileModal(false)}>Đóng</Button>
              <Button variant="primary" type="submit" className="glass-btn-primary px-4 fw-bold">Lưu Thay Đổi</Button>
          </Modal.Footer>
        </Form>
      </Modal>

      <Modal show={showPromoModal} onHide={() => setShowPromoModal(false)} centered contentClassName="glass-card border-0">
        <Modal.Header closeButton className="bg-danger bg-opacity-75 text-white border-0"><Modal.Title className="fw-bold">🎁 PHÁT HÀNH MÃ KHUYẾN MÃI</Modal.Title></Modal.Header>
        <Form onSubmit={handleCreatePromo}>
          <Modal.Body className="p-4">
            <Form.Group className="mb-3">
              <Form.Label className="fw-bold text-dark">Mã Code (Chữ in hoa)</Form.Label>
              <Form.Control type="text" className="glass-input fs-4 fw-bold text-danger text-center" style={{ letterSpacing: '3px' }} placeholder="VD: SIEUSALE, FREESHIP..." value={promoForm.code} onChange={e => setPromoForm({...promoForm, code: e.target.value.toUpperCase()})} required />
            </Form.Group>
            
            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label className="fw-bold text-muted" style={{ fontSize: '13px' }}>Hình thức giảm</Form.Label>
                  <Form.Select className="glass-input fw-bold text-primary" value={promoForm.discount_type} onChange={e => setPromoForm({...promoForm, discount_type: e.target.value})}>
                    <option value="fixed_amount">Trừ tiền mặt (VNĐ)</option>
                    <option value="percentage">Chiết khấu (%)</option>
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label className="fw-bold text-muted" style={{ fontSize: '13px' }}>Nhập mức giảm</Form.Label>
                  <Form.Control type="number" className="glass-input fw-bold" min="1" value={promoForm.discount_value} onChange={e => setPromoForm({...promoForm, discount_value: e.target.value})} required />
                </Form.Group>
              </Col>
            </Row>

            <Form.Group className="mb-3">
              <Form.Label className="fw-bold text-muted" style={{ fontSize: '13px' }}>Giá trị đơn hàng tối thiểu để áp dụng (VNĐ)</Form.Label>
              <Form.Control type="number" className="glass-input fw-bold text-success" min="0" value={promoForm.min_order_value} onChange={e => setPromoForm({...promoForm, min_order_value: e.target.value})} />
            </Form.Group>

            <Form.Group className="mb-2">
              <Form.Label className="fw-bold text-muted" style={{ fontSize: '13px' }}>Số lượt sử dụng tối đa của mã này</Form.Label>
              <Form.Control type="number" className="glass-input fw-bold" min="1" value={promoForm.usage_limit} onChange={e => setPromoForm({...promoForm, usage_limit: e.target.value})} />
            </Form.Group>
          </Modal.Body>
          <Modal.Footer className="border-light">
            <Button variant="secondary" className="glass-btn px-4" onClick={() => setShowPromoModal(false)}>Hủy</Button>
            <Button variant="danger" type="submit" className="glass-btn bg-danger text-white border-danger fw-bold px-5 shadow-sm">🚀 Phát Hành Ngay</Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </Container>
  );
}