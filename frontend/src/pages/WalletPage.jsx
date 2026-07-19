import React, { useState, useEffect } from 'react';
import { Container, Card, Button, Table, Badge, Form, InputGroup, Modal, Alert, Row, Col, Placeholder, ListGroup } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

function WalletPage() {
  const navigate = useNavigate();
  const userInfoString = localStorage.getItem('userInfo');
  const userInfo = userInfoString ? JSON.parse(userInfoString) : null;

  const [loading, setLoading] = useState(true);
  const [userBalance, setUserBalance] = useState(0);
  const [usersList, setUsersList] = useState([]);
  const [actionMessage, setActionMessage] = useState('');

  const [transactions, setTransactions] = useState([]);
  const [filterType, setFilterType] = useState('all');

  const [showTopupModal, setShowTopupModal] = useState(false);
  const [topupAmount, setTopupAmount] = useState('');

  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const fetchUserInfo = async () => {
    try {
      const response = await axios.get(`https://datquang-backend.onrender.com/users/${userInfo.user_id}`);
      setUserBalance(response.data.balance);
    } catch (error) { console.error("Lỗi tải thông tin user"); }
  };

  const fetchUsersList = async () => {
    try {
      const response = await axios.get('https://datquang-backend.onrender.com/admin/users');
      setUsersList(response.data);
    } catch (error) { console.error("Lỗi tải danh sách user"); }
  };

  const fetchTransactions = async () => {
    try {
      const response = await axios.get(`https://datquang-backend.onrender.com/users/${userInfo.user_id}/transactions`);
      setTransactions(response.data);
    } catch (error) { console.error("Lỗi tải giao dịch"); }
  };

  useEffect(() => {
    if (!userInfo) { navigate('/'); return; }
    
    const initData = async () => {
      setLoading(true);
      await fetchUserInfo();
      if (userInfo.role.startsWith('driver')) await fetchTransactions();
      if (userInfo.role === 'admin') await fetchUsersList();
      setTimeout(() => setLoading(false), 600);
    };
    initData();

    const ws = new WebSocket(`wss://datquang-backend.onrender.com/ws/${userInfo.user_id}/${userInfo.role}`);
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.event === 'balance_changed') {
        fetchUserInfo();
        if (userInfo.role.startsWith('driver')) fetchTransactions();
        if (userInfo.role === 'admin') fetchUsersList();
      }
    };
    return () => ws.close();
  }, [userInfo?.user_id, userInfo?.role]);

  const handleTopupSubmit = async (e) => {
    e.preventDefault();
    setIsProcessing(true);
    try {
      await axios.post(`https://datquang-backend.onrender.com/users/${userInfo.user_id}/topup`, { amount: parseFloat(topupAmount) });
      setActionMessage(`✅ Đã nạp thành công ${parseFloat(topupAmount).toLocaleString()}đ vào ví!`);
      setShowTopupModal(false); setTopupAmount(''); fetchUserInfo(); fetchTransactions();
    } catch (error) { 
      setActionMessage("❌ Lỗi nạp tiền!"); 
    } finally { setIsProcessing(false); }
  };

  const handleWithdrawSubmit = async (e) => {
    e.preventDefault();
    setIsProcessing(true);
    try {
      await axios.post(`https://datquang-backend.onrender.com/users/${userInfo.user_id}/withdraw`, { amount: parseFloat(withdrawAmount) });
      setActionMessage(`✅ Đã tạo lệnh rút thành công ${parseFloat(withdrawAmount).toLocaleString()}đ về ngân hàng!`);
      setShowWithdrawModal(false); setWithdrawAmount(''); fetchUserInfo(); fetchTransactions();
    } catch (error) { 
      const errorMsg = error.response?.data?.detail || "Lỗi xử lý rút tiền!";
      setActionMessage(`❌ ${errorMsg}`);
    } finally { setIsProcessing(false); }
  };

  const filteredTransactions = transactions.filter(t => {
    if (filterType === 'all') return true;
    if (filterType === 'income' && t.type === 'income') return true;
    if (filterType === 'deduction' && t.type === 'deduction') return true;
    if (filterType === 'tip' && t.type === 'tip') return true;
    if (filterType === 'surcharge' && t.type === 'surcharge') return true;
    if (filterType === 'topup' && t.type === 'topup') return true;
    if (filterType === 'withdrawal' && t.type === 'withdrawal') return true;
    return false;
  });

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('vi-VN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const getTransactionIcon = (type) => {
    if (type === 'income') return '🛵';
    if (type === 'tip') return '🎁';
    if (type === 'surcharge') return '📦';
    if (type === 'topup') return '💳'; 
    if (type === 'deduction') return '📉';
    if (type === 'withdrawal') return '🏧'; 
    return '📄';
  };

  if (!userInfo) return null;

  if (loading) return (
    <Container fluid className="py-5" style={{ backgroundColor: 'var(--bg-main)', minHeight: '100vh' }}>
      <Container style={{ maxWidth: '700px' }}>
        <Placeholder as="h2" animation="glow" className="mb-4"><Placeholder xs={6} style={{backgroundColor: 'var(--border-color)'}}/></Placeholder>
        <Placeholder animation="glow">
            <Placeholder className="w-100 mb-4 rounded" style={{height: '220px', backgroundColor: 'var(--bg-card)'}} />
            <Placeholder className="w-100 mb-2 rounded" style={{height: '80px', backgroundColor: 'var(--bg-input)'}} />
            <Placeholder className="w-100 mb-2 rounded" style={{height: '80px', backgroundColor: 'var(--bg-input)'}} />
        </Placeholder>
      </Container>
    </Container>
  );

  const driverList = usersList.filter(u => u.role.startsWith('driver') && !u.role.startsWith('pending_'));

  return (
    <Container fluid className="py-5" style={{ backgroundColor: 'var(--bg-main)', minHeight: '100vh' }}>
      <Container style={{ maxWidth: userInfo.role === 'admin' ? '1200px' : '700px' }}>
        
        {/* HEADER */}
        <div className="logistics-card p-4 mb-4 d-flex justify-content-between align-items-center border-top" style={{ borderTopWidth: '4px !important', borderTopColor: 'var(--brand-orange) !important' }}>
          <h3 className="text-white fw-bold mb-0 d-flex align-items-center gap-3">
             <span className="fs-2">💳</span> {userInfo.role === 'admin' ? "Quản Lý Dòng Tiền" : "Ví Đối Tác"}
          </h3>
          <Button variant="outline-light" className="fw-bold" style={{ borderColor: 'var(--border-color)' }} onClick={() => navigate('/dashboard')}>
            ⬅ Quay lại {userInfo.role === 'admin' ? 'Quản lý' : 'Radar'}
          </Button>
        </div>

        {actionMessage && <Alert variant={actionMessage.includes('❌') ? 'danger' : 'success'} className="logistics-card border-0 fw-bold">{actionMessage}</Alert>}

        <Row>
          {/* ======================================= */}
          {/* GIAO DIỆN VÍ TÀI XẾ (TỰ NẠP / TỰ RÚT)   */}
          {/* ======================================= */}
          {userInfo.role.startsWith('driver') && (
            <Col md={12}>
              
              {/* THẺ ĐEN (BLACK CARD) ĐẬM CHẤT CÔNG NGHỆ */}
              <div className="p-5 mb-4 position-relative overflow-hidden shadow-lg" 
                   style={{ 
                     borderRadius: '20px', 
                     background: 'linear-gradient(135deg, #1A2822 0%, #0B130E 100%)', 
                     border: '1px solid var(--border-color)',
                     boxShadow: '0 15px 35px rgba(0,0,0,0.5)'
                   }}>
                {/* Hiệu ứng chùm sáng */}
                <div style={{ position: 'absolute', top: '-60px', right: '-40px', width: '200px', height: '200px', background: 'var(--brand-orange-dim)', borderRadius: '50%', filter: 'blur(40px)' }}></div>

                <Row className="position-relative" style={{ zIndex: 2 }}>
                  <Col md={7}>
                    <h6 className="fw-bold mb-2 text-uppercase tracking-wide" style={{ letterSpacing: '3px', color: 'var(--brand-orange)' }}>DARK FOREST LOGISTICS</h6>
                    <div className="mb-4 text-muted fw-bold" style={{ fontSize: '1.2rem', letterSpacing: '4px' }}>**** **** **** 8888</div>
                    
                    <p className="text-muted fw-bold mb-1" style={{ fontSize: '12px' }}>SỐ DƯ KÝ QUỸ HIỆN TẠI</p>
                    <h1 className="fw-bold mb-0" style={{ fontSize: '3.5rem', color: '#4ADE80' }}>
                      {userBalance.toLocaleString()} <span className="fs-4 text-white">đ</span>
                    </h1>
                  </Col>
                  <Col md={5} className="d-flex flex-column justify-content-end align-items-md-end mt-4 mt-md-0">
                     <div className="text-md-end">
                       <p className="text-muted fw-bold mb-1" style={{ fontSize: '12px' }}>CHỦ TÀI KHOẢN</p>
                       <h4 className="fw-bold text-white text-uppercase tracking-wide mb-0" style={{ letterSpacing: '1px' }}>{userInfo.name}</h4>
                     </div>
                  </Col>
                </Row>
              </div>

              <Row className="g-3 mb-5">
                <Col xs={6}>
                  <Button className="btn-orange w-100 py-3 fs-5 fw-bold d-flex align-items-center justify-content-center gap-2" onClick={() => setShowTopupModal(true)}>
                    NẠP TIỀN
                  </Button>
                </Col>
                <Col xs={6}>
                  <Button variant="outline-danger" className="w-100 py-3 fs-5 fw-bold d-flex align-items-center justify-content-center gap-2" onClick={() => setShowWithdrawModal(true)}>
                    RÚT TIỀN
                  </Button>
                </Col>
              </Row>

              <div className="d-flex justify-content-between align-items-center mb-4">
                <h5 className="mb-0 fw-bold text-white">Lịch sử giao dịch</h5>
                <Form.Select 
                  size="sm" 
                  style={{ width: 'auto', minWidth: '180px', cursor: 'pointer' }}
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="logistics-input fw-bold"
                >
                  <option value="all">Tất cả giao dịch</option>
                  <option value="income">Phí ship (+)</option>
                  <option value="tip">Tiền Tip (+)</option>
                  <option value="topup">Nạp tiền vào ví (+)</option>
                  <option value="deduction">Khấu trừ hoa hồng (-)</option>
                  <option value="withdrawal">Rút tiền (-)</option>
                </Form.Select>
              </div>

              <div className="logistics-card p-0 overflow-hidden mb-4">
                <ListGroup variant="flush">
                  {filteredTransactions.length === 0 ? (
                    <div className="text-center py-5 text-muted fw-bold">
                      <div className="fs-1 mb-3">📭</div>
                      Chưa có phát sinh giao dịch nào.
                    </div>
                  ) : (
                    filteredTransactions.map((item, index) => (
                      <ListGroup.Item key={index} className="bg-transparent py-3 px-4" style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <div className="d-flex justify-content-between align-items-center">
                          <div className="d-flex align-items-center">
                            <div className="rounded-circle d-flex justify-content-center align-items-center me-3 border" style={{width: '50px', height: '50px', fontSize: '1.4rem', backgroundColor: 'var(--bg-input)', borderColor: 'var(--border-color)'}}>
                              {getTransactionIcon(item.type)}
                            </div>
                            <div>
                              <div className="fw-bold text-white fs-6">{item.title}</div>
                              <div className="text-muted" style={{fontSize: '13px'}}>{formatDate(item.timestamp)}</div>
                            </div>
                          </div>
                          <div className={`fw-bold fs-5 ${item.amount > 0 ? 'text-success' : 'text-danger'}`}>
                            {item.amount > 0 ? '+' : ''}{item.amount.toLocaleString()} đ
                          </div>
                        </div>
                      </ListGroup.Item>
                    ))
                  )}
                </ListGroup>
              </div>
            </Col>
          )}

          {/* ======================================= */}
          {/* GIAO DIỆN ADMIN                         */}
          {/* ======================================= */}
          {userInfo.role === 'admin' && (
            <Col md={12}>
              <div className="logistics-card p-4">
                <h5 className="fw-bold text-white mb-4">Báo cáo số dư ví đối tác (Tài xế)</h5>
                <div className="table-responsive">
                  <Table className="align-middle mb-0" style={{ '--bs-table-bg': 'transparent', '--bs-table-color': 'var(--text-main)', '--bs-table-border-color': 'var(--border-color)' }}>
                    <thead>
                      <tr>
                        <th className="py-3 text-muted fw-bold border-bottom">ID</th>
                        <th className="py-3 text-muted fw-bold border-bottom">Họ và Tên Đối tác</th>
                        <th className="py-3 text-muted fw-bold border-bottom">Loại phương tiện</th>
                        <th className="py-3 text-muted fw-bold border-bottom text-end">Số dư ví hiện tại</th>
                      </tr>
                    </thead>
                    <tbody>
                      {driverList.map(driver => (
                        <tr key={driver.id}>
                          <td className="py-3 fw-bold">#{driver.id}</td>
                          <td className="py-3 fw-bold text-white">{driver.name}</td>
                          <td className="py-3">
                            <Badge bg="dark" className="border border-secondary px-2 py-1 text-white">
                              {driver.role === 'driver_express' ? 'XE MÁY' : driver.role === 'driver_truck' ? 'XE TẢI' : 'CONTAINER'}
                            </Badge>
                          </td>
                          <td className="py-3 text-end"><strong className="text-success fs-6">{driver.balance.toLocaleString()} đ</strong></td>
                        </tr>
                      ))}
                      {driverList.length === 0 && (
                        <tr><td colSpan="4" className="text-center text-muted py-4 fw-bold">Chưa có tài xế nào trên hệ thống.</td></tr>
                      )}
                    </tbody>
                  </Table>
                </div>
              </div>
            </Col>
          )}
        </Row>

        {/* POPUP NẠP TIỀN */}
        <Modal show={showTopupModal} onHide={() => setShowTopupModal(false)} centered contentClassName="logistics-card border-0">
          <Modal.Header closeButton className="border-bottom" style={{ borderColor: 'var(--border-color)' }}>
             <Modal.Title className="fw-bold text-white">💳 Nạp Tiền Vào Ví</Modal.Title>
          </Modal.Header>
          <Form onSubmit={handleTopupSubmit}>
            <Modal.Body className="p-4">
              <Form.Group>
                <Form.Label className="fw-bold text-muted" style={{ fontSize: '13px' }}>SỐ TIỀN MUỐN NẠP (VNĐ)</Form.Label>
                <Form.Control type="number" min="10000" step="1000" className="logistics-input fs-4 fw-bold text-success py-3 text-center" value={topupAmount} onChange={(e) => setTopupAmount(e.target.value)} placeholder="Ví dụ: 50000" required autoFocus />
                <Form.Text className="text-muted mt-3 d-block text-center">Hỗ trợ cổng thanh toán VNPay, MoMo, ZaloPay.</Form.Text>
              </Form.Group>
            </Modal.Body>
            <Modal.Footer className="border-top" style={{ borderColor: 'var(--border-color)' }}>
              <Button variant="outline-secondary" className="text-muted border-0" onClick={() => setShowTopupModal(false)}>Hủy</Button>
              <Button type="submit" disabled={isProcessing} className="btn-orange px-4 fw-bold">
                {isProcessing ? 'Đang chuyển hướng...' : 'Thanh Toán Ngay'}
              </Button>
            </Modal.Footer>
          </Form>
        </Modal>

        {/* POPUP RÚT TIỀN */}
        <Modal show={showWithdrawModal} onHide={() => setShowWithdrawModal(false)} centered contentClassName="logistics-card border-0">
          <Modal.Header closeButton className="border-bottom" style={{ borderColor: 'var(--border-color)' }}>
             <Modal.Title className="fw-bold text-white">🏧 Rút Tiền Về Ngân Hàng</Modal.Title>
          </Modal.Header>
          <Form onSubmit={handleWithdrawSubmit}>
            <Modal.Body className="p-4">
              <div className="p-3 mb-4 rounded text-center border" style={{ backgroundColor: 'var(--bg-input)', borderColor: 'var(--border-color)' }}>
                <span className="text-muted fw-bold">Số dư khả dụng:</span> <strong className="fs-5 ms-2 text-success">{userBalance.toLocaleString()} đ</strong>
              </div>
              <Form.Group>
                <Form.Label className="fw-bold text-muted" style={{ fontSize: '13px' }}>SỐ TIỀN CẦN RÚT (VNĐ)</Form.Label>
                <Form.Control type="number" min="50000" step="1000" max={userBalance} className="logistics-input fs-4 fw-bold text-danger py-3 text-center" value={withdrawAmount} onChange={(e) => setWithdrawAmount(e.target.value)} placeholder="Ví dụ: 150000" required autoFocus />
                <Form.Text className="text-danger mt-3 d-block text-center fw-bold">Mức rút tối thiểu: 50.000 đ</Form.Text>
              </Form.Group>
            </Modal.Body>
            <Modal.Footer className="border-top" style={{ borderColor: 'var(--border-color)' }}>
              <Button variant="outline-secondary" className="text-muted border-0" onClick={() => setShowWithdrawModal(false)}>Hủy</Button>
              <Button variant="danger" type="submit" disabled={isProcessing} className="fw-bold px-4">
                {isProcessing ? 'Đang xử lý...' : 'Xác nhận Rút'}
              </Button>
            </Modal.Footer>
          </Form>
        </Modal>

      </Container>
    </Container>
  );
}

export default WalletPage;