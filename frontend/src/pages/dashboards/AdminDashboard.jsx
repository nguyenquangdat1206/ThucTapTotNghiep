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
      case 'pending': return <Badge bg="secondary" className="px-3 py-2">Đang tìm tài xế</Badge>;
      case 'accepted': return <Badge bg="info" className="px-3 py-2 text-dark">Tài xế đang đến</Badge>;
      case 'arrived_pickup': return <Badge bg="primary" className="px-3 py-2">Đã tới điểm lấy</Badge>;
      case 'picking_up': return <Badge bg="warning" className="px-3 py-2 text-dark">Đã lấy hàng</Badge>;
      case 'delivering': return <Badge style={{backgroundColor: 'var(--brand-orange)'}} className="px-3 py-2 text-white">Đang giao hàng</Badge>;
      case 'completed': return <Badge bg="success" className="px-3 py-2">Đã hoàn thành</Badge>;
      case 'cancel_requested': return <Badge bg="danger" className="px-3 py-2 text-uppercase fw-bold border border-white">Yêu cầu hủy</Badge>;
      case 'cancelled': return <Badge bg="dark" className="px-3 py-2 border border-secondary">Đã hủy</Badge>;
      default: return <Badge bg="light" className="px-3 py-2 text-dark">{status}</Badge>;
    }
  };

  if (loading) return <DashboardSkeleton />;

  const adminTotalOrders = myOrders.length;
  const adminCompletedOrders = myOrders.filter(o => o.status === 'completed');
  const pendingDriversList = usersList.filter(u => u.role.startsWith('pending_'));
  const activeUsersList = usersList.filter(u => !u.role.startsWith('pending_'));

  return (
    <Container fluid className="py-5" style={{ backgroundColor: 'var(--bg-main)', minHeight: '100vh' }}>
      <Container style={{ maxWidth: '1200px' }}>
        
        {/* HEADER QUẢN TRỊ VIÊN */}
        <div className="logistics-card p-4 mb-4" style={{ borderTop: '4px solid var(--brand-orange)' }}>
          <div className="d-flex justify-content-between align-items-center flex-wrap">
            <div className="d-flex align-items-center mb-3 mb-md-0">
              {userInfo.avatar_url ? (
                <img src={userInfo.avatar_url} alt="avatar" style={{width: '70px', height: '70px', borderRadius: '50%', objectFit: 'cover', marginRight: '15px', border: '2px solid var(--brand-orange)'}} />
              ) : <div style={{width: '70px', height: '70px', borderRadius: '50%', backgroundColor: 'var(--bg-input)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: '15px', fontSize: '30px', border: '1px solid var(--border-color)'}}>👑</div>}
              <div>
                <h4 className="mb-1 fw-bold text-white">Xin chào, {userInfo.name}!</h4>
                <div className="d-flex gap-2 mt-2">
                   <Badge bg="danger" className="fs-6 px-3 py-2">SUPER ADMIN</Badge>
                   <Button variant="outline-warning" size="sm" className="fw-bold px-3 border-warning text-warning" onClick={() => navigate('/wallet')}>💳 Quản lý Ví Đối Tác</Button>
                </div>
              </div>
            </div>
            <div className="d-flex gap-2">
              <Button variant="outline-light" style={{ borderColor: 'var(--border-color)' }} onClick={() => setShowProfileModal(true)}>✏️ Hồ sơ</Button>
              <Button variant="outline-danger" className="fw-bold" onClick={handleLogout}>Đăng xuất</Button>
            </div>
          </div>
        </div>
          
        {actionMessage && <Alert variant={actionMessage.includes('❌') ? 'danger' : 'success'} className="logistics-card border-0 fw-bold">{actionMessage}</Alert>}
          
        <div>
            {/* 4 KHỐI THỐNG KÊ */}
            <Row className="mb-4 g-3">
              <Col md={3}>
                <div className="logistics-card p-4 text-center h-100" style={{ borderBottom: '4px solid var(--text-muted)' }}>
                  <h6 className="text-muted fw-bold mb-3 text-uppercase">Tổng Đơn Hàng</h6>
                  <h2 className="fw-bold mb-0" style={{ fontSize: '2.5rem', color: 'var(--text-main)' }}>{adminTotalOrders}</h2>
                </div>
              </Col>
              <Col md={3}>
                <div className="logistics-card p-4 text-center h-100" style={{ borderBottom: '4px solid #4ADE80' }}>
                  <h6 className="text-muted fw-bold mb-3 text-uppercase">Đã Hoàn Thành</h6>
                  <h2 className="fw-bold mb-0" style={{ fontSize: '2.5rem', color: '#4ADE80' }}>{adminCompletedOrders.length}</h2>
                </div>
              </Col>
              <Col md={3}>
                <div className="logistics-card p-4 text-center h-100" style={{ borderBottom: '4px solid var(--brand-orange)' }}>
                  <h6 className="text-muted fw-bold mb-3 text-uppercase">Tổng Dòng Tiền</h6>
                  <h3 className="text-white fw-bold mb-0">{adminTotalRevenue.toLocaleString()} đ</h3>
                </div>
              </Col>
              <Col md={3}>
                <div className="logistics-card p-4 text-center h-100" style={{ borderBottom: '4px solid #FF4D4D', backgroundColor: 'rgba(255, 77, 77, 0.05)' }}>
                  <h6 className="fw-bold mb-3 text-uppercase" style={{ color: '#FF4D4D' }}>Lợi Nhuận Hệ Thống</h6>
                  <h3 className="fw-bold mb-0" style={{ color: '#FF4D4D' }}>{adminPlatformProfit.toLocaleString()} đ</h3>
                </div>
              </Col>
            </Row>

            {/* TAB ĐIỀU HƯỚNG */}
            <div className="logistics-card mb-4 p-2 border-0">
                <Nav variant="pills" className="justify-content-center gap-2" activeKey={adminTab} onSelect={(k) => setAdminTab(k)}>
                  <Nav.Item>
                    <Nav.Link eventKey="orders" className={`fw-bold text-uppercase px-4 ${adminTab === 'orders' ? 'btn-orange text-white' : 'text-muted'}`} style={{ borderRadius: '12px' }}>🛒 Quản Lý Đơn</Nav.Link>
                  </Nav.Item>
                  <Nav.Item>
                    <Nav.Link eventKey="users" className={`fw-bold text-uppercase px-4 ${adminTab === 'users' ? 'btn-orange text-white' : 'text-muted'}`} style={{ borderRadius: '12px' }}>👥 Người Dùng</Nav.Link>
                  </Nav.Item>
                  <Nav.Item>
                    <Nav.Link eventKey="promotions" className={`fw-bold text-uppercase px-4 ${adminTab === 'promotions' ? 'btn-orange text-white' : 'text-muted'}`} style={{ borderRadius: '12px' }}>🎁 Khuyến Mãi</Nav.Link>
                  </Nav.Item>
                  <Nav.Item>
                    <Nav.Link eventKey="cskh" className={`fw-bold text-uppercase px-4 ${adminTab === 'cskh' ? 'btn-orange text-white' : 'text-muted'}`} style={{ borderRadius: '12px' }}>🎧 Hỗ Trợ CSKH</Nav.Link>
                  </Nav.Item>
                </Nav>
            </div>

            {/* KHUNG NỘI DUNG CHÍNH */}
            <div className="logistics-card p-4" style={{ minHeight: '500px' }}>
                
                {adminTab === 'orders' && (
                <div className="table-responsive">
                    <Table className="align-middle mb-0" style={{ '--bs-table-bg': 'transparent', '--bs-table-color': 'var(--text-main)', '--bs-table-border-color': 'var(--border-color)' }}>
                        <thead>
                            <tr>
                                <th className="py-3 text-muted fw-bold border-bottom">Mã Đơn</th>
                                <th className="py-3 text-muted fw-bold border-bottom">Mã BATCH</th>
                                <th className="py-3 text-muted fw-bold border-bottom">Khách hàng</th>
                                <th className="py-3 text-muted fw-bold border-bottom">Tài Xế</th>
                                <th className="py-3 text-muted fw-bold border-bottom">Cước phí</th>
                                <th className="py-3 text-muted fw-bold border-bottom">Trạng thái</th>
                                <th className="py-3 text-muted fw-bold border-bottom text-center">Thao tác</th>
                            </tr>
                        </thead>
                        <tbody>
                            {myOrders.map(order => (
                            <tr key={order.id} style={{ backgroundColor: order.status === 'cancel_requested' ? 'rgba(255, 77, 77, 0.1)' : 'transparent' }}>
                                <td className="py-3 fw-bold">#{order.id}</td>
                                <td>{order.batch_id ? <Badge bg="danger" className="text-wrap px-2 py-1">{order.batch_id}</Badge> : <span className="text-muted fst-italic">Đơn lẻ</span>}</td>
                                <td className="fw-bold" style={{ color: 'var(--brand-orange)' }}>ID: #{order.customer_id}</td>
                                <td>{order.driver_id ? <span className="text-info fw-bold">ID: #{order.driver_id}</span> : <span className="text-muted fst-italic">Chưa có</span>}</td>
                                <td className="fw-bold text-success fs-6">{order.price.toLocaleString()} đ</td>
                                <td>{getStatusBadge(order.status)}</td>
                                <td className="text-center">
                                <Button size="sm" variant="outline-light" className="fw-bold me-2" style={{ borderColor: 'var(--border-color)' }} onClick={() => navigate(`/order/${order.id}`)}>👁️ Mở Đơn</Button>
                                {order.status === 'cancel_requested' && (
                                    <>
                                        <Button size="sm" variant="success" className="fw-bold me-2" onClick={() => handleAdminApproveCancel(order.id)}>✅ Duyệt Hủy</Button>
                                        <Button size="sm" variant="danger" className="fw-bold" onClick={() => handleAdminRejectCancel(order.id)}>❌ Từ chối</Button>
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
                    <div className="mb-5 p-4 rounded" style={{ backgroundColor: 'rgba(255, 193, 7, 0.05)', border: '1px solid #FFC107' }}>
                        <h5 className="text-warning fw-bold mb-3 d-flex align-items-center gap-2"><span className="fs-3">⚠️</span> Hồ sơ tài xế đang chờ duyệt</h5>
                        <div className="table-responsive">
                            <Table className="align-middle mb-0" style={{ '--bs-table-bg': 'transparent', '--bs-table-color': 'var(--text-main)', '--bs-table-border-color': 'var(--border-color)' }}>
                                <tbody>
                                    {pendingDriversList.map(user => (
                                    <tr key={user.id}>
                                        <td className="py-3 text-muted fw-bold">#{user.id}</td>
                                        <td className="py-3"><strong className="text-white fs-5">{user.name}</strong></td>
                                        <td className="py-3"><Badge bg="dark" className="px-3 py-2 border">{user.role}</Badge></td>
                                        <td className="py-3 text-end">
                                            <Button size="sm" variant="success" className="fw-bold me-2 px-4" onClick={() => handleApproveDriver(user.id, user.name)}>✅ Cho phép chạy</Button>
                                            <Button size="sm" variant="outline-danger" className="fw-bold px-4" onClick={() => handleRejectDriver(user.id, user.name)}>❌ Xóa hồ sơ</Button>
                                        </td>
                                    </tr>
                                    ))}
                                </tbody>
                            </Table>
                        </div>
                    </div>
                    )}

                    <h5 className="fw-bold mb-3" style={{ color: 'var(--brand-orange)' }}>👥 Danh sách người dùng hệ thống</h5>
                    <div className="table-responsive">
                        <Table className="align-middle mb-0" style={{ '--bs-table-bg': 'transparent', '--bs-table-color': 'var(--text-main)', '--bs-table-border-color': 'var(--border-color)' }}>
                        <thead>
                            <tr>
                                <th className="py-3 text-muted fw-bold border-bottom">ID</th>
                                <th className="py-3 text-muted fw-bold border-bottom">Họ và Tên</th>
                                <th className="py-3 text-muted fw-bold border-bottom">SĐT / Biển số</th>
                                <th className="py-3 text-muted fw-bold border-bottom">Vai trò</th>
                                <th className="py-3 text-muted fw-bold border-bottom text-center">Thao Tác</th>
                            </tr>
                        </thead>
                        <tbody>
                            {activeUsersList.map(user => (
                            <tr key={user.id}>
                                <td className="py-3 text-muted fw-bold">#{user.id}</td>
                                <td>
                                <div className="d-flex align-items-center">
                                    {user.avatar_url ? (
                                    <img src={user.avatar_url} alt="avt" width="40" height="40" className="rounded-circle me-3 border border-secondary" style={{objectFit:'cover'}}/>
                                    ) : (
                                    <div className="rounded-circle me-3 d-flex align-items-center justify-content-center border" style={{width:'40px', height:'40px', backgroundColor: 'var(--bg-input)'}}>👤</div>
                                    )}
                                    <span className="fw-bold text-white fs-6">{user.name}</span>
                                </div>
                                </td>
                                <td>
                                <div className="text-white fw-bold" style={{fontSize: '14px'}}>📞 {user.phone || 'Chưa cập nhật'}</div>
                                {user.role.startsWith('driver') && <div className="text-danger fw-bold mt-1" style={{fontSize: '14px'}}>🛵 {user.license_plate || 'Chưa cập nhật'}</div>}
                                </td>
                                <td>
                                <Badge bg={user.role.startsWith('driver') ? 'info' : 'primary'} className="px-3 py-2 text-dark fw-bold">
                                    {user.role === 'driver_express' ? 'Tài xế (Xe máy)' : user.role === 'driver_truck' ? 'Tài xế (Xe tải)' : user.role === 'driver_container' ? 'Tài xế (Container)' : 'Khách hàng'}
                                </Badge>
                                </td>
                                <td className="text-center">
                                {user.role.startsWith('driver') && (
                                    <Button size="sm" variant="outline-info" className="fw-bold me-2" onClick={() => navigate(`/admin/driver/${user.id}`)}>
                                    👁️ Xem Lý Lịch
                                    </Button>
                                )}
                                <Button size="sm" variant={user.is_active ? "outline-danger" : "outline-secondary"} className="fw-bold" onClick={() => handleToggleUserActive(user.id, user.email, user.is_active)}>
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
                        <h5 className="text-white fw-bold mb-0">🎁 Quản Lý Mã Khuyến Mãi</h5>
                        <Button className="btn-orange fw-bold px-4" onClick={() => setShowPromoModal(true)}>+ PHÁT HÀNH MÃ MỚI</Button>
                    </div>
                    <div className="table-responsive">
                        <Table className="align-middle mb-0 text-center" style={{ '--bs-table-bg': 'transparent', '--bs-table-color': 'var(--text-main)', '--bs-table-border-color': 'var(--border-color)' }}>
                        <thead>
                            <tr>
                                <th className="py-3 text-muted fw-bold border-bottom text-start">Mã Code</th>
                                <th className="py-3 text-muted fw-bold border-bottom">Mức giảm</th>
                                <th className="py-3 text-muted fw-bold border-bottom">Đơn tối thiểu</th>
                                <th className="py-3 text-muted fw-bold border-bottom">Trạng thái (Lượt)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {promotions.map(promo => (
                            <tr key={promo.id}>
                                <td className="py-3 text-start"><Badge bg="dark" className="fs-5 border px-3 py-2" style={{ letterSpacing: '2px', borderColor: 'var(--brand-orange) !important', color: 'var(--brand-orange)' }}>{promo.code}</Badge></td>
                                <td className="py-3 fw-bold text-success fs-5">
                                {promo.discount_type === 'percentage' ? `${promo.discount_value}%` : `${promo.discount_value.toLocaleString()} đ`}
                                </td>
                                <td className="py-3 text-white fw-bold fs-6">{promo.min_order_value.toLocaleString()} đ</td>
                                <td className="py-3">{promo.usage_limit > 0 ? <Badge bg="success" className="px-3 py-2">Còn {promo.usage_limit} lượt</Badge> : <Badge bg="danger" className="px-3 py-2 opacity-75">Hết hạn</Badge>}</td>
                            </tr>
                            ))}
                        </tbody>
                        </Table>
                    </div>
                </div>
                )}

                {adminTab === 'cskh' && (
                <Row className="h-100">
                    <Col md={4} className="border-end" style={{ borderColor: 'var(--border-color) !important' }}>
                        <h5 className="text-white fw-bold mb-3 pb-2 border-bottom" style={{ borderColor: 'var(--border-color) !important' }}>Kênh Hỗ Trợ</h5>
                        <ListGroup variant="flush" className="bg-transparent">
                            {supportUsers.length === 0 && <p className="text-muted fst-italic text-center mt-4">Không có yêu cầu hỗ trợ nào.</p>}
                            {supportUsers.map(u => (
                            <ListGroup.Item action key={u.id} active={selectedSupportUserId === u.id} onClick={() => loadSupportChat(u.id)} className="fw-bold mb-2 rounded-3 border-0" style={{ backgroundColor: selectedSupportUserId === u.id ? 'var(--brand-orange)' : 'var(--bg-input)', color: 'var(--text-main)' }}>
                                👤 {u.name} <span className="ms-1" style={{fontSize:'12px', opacity:0.8}}>(ID: #{u.id})</span>
                            </ListGroup.Item>
                            ))}
                        </ListGroup>
                    </Col>
                    <Col md={8}>
                    {selectedSupportUserId ? (
                        <div className="d-flex flex-column h-100" style={{ minHeight: '500px', maxHeight: '500px' }}>
                            <div className="p-3 rounded-top-4 border-bottom d-flex align-items-center gap-2 fw-bold" style={{ backgroundColor: 'var(--bg-input)', borderColor: 'var(--border-color) !important', color: 'var(--brand-orange)' }}>
                                <span className="fs-4">🎧</span> Đang trò chuyện với User #{selectedSupportUserId}
                            </div>
                            
                            <div className="p-3 flex-grow-1" style={{ overflowY: 'auto', backgroundColor: 'var(--bg-main)' }}>
                                {supportMessages.map((msg, idx) => {
                                const isAdmin = msg.sender_type === 'admin';
                                return (
                                    <div key={idx} className={`d-flex mb-3 ${isAdmin ? 'justify-content-end' : 'justify-content-start'}`}>
                                    <div className={`p-3 rounded-4 ${isAdmin ? 'text-white' : 'text-white border'}`} style={{ maxWidth: '80%', backgroundColor: isAdmin ? 'var(--brand-orange)' : 'var(--bg-card)', borderColor: isAdmin ? 'none' : 'var(--border-color)', borderBottomRightRadius: isAdmin ? '5px' : '20px', borderBottomLeftRadius: !isAdmin ? '5px' : '20px' }}>
                                        <div className="fw-bold">{msg.content}</div>
                                    </div>
                                    </div>
                                );
                                })}
                                <div ref={supportEndRef} />
                            </div>
                            
                            <div className="p-3 rounded-bottom-4 border-top" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color) !important' }}>
                                <Form onSubmit={handleSendSupport}>
                                    <InputGroup>
                                    <Form.Control type="text" className="logistics-input fw-bold px-4" placeholder="Nhập câu trả lời..." value={supportInput} onChange={e => setSupportInput(e.target.value)} style={{ borderRadius: '20px 0 0 20px' }} />
                                    <Button type="submit" className="btn-orange px-4 fw-bold" style={{ borderRadius: '0 20px 20px 0' }}>GỬI TRẢ LỜI</Button>
                                    </InputGroup>
                                </Form>
                            </div>
                        </div>
                    ) : (
                        <div className="d-flex justify-content-center align-items-center h-100 text-muted opacity-50">
                            <div className="text-center">
                                <div className="fs-1 mb-3">👈 🎧</div>
                                <h5 className="fw-bold">Chọn một người dùng để bắt đầu</h5>
                            </div>
                        </div>
                    )}
                    </Col>
                </Row>
                )}
            </div>
        </div>

      {/* MODAL CẬP NHẬT HỒ SƠ */}
      <Modal show={showProfileModal} onHide={() => setShowProfileModal(false)} centered contentClassName="logistics-card border-0">
        <Modal.Header closeButton className="border-bottom" style={{ borderColor: 'var(--border-color)' }}>
            <Modal.Title className="fw-bold text-white">Hồ Sơ Quản Trị Viên</Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleUpdateProfile}>
          <Modal.Body className="p-4">
            <Form.Group className="mb-3"><Form.Label className="fw-bold text-muted" style={{fontSize: '13px'}}>HỌ VÀ TÊN</Form.Label><Form.Control type="text" className="logistics-input fw-bold" value={profileForm.name} onChange={(e) => setProfileForm({...profileForm, name: e.target.value})} required /></Form.Group>
            <Form.Group className="mb-3"><Form.Label className="fw-bold text-muted" style={{fontSize: '13px'}}>ẢNH ĐẠI DIỆN</Form.Label><Form.Control type="file" className="logistics-input" accept="image/*" onChange={(e) => setAvatarFile(e.target.files[0])} /></Form.Group>
          </Modal.Body>
          <Modal.Footer className="border-top" style={{ borderColor: 'var(--border-color)' }}>
              <Button variant="outline-secondary" className="text-muted border-0" onClick={() => setShowProfileModal(false)}>Đóng</Button>
              <Button variant="primary" type="submit" className="btn-orange px-4 fw-bold">Lưu Thay Đổi</Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* MODAL KHUYẾN MÃI */}
      <Modal show={showPromoModal} onHide={() => setShowPromoModal(false)} centered contentClassName="logistics-card border-0">
        <Modal.Header closeButton className="border-bottom" style={{ borderColor: 'var(--border-color)' }}><Modal.Title className="fw-bold text-white">🎁 PHÁT HÀNH MÃ MỚI</Modal.Title></Modal.Header>
        <Form onSubmit={handleCreatePromo}>
          <Modal.Body className="p-4">
            <Form.Group className="mb-3">
              <Form.Label className="fw-bold text-muted" style={{ fontSize: '13px' }}>MÃ CODE (IN HOA)</Form.Label>
              <Form.Control type="text" className="logistics-input fs-4 fw-bold text-center text-white" style={{ letterSpacing: '3px', borderColor: 'var(--brand-orange)' }} placeholder="VD: SIEUSALE" value={promoForm.code} onChange={e => setPromoForm({...promoForm, code: e.target.value.toUpperCase()})} required />
            </Form.Group>
            
            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label className="fw-bold text-muted" style={{ fontSize: '13px' }}>HÌNH THỨC GIẢM</Form.Label>
                  <Form.Select className="logistics-input fw-bold" value={promoForm.discount_type} onChange={e => setPromoForm({...promoForm, discount_type: e.target.value})}>
                    <option value="fixed_amount">Trừ tiền mặt (VNĐ)</option>
                    <option value="percentage">Chiết khấu (%)</option>
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label className="fw-bold text-muted" style={{ fontSize: '13px' }}>MỨC GIẢM</Form.Label>
                  <Form.Control type="number" className="logistics-input fw-bold" min="1" value={promoForm.discount_value} onChange={e => setPromoForm({...promoForm, discount_value: e.target.value})} required />
                </Form.Group>
              </Col>
            </Row>

            <Form.Group className="mb-3">
              <Form.Label className="fw-bold text-muted" style={{ fontSize: '13px' }}>ĐƠN TỐI THIỂU (VNĐ)</Form.Label>
              <Form.Control type="number" className="logistics-input fw-bold text-success" min="0" value={promoForm.min_order_value} onChange={e => setPromoForm({...promoForm, min_order_value: e.target.value})} />
            </Form.Group>

            <Form.Group className="mb-2">
              <Form.Label className="fw-bold text-muted" style={{ fontSize: '13px' }}>SỐ LƯỢT SỬ DỤNG</Form.Label>
              <Form.Control type="number" className="logistics-input fw-bold" min="1" value={promoForm.usage_limit} onChange={e => setPromoForm({...promoForm, usage_limit: e.target.value})} />
            </Form.Group>
          </Modal.Body>
          <Modal.Footer className="border-top" style={{ borderColor: 'var(--border-color)' }}>
            <Button variant="outline-secondary" className="text-muted border-0 px-4" onClick={() => setShowPromoModal(false)}>Hủy</Button>
            <Button type="submit" className="btn-orange px-5">🚀 Phát Hành Ngay</Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </Container>
  </Container>
  );
}