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
    <Container className="mt-5 mb-5">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <Placeholder as="h2" animation="glow"><Placeholder xs={4} style={{width: '300px'}}/></Placeholder>
      </div>
    </Container>
  );

  const driverList = usersList.filter(u => u.role.startsWith('driver') && !u.role.startsWith('pending_'));

  return (
    <Container className="mt-5 mb-5" style={{ maxWidth: userInfo.role === 'admin' ? '1200px' : '700px', position: 'relative', zIndex: 1 }}>
      <div className="d-flex justify-content-between align-items-center mb-4 glass-card p-3 shadow-sm border-top border-success border-4">
        <h2 className="text-success fw-bold mb-0">💳 {userInfo.role === 'admin' ? "Quản Lý Dòng Tiền" : "Ví Điện Tử"}</h2>
        <Button variant="link" className="glass-btn text-dark fw-bold text-decoration-none px-4" onClick={() => navigate('/dashboard')}>⬅ Quay lại Radar</Button>
      </div>

      {actionMessage && <Alert variant={actionMessage.includes('❌') ? 'danger' : 'success'} className="glass-card fw-bold shadow-sm">{actionMessage}</Alert>}

      <Row>
        {/* ======================================= */}
        {/* GIAO DIỆN VÍ TÀI XẾ (TỰ NẠP / TỰ RÚT)   */}
        {/* ======================================= */}
        {userInfo.role.startsWith('driver') && (
          <Col md={12}>
            
            {/* THẺ TÍN DỤNG PHA LÊ */}
            <div className="glass-card p-5 mb-4 position-relative overflow-hidden shadow-lg" style={{ borderRadius: '25px', border: '1px solid rgba(255,255,255,0.7)', background: 'linear-gradient(135deg, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0.1) 100%)' }}>
              <div style={{ position: 'absolute', top: '-60px', right: '-40px', width: '200px', height: '200px', background: 'rgba(255,255,255,0.4)', borderRadius: '50%', filter: 'blur(20px)' }}></div>
              <div style={{ position: 'absolute', bottom: '-40px', left: '-40px', width: '150px', height: '150px', background: 'rgba(255,255,255,0.3)', borderRadius: '50%', filter: 'blur(15px)' }}></div>

              <Row className="position-relative z-index-1">
                <Col md={7}>
                  <h6 className="text-dark fw-bold mb-1 text-uppercase tracking-wide" style={{ letterSpacing: '2px', opacity: 0.8 }}>VÍ ĐỐI TÁC ĐẠT QUANG</h6>
                  <div className="mb-4 text-dark fw-bold" style={{ fontSize: '1.2rem', opacity: 0.7 }}>**** **** **** 8888</div>
                  
                  <p className="text-dark fw-bold mb-0">SỐ DƯ KÝ QUỸ</p>
                  <h1 className="fw-bold text-success mb-0" style={{ fontSize: '3.5rem', textShadow: '2px 2px 4px rgba(255,255,255,0.8)' }}>
                    {userBalance.toLocaleString()} <span className="fs-4 text-dark">đ</span>
                  </h1>
                </Col>
                <Col md={5} className="d-flex flex-column justify-content-end align-items-md-end mt-4 mt-md-0">
                   <div className="text-md-end">
                     <p className="text-dark fw-bold mb-0" style={{ fontSize: '0.9rem', opacity: 0.8 }}>CHỦ TÀI KHOẢN</p>
                     <h4 className="fw-bold text-dark text-uppercase">{userInfo.name}</h4>
                   </div>
                </Col>
              </Row>
            </div>

            <Row className="g-3 mb-5">
              <Col xs={6}>
                <Button className="glass-btn-primary w-100 py-3 fs-5 fw-bold shadow-sm d-flex align-items-center justify-content-center gap-2" style={{ borderRadius: '15px' }} onClick={() => { setActionType('topup'); setShowTopupModal(true); }}>
                  <span className="fs-3">💳</span> NẠP TIỀN
                </Button>
              </Col>
              <Col xs={6}>
                <Button className="glass-btn w-100 py-3 fs-5 fw-bold shadow-sm d-flex align-items-center justify-content-center gap-2 text-danger border-danger border-2" style={{ borderRadius: '15px' }} onClick={() => { setActionType('withdraw'); setShowWithdrawModal(true); }}>
                  <span className="fs-3">🏦</span> RÚT TIỀN
                </Button>
              </Col>
            </Row>

            <div className="d-flex justify-content-between align-items-center mb-3 px-2">
              <h5 className="mb-0 fw-bold text-dark" style={{ textShadow: '0 2px 4px rgba(255,255,255,0.5)' }}>Lịch sử giao dịch</h5>
              <Form.Select 
                size="sm" 
                style={{ width: 'auto', minWidth: '190px', cursor: 'pointer', borderRadius: '12px' }}
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="glass-input fw-bold text-primary"
              >
                <option value="all">Tất cả giao dịch</option>
                <option value="income">Phí ship (+)</option>
                <option value="tip">Tiền Tip (+)</option>
                <option value="topup">Nạp tiền vào ví (+)</option>
                <option value="deduction">Khấu trừ hoa hồng (-)</option>
                <option value="withdrawal">Rút tiền (-)</option>
              </Form.Select>
            </div>

            <div className="glass-card shadow-sm rounded-4 overflow-hidden mb-4">
              <ListGroup variant="flush">
                {filteredTransactions.length === 0 ? (
                  <div className="text-center py-5 text-dark fw-bold">
                    <div className="fs-1 mb-2">📭</div>
                    Chưa có giao dịch nào
                  </div>
                ) : (
                  filteredTransactions.map((item, index) => (
                    <ListGroup.Item key={index} className="bg-transparent py-3 px-4 border-bottom border-light">
                      <div className="d-flex justify-content-between align-items-center">
                        <div className="d-flex align-items-center">
                          <div className="glass-card rounded-circle d-flex justify-content-center align-items-center me-3 shadow-sm border-2" style={{width: '50px', height: '50px', fontSize: '1.4rem'}}>
                            {getTransactionIcon(item.type)}
                          </div>
                          <div>
                            <div className="fw-bold text-dark fs-5">{item.title}</div>
                            <div className="text-dark fw-bold" style={{fontSize: '0.85rem', opacity: 0.7}}>{formatDate(item.timestamp)}</div>
                          </div>
                        </div>
                        <div className={`fw-bold fs-4 ${item.amount > 0 ? 'text-success' : 'text-danger'}`} style={{ textShadow: '1px 1px 0 #fff' }}>
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
            <div className="glass-card p-4 shadow-sm border-top border-dark border-4">
              <h5 className="fw-bold text-dark mb-4">Báo cáo số dư ví đối tác (Tài xế)</h5>
              <div className="table-responsive rounded-3 overflow-hidden border border-light">
                <Table hover className="mb-0 bg-transparent">
                  <thead className="bg-white bg-opacity-50">
                    <tr>
                      <th className="py-3 text-dark fw-bold border-bottom-0">ID</th>
                      <th className="py-3 text-dark fw-bold border-bottom-0">Họ và Tên Đối tác</th>
                      <th className="py-3 text-dark fw-bold border-bottom-0">Loại phương tiện</th>
                      <th className="py-3 text-dark fw-bold border-bottom-0 text-end">Số dư ví hiện tại</th>
                    </tr>
                  </thead>
                  <tbody>
                    {driverList.map(driver => (
                      <tr key={driver.id} className="bg-white bg-opacity-25">
                        <td className="py-3 align-middle text-dark fw-bold">#{driver.id}</td>
                        <td className="py-3 align-middle fw-bold text-dark fs-5">{driver.name}</td>
                        <td className="py-3 align-middle"><Badge bg="info" className="shadow-sm">{driver.role === 'driver_express' ? 'XE MÁY' : 'CONTAINER'}</Badge></td>
                        <td className="py-3 align-middle text-end"><strong className="text-success fs-5">{driver.balance.toLocaleString()} đ</strong></td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            </div>
          </Col>
        )}
      </Row>

      {/* POPUP NẠP TIỀN */}
      <Modal show={showTopupModal} onHide={() => setShowTopupModal(false)} centered contentClassName="glass-card border-0">
        <Modal.Header closeButton className="bg-success bg-opacity-75 text-white border-0"><Modal.Title className="fw-bold">💳 Nạp Tiền Vào Ví</Modal.Title></Modal.Header>
        <Form onSubmit={handleTopupSubmit}>
          <Modal.Body className="p-4">
            <Form.Group>
              <Form.Label className="fw-bold text-dark">Nhập số tiền muốn nạp (VNĐ)</Form.Label>
              <Form.Control type="number" min="10000" step="1000" className="glass-input fs-3 fw-bold text-primary py-3" value={topupAmount} onChange={(e) => setTopupAmount(e.target.value)} placeholder="Ví dụ: 50000" required autoFocus />
              <Form.Text className="text-dark fw-bold mt-2 d-block">Hỗ trợ cổng thanh toán VNPay, MoMo, ZaloPay.</Form.Text>
            </Form.Group>
          </Modal.Body>
          <Modal.Footer className="justify-content-center border-light">
            <Button variant="secondary" className="glass-btn px-4" onClick={() => setShowTopupModal(false)}>Hủy</Button>
            <Button variant="primary" type="submit" disabled={isProcessing} className="glass-btn-primary px-4 fw-bold shadow-sm">
              {isProcessing ? 'Đang chuyển hướng...' : 'Thanh Toán Ngay'}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* POPUP RÚT TIỀN */}
      <Modal show={showWithdrawModal} onHide={() => setShowWithdrawModal(false)} centered contentClassName="glass-card border-0">
        <Modal.Header closeButton className="bg-danger bg-opacity-75 text-white border-0"><Modal.Title className="fw-bold">🏧 Rút Tiền Về Ngân Hàng</Modal.Title></Modal.Header>
        <Form onSubmit={handleWithdrawSubmit}>
          <Modal.Body className="p-4">
            <Alert variant="info" className="glass-card border-info border-2 text-center text-dark fw-bold mb-4">
              Số dư khả dụng: <strong className="fs-4 text-primary">{userBalance.toLocaleString()} đ</strong>
            </Alert>
            <Form.Group>
              <Form.Label className="fw-bold text-dark">Nhập số tiền cần rút (VNĐ)</Form.Label>
              <Form.Control type="number" min="50000" step="1000" max={userBalance} className="glass-input fs-3 fw-bold text-danger py-3" value={withdrawAmount} onChange={(e) => setWithdrawAmount(e.target.value)} placeholder="Ví dụ: 150000" required autoFocus />
              <Form.Text className="text-danger fw-bold mt-2 d-block">Mức rút tối thiểu: 50.000 đ</Form.Text>
            </Form.Group>
          </Modal.Body>
          <Modal.Footer className="justify-content-center border-light">
            <Button variant="secondary" className="glass-btn px-4" onClick={() => setShowWithdrawModal(false)}>Hủy</Button>
            <Button variant="danger" type="submit" disabled={isProcessing} className="glass-btn bg-danger text-white border-danger px-4 fw-bold shadow-sm">
              {isProcessing ? 'Đang xử lý...' : '🚀 Xác nhận Rút'}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </Container>
  );
}

export default WalletPage;