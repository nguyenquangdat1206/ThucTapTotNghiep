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

  // --- STATE VOUCHER ---
  const [showPromoModal, setShowPromoModal] = useState(false);
  const [promoForm, setPromoForm] = useState({
    code: '', discount_value: '', discount_type: 'fixed_amount', min_order_value: 0, usage_limit: 100
  });

  // --- STATE CSKH ---
  const [supportUsers, setSupportUsers] = useState([]);
  const [selectedSupportUserId, setSelectedSupportUserId] = useState(null);
  const [supportMessages, setSupportMessages] = useState([]);
  const [supportInput, setSupportInput] = useState('');
  const supportEndRef = useRef(null);

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

    const ws = new WebSocket(`wss://datquang-backend.onrender.com/ws/${userInfo.user_id}/${userInfo.role}`);
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      // ==========================================
      // [MỚI] BẬT RADAR REAL-TIME CHO ADMIN
      // ==========================================
      if (data.event === 'status_changed') {
         console.log("⚡ [Real-time] Hệ thống có biến động! Đang tải lại dữ liệu...");
         fetchData(); 
      }

      if (data.event === 'bad_review_alert') {
         alert(`🚨 CẢNH BÁO NGHIÊM TRỌNG:\n\nTài xế #${data.driver_id} vừa bị khách hàng đánh giá 1 SAO ở đơn hàng #${data.order_id}!\n\n💬 Lời nhắn của khách: "${data.feedback}"\n\n👉 Admin hãy chuyển sang tab "NGƯỜI DÙNG", kiểm tra và Khóa tài khoản tài xế này ngay lập tức!`);
      }
      if (data.event === 'admin_support_alert') {
          alert(`🎧 CSKH: Người dùng #${data.user_id} đang cần hỗ trợ từ Admin!`);
          fetchData();
      }
      if (data.event === 'new_support_msg') {
          fetchData(); 
      }
    };
    return () => ws.close();
  }, [userInfo.user_id, userInfo.role]);

  // Cập nhật lại khung chat nếu có tin nhắn CSKH mới
  useEffect(() => {
    let ws;
    if (selectedSupportUserId) {
        ws = new WebSocket(`wss://datquang-backend.onrender.com/ws/${userInfo.user_id}/${userInfo.role}`);
        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.event === 'new_support_msg') loadSupportChat(selectedSupportUserId);
        };
    }
    return () => { if(ws) ws.close(); }
  }, [selectedSupportUserId, userInfo]);

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

  const adminTotalOrders = myOrders.length;
  const adminCompletedOrders = myOrders.filter(o => o.status === 'completed');
  const pendingDriversList = usersList.filter(u => u.role.startsWith('pending_'));
  const activeUsersList = usersList.filter(u => !u.role.startsWith('pending_'));

  return (
    <Container className="mt-5" style={{ maxWidth: '1200px' }}>
      <Card className="shadow p-4 border-top border-danger border-4 mb-5">
        <h2 className="text-danger mb-4">🖥️ Trung Tâm Điều Phối Hệ Thống</h2>
        <div className="d-flex justify-content-between align-items-center flex-wrap">
          <div className="d-flex align-items-center mb-3">
            {userInfo.avatar_url ? (
              <img src={userInfo.avatar_url} alt="avatar" style={{width: '60px', height: '60px', borderRadius: '50%', objectFit: 'cover', marginRight: '15px'}} />
            ) : <div style={{width: '60px', height: '60px', borderRadius: '50%', backgroundColor: '#e9ecef', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: '15px', fontSize: '24px'}}>👑</div>}
            <div>
              <h5 className="mb-1">Xin chào Quản trị viên: <strong>{userInfo.name}</strong></h5>
              <div className="d-flex gap-2 mt-2">
                 <Badge bg="danger">ADMIN</Badge>
                 <Button variant="warning" size="sm" className="fw-bold text-dark rounded-pill shadow-sm" onClick={() => navigate('/wallet')}>💳 Quản lý Ví Đối Tác</Button>
              </div>
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
            <Row className="mb-4">
              <Col md={3}><Card className="bg-primary text-white text-center shadow-sm py-2"><Card.Body><h6>Tổng Đơn Hàng</h6><h3>{adminTotalOrders}</h3></Card.Body></Card></Col>
              <Col md={3}><Card className="bg-success text-white text-center shadow-sm py-2"><Card.Body><h6>Đã Hoàn Thành</h6><h3>{adminCompletedOrders.length}</h3></Card.Body></Card></Col>
              <Col md={3}><Card className="bg-secondary text-white text-center shadow-sm py-2"><Card.Body><h6>Tổng Dòng Tiền</h6><h5>{adminTotalRevenue.toLocaleString()} đ</h5></Card.Body></Card></Col>
              <Col md={3}><Card className="bg-warning text-dark text-center shadow border-0 py-2"><Card.Body><h6 className="fw-bold">Lợi Nhuận Thực Tế</h6><h4 className="text-danger fw-bold">{adminPlatformProfit.toLocaleString()} đ</h4></Card.Body></Card></Col>
            </Row>

            <Nav variant="tabs" className="mb-4" activeKey={adminTab} onSelect={(k) => setAdminTab(k)}>
              <Nav.Item><Nav.Link eventKey="orders" className="fw-bold text-uppercase">🛒 Quản Lý Đơn</Nav.Link></Nav.Item>
              <Nav.Item><Nav.Link eventKey="users" className="fw-bold text-uppercase">👥 Người Dùng</Nav.Link></Nav.Item>
              <Nav.Item><Nav.Link eventKey="promotions" className="fw-bold text-uppercase text-danger">🎁 Khuyến Mãi</Nav.Link></Nav.Item>
              <Nav.Item><Nav.Link eventKey="cskh" className="fw-bold text-uppercase text-primary">🎧 HỖ TRỢ CSKH</Nav.Link></Nav.Item>
            </Nav>

            {adminTab === 'orders' && (
              <Table striped bordered hover responsive>
                  <thead className="table-dark"><tr><th>Mã Đơn</th><th>Mã Nhóm</th><th>Khách hàng</th><th>Tài Xế</th><th>Cước phí</th><th>Trạng thái</th><th>Thao tác</th></tr></thead>
                  <tbody>
                    {myOrders.map(order => (
                      <tr key={order.id} className={order.status === 'cancel_requested' ? 'table-danger' : ''}>
                        <td><strong>#{order.id}</strong></td>
                        <td>{order.batch_id ? <Badge bg="danger" className="text-wrap" style={{maxWidth:'100px'}}>{order.batch_id}</Badge> : <span className="text-muted">Đơn lẻ</span>}</td>
                        <td>Khách #{order.customer_id}</td>
                        <td>{order.driver_id ? <span className="text-primary">Tài xế #{order.driver_id}</span> : <span className="text-muted">Chưa có</span>}</td>
                        <td className="fw-bold">{order.price.toLocaleString()} đ</td>
                        <td>{getStatusBadge(order.status)}</td>
                        <td>
                          <Button size="sm" variant="info" className="me-2 text-white" onClick={() => navigate(`/order/${order.id}`)}>👁️ Xem</Button>
                          {order.status === 'cancel_requested' && (
                            <><Button size="sm" variant="success" className="me-2 fw-bold" onClick={() => handleAdminApproveCancel(order.id)}>✅ Duyệt Hủy</Button><Button size="sm" variant="outline-danger" className="fw-bold" onClick={() => handleAdminRejectCancel(order.id)}>❌ Từ chối</Button></>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
              </Table>
            )}

            {adminTab === 'users' && (
              <div>
                {pendingDriversList.length > 0 && (
                  <>
                    <h5 className="text-warning mb-3">⚠️ Hồ sơ đối tác đang chờ duyệt</h5>
                    <Table striped bordered hover responsive className="mb-5 shadow-sm">
                      <thead className="table-warning">
                        <tr><th>ID</th><th>Họ và Tên</th><th>Loại phương tiện</th><th>Hành động</th></tr>
                      </thead>
                      <tbody>
                        {pendingDriversList.map(user => (
                          <tr key={user.id}>
                            <td>#{user.id}</td><td><strong className="text-dark">{user.name}</strong></td>
                            <td><Badge bg="dark">{user.role}</Badge></td>
                            <td>
                              <Button size="sm" variant="success" className="me-2 fw-bold" onClick={() => handleApproveDriver(user.id, user.name)}>✅ Duyệt</Button>
                              <Button size="sm" variant="outline-danger" className="fw-bold" onClick={() => handleRejectDriver(user.id, user.name)}>❌ Từ chối</Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  </>
                )}

                <h5 className="text-primary mb-3">👥 Danh sách người dùng chính thức</h5>
                <Table striped bordered hover responsive className="shadow-sm align-middle">
                  <thead className="table-primary">
                    <tr><th>ID</th><th>Họ và Tên</th><th>SĐT / Biển số</th><th>Vai trò</th><th>Thao Tác</th></tr>
                  </thead>
                  <tbody>
                    {activeUsersList.map(user => (
                      <tr key={user.id}>
                        <td className="text-muted fw-bold">#{user.id}</td>
                        <td>
                          <div className="d-flex align-items-center">
                            {user.avatar_url ? (
                              <img src={user.avatar_url} alt="avt" width="35" height="35" className="rounded-circle me-2 border border-secondary" style={{objectFit:'cover'}}/>
                            ) : (
                              <div className="bg-light rounded-circle me-2 d-flex align-items-center justify-content-center border" style={{width:'35px', height:'35px'}}>👤</div>
                            )}
                            <span className="fw-bold text-dark">{user.name}</span>
                          </div>
                        </td>
                        <td>
                          <div className="text-muted" style={{fontSize: '14px'}}>📞 {user.phone || 'Chưa cập nhật'}</div>
                          {user.role.startsWith('driver') && <div className="text-danger fw-bold" style={{fontSize: '14px'}}>🛵 {user.license_plate || 'Chưa cập nhật'}</div>}
                        </td>
                        <td>
                          <Badge bg={user.role.startsWith('driver') ? 'info' : 'primary'} className="px-2 py-1">
                            {user.role === 'driver_express' ? 'Tài xế (Xe máy)' : user.role === 'driver_container' ? 'Tài xế (Container)' : 'Khách hàng'}
                          </Badge>
                        </td>
                        <td>
                          {user.role.startsWith('driver') && (
                            <Button size="sm" variant="info" className="me-2 text-white fw-bold shadow-sm" onClick={() => navigate(`/admin/driver/${user.id}`)}>
                              👁️ Hồ sơ
                            </Button>
                          )}
                          <Button size="sm" variant={user.is_active ? "danger" : "secondary"} className="fw-bold shadow-sm" onClick={() => handleToggleUserActive(user.id, user.email, user.is_active)}>
                            {user.is_active ? "🔒 Khóa" : "🔓 Mở"}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            )}

            {adminTab === 'promotions' && (
              <div>
                <div className="d-flex justify-content-between mb-3">
                  <h5 className="text-danger">Danh sách Mã Khuyến Mãi</h5>
                  <Button variant="danger" className="fw-bold shadow-sm" onClick={() => setShowPromoModal(true)}>+ TẠO MÃ MỚI</Button>
                </div>
                <Table striped bordered hover responsive>
                  <thead className="table-danger">
                    <tr><th>Mã Code</th><th>Mức giảm</th><th>Đơn tối thiểu</th><th>Lượt còn lại</th></tr>
                  </thead>
                  <tbody>
                    {promotions.map(promo => (
                      <tr key={promo.id}>
                        <td><Badge bg="dark" className="fs-6">{promo.code}</Badge></td>
                        <td className="fw-bold text-success">
                          {promo.discount_type === 'percentage' ? `${promo.discount_value}%` : `${promo.discount_value.toLocaleString()} đ`}
                        </td>
                        <td>{promo.min_order_value.toLocaleString()} đ</td>
                        <td>{promo.usage_limit > 0 ? <Badge bg="success">{promo.usage_limit} lượt</Badge> : <Badge bg="danger">Hết hạn</Badge>}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            )}

            {adminTab === 'cskh' && (
              <Row>
                <Col md={4} className="border-end">
                  <h5 className="text-primary mb-3">Kênh Cần Hỗ Trợ</h5>
                  <ListGroup>
                    {supportUsers.length === 0 && <p className="text-muted fst-italic">Chưa có ai cần hỗ trợ.</p>}
                    {supportUsers.map(u => (
                      <ListGroup.Item action key={u.id} active={selectedSupportUserId === u.id} onClick={() => loadSupportChat(u.id)} className="fw-bold">
                        👤 {u.name} (ID: #{u.id})
                      </ListGroup.Item>
                    ))}
                  </ListGroup>
                </Col>
                <Col md={8}>
                  {selectedSupportUserId ? (
                    <Card className="shadow-sm border-0 h-100" style={{ minHeight: '500px', display: 'flex', flexDirection: 'column' }}>
                      <Card.Header className="bg-primary text-white"><h6 className="mb-0">Đang chat với User #{selectedSupportUserId}</h6></Card.Header>
                      <Card.Body className="bg-light" style={{ overflowY: 'auto', flex: 1, maxHeight: '400px' }}>
                          {supportMessages.map((msg, idx) => {
                            const isAdmin = msg.sender_type === 'admin';
                            return (
                              <div key={idx} className={`d-flex mb-2 ${isAdmin ? 'justify-content-end' : 'justify-content-start'}`}>
                                <div className={`p-2 rounded-3 shadow-sm ${isAdmin ? 'bg-danger text-white' : 'bg-white border text-dark'}`} style={{ maxWidth: '85%', fontSize: '0.9rem' }}>
                                  {msg.content}
                                </div>
                              </div>
                            );
                          })}
                          <div ref={supportEndRef} />
                      </Card.Body>
                      <Card.Footer className="bg-white p-3 border-top">
                        <Form onSubmit={handleSendSupport}>
                          <InputGroup>
                            <Form.Control type="text" placeholder="Admin phản hồi..." value={supportInput} onChange={e => setSupportInput(e.target.value)} />
                            <Button variant="danger" type="submit">Gửi Phản Hồi</Button>
                          </InputGroup>
                        </Form>
                      </Card.Footer>
                    </Card>
                  ) : (
                    <div className="d-flex justify-content-center align-items-center bg-light border rounded h-100 text-muted">
                       <h5>👈 Chọn một người dùng bên trái để bắt đầu hỗ trợ</h5>
                    </div>
                  )}
                </Col>
              </Row>
            )}

        </div>
      </Card>

      <Modal show={showPromoModal} onHide={() => setShowPromoModal(false)} centered>
        <Modal.Header closeButton className="bg-danger text-white"><Modal.Title>Tạo Mã Khuyến Mãi</Modal.Title></Modal.Header>
        <Form onSubmit={handleCreatePromo}>
          <Modal.Body>
            <Form.Group className="mb-3">
              <Form.Label className="fw-bold">Mã Code (Chữ in hoa)</Form.Label>
              <Form.Control type="text" placeholder="VD: FREESHIP, GIAO20K..." value={promoForm.code} onChange={e => setPromoForm({...promoForm, code: e.target.value.toUpperCase()})} required />
            </Form.Group>
            
            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Loại giảm giá</Form.Label>
                  <Form.Select value={promoForm.discount_type} onChange={e => setPromoForm({...promoForm, discount_type: e.target.value})}>
                    <option value="fixed_amount">Trừ tiền (VNĐ)</option>
                    <option value="percentage">Theo phần trăm (%)</option>
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Mức giảm</Form.Label>
                  <Form.Control type="number" min="1" value={promoForm.discount_value} onChange={e => setPromoForm({...promoForm, discount_value: e.target.value})} required />
                </Form.Group>
              </Col>
            </Row>

            <Form.Group className="mb-3">
              <Form.Label>Áp dụng cho đơn tối thiểu (VNĐ)</Form.Label>
              <Form.Control type="number" min="0" value={promoForm.min_order_value} onChange={e => setPromoForm({...promoForm, min_order_value: e.target.value})} />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Giới hạn số lượt dùng</Form.Label>
              <Form.Control type="number" min="1" value={promoForm.usage_limit} onChange={e => setPromoForm({...promoForm, usage_limit: e.target.value})} />
            </Form.Group>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowPromoModal(false)}>Hủy</Button>
            <Button variant="danger" type="submit" className="fw-bold">Lưu Mã</Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </Container>
  );
}