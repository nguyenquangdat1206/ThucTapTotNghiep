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

  // STATE NẠP TIỀN
  const [showTopupModal, setShowTopupModal] = useState(false);
  const [topupAmount, setTopupAmount] = useState('');

  // STATE RÚT TIỀN
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

    const ws = new WebSocket(`wss://datquang.onrender.com/ws/${userInfo.user_id}/${userInfo.role}`);
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.event === 'balance_changed') {
        fetchUserInfo();
        if (userInfo.role.startsWith('driver')) fetchTransactions();
        if (userInfo.role === 'admin') fetchUsersList();
      }
    };
    return () => ws.close();
  }, []);

  // [ĐÃ SỬA] TÀI XẾ TỰ NẠP TIỀN
  const handleTopupSubmit = async (e) => {
    e.preventDefault();
    setIsProcessing(true);
    try {
      await axios.post(`https://datquang-backend.onrender.com/users/${userInfo.user_id}/topup`, { amount: parseFloat(topupAmount) });
      setActionMessage(`✅ Đã nạp thành công ${parseFloat(topupAmount).toLocaleString()}đ vào ví của bạn qua VNPay!`);
      setShowTopupModal(false);
      setTopupAmount('');
      fetchUserInfo();
      fetchTransactions();
    } catch (error) { 
      setActionMessage("❌ Lỗi nạp tiền!"); 
    } finally {
      setIsProcessing(false);
    }
  };

  // LỆNH RÚT TIỀN
  const handleWithdrawSubmit = async (e) => {
    e.preventDefault();
    setIsProcessing(true);
    try {
      await axios.post(`https://datquang-backend.onrender.com/users/${userInfo.user_id}/withdraw`, { amount: parseFloat(withdrawAmount) });
      setActionMessage(`✅ Đã tạo lệnh rút thành công ${parseFloat(withdrawAmount).toLocaleString()}đ về tài khoản ngân hàng của bạn!`);
      setShowWithdrawModal(false);
      setWithdrawAmount('');
      fetchUserInfo();
      fetchTransactions();
    } catch (error) { 
      const errorMsg = error.response?.data?.detail || "Lỗi xử lý rút tiền!";
      setActionMessage(`❌ ${errorMsg}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // BỘ LỌC
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
        <Placeholder.Button variant="secondary" style={{width: '120px'}} />
      </div>
      <Row>
        <Col md={12}>
          <Card className="shadow-sm border-0">
            <Card.Header className="bg-dark py-3">
              <Placeholder as="h5" animation="glow"><Placeholder xs={3} /></Placeholder>
            </Card.Header>
            <Card.Body>
               <Placeholder animation="glow">
                 <Placeholder className="w-100 mb-2 rounded" style={{height: '45px'}} />
                 <Placeholder className="w-100 mb-2 rounded" style={{height: '45px'}} />
               </Placeholder>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );

  const driverList = usersList.filter(u => u.role.startsWith('driver') && !u.role.startsWith('pending_'));

  return (
    <Container className="mt-5 mb-5" style={{ maxWidth: userInfo.role === 'admin' ? '1200px' : '650px' }}>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2 className="text-success mb-0">💳 {userInfo.role === 'admin' ? "Quản Lý Dòng Tiền" : "Ví Điện Tử"}</h2>
        <Button variant="outline-secondary" onClick={() => navigate('/dashboard')}>⬅ Quay lại Radar</Button>
      </div>

      {actionMessage && <Alert variant={actionMessage.includes('❌') ? 'danger' : 'success'}>{actionMessage}</Alert>}

      <Row>
        {/* ======================================= */}
        {/* GIAO DIỆN VÍ TÀI XẾ (TỰ NẠP / TỰ RÚT)   */}
        {/* ======================================= */}
        {userInfo.role.startsWith('driver') && (
          <Col md={12}>
            <Card className="shadow-sm border-0 mb-4 rounded-4 overflow-hidden text-center">
              <Card.Header className="bg-success text-white py-3 border-0">
                <h5 className="mb-0 fw-bold">Số dư trong ví (Ký quỹ)</h5>
              </Card.Header>
              <Card.Body className="py-4 bg-white">
                <h1 className="display-4 fw-bold text-success mb-3">
                  {userBalance.toLocaleString()} <span className="fs-3">đ</span>
                </h1>
                
                {/* [ĐÃ SỬA] HAI NÚT NẠP VÀ RÚT CHO TÀI XẾ */}
                <div className="d-flex justify-content-center gap-3 mb-3 mt-4">
                   <Button variant="outline-primary" className="fw-bold px-5 py-2 rounded-pill shadow-sm" onClick={() => setShowTopupModal(true)}>
                     💳 NẠP TIỀN
                   </Button>
                   <Button variant="outline-success" className="fw-bold px-5 py-2 rounded-pill shadow-sm" onClick={() => setShowWithdrawModal(true)}>
                     🏧 RÚT TIỀN
                   </Button>
                </div>
              </Card.Body>
            </Card>

            <div className="d-flex justify-content-between align-items-center mb-3 px-2 mt-4">
              <h5 className="mb-0 fw-bold text-secondary">Lịch sử giao dịch</h5>
              <Form.Select 
                size="sm" 
                style={{ width: 'auto', minWidth: '190px', cursor: 'pointer', borderRadius: '8px' }}
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="shadow-sm border-secondary fw-bold text-primary"
              >
                <option value="all">Tất cả giao dịch</option>
                <option value="income">Phí ship (Sau hoa hồng)</option>
                <option value="tip">Tiền Tip (+)</option>
                <option value="surcharge">Phụ thu (Cồng kềnh/Tận cửa)</option>
                <option value="deduction">Khấu trừ hoa hồng (-)</option>
                <option value="withdrawal">Rút tiền (-)</option>
                <option value="topup">Nạp tiền vào ví (+)</option>
              </Form.Select>
            </div>

            <Card className="shadow-sm border-0 rounded-4 overflow-hidden mb-4">
              <ListGroup variant="flush">
                {filteredTransactions.length === 0 ? (
                  <div className="text-center py-5 text-muted">
                    <div className="fs-1 mb-2">📭</div>
                    Chưa có giao dịch nào
                  </div>
                ) : (
                  filteredTransactions.map((item, index) => (
                    <ListGroup.Item key={index} className="py-3 px-3 border-bottom border-light">
                      <div className="d-flex justify-content-between align-items-center">
                        <div className="d-flex align-items-center">
                          <div className="bg-light rounded-circle d-flex justify-content-center align-items-center me-3 border border-secondary" style={{width: '45px', height: '45px', fontSize: '1.2rem'}}>
                            {getTransactionIcon(item.type)}
                          </div>
                          <div>
                            <div className="fw-bold text-dark" style={{fontSize: '1.05rem'}}>{item.title}</div>
                            <div className="text-muted" style={{fontSize: '0.85rem'}}>{formatDate(item.timestamp)}</div>
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
            </Card>
          </Col>
        )}

        {/* ======================================= */}
        {/* GIAO DIỆN ADMIN (CHỈ XEM BÁO CÁO)       */}
        {/* ======================================= */}
        {userInfo.role === 'admin' && (
          <Col md={12}>
            <Card className="shadow-sm border-0">
              <Card.Header className="bg-dark text-white">
                <h5 className="mb-0">Báo cáo số dư ví đối tác (Tài xế)</h5>
              </Card.Header>
              <Card.Body>
                <Table striped bordered hover responsive>
                  <thead className="table-light">
                    <tr>
                      <th>ID</th>
                      <th>Họ và Tên Đối tác</th>
                      <th>Loại phương tiện</th>
                      <th>Số dư ví hiện tại</th>
                    </tr>
                  </thead>
                  <tbody>
                    {driverList.map(driver => (
                      <tr key={driver.id}>
                        <td>#{driver.id}</td>
                        <td className="fw-bold">{driver.name}</td>
                        <td><Badge bg="info">{driver.role === 'driver_express' ? 'XE MÁY' : 'CONTAINER'}</Badge></td>
                        <td><strong className="text-success fs-5">{driver.balance.toLocaleString()} đ</strong></td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </Card.Body>
            </Card>
          </Col>
        )}
      </Row>

      {/* POPUP NẠP TIỀN CỦA TÀI XẾ */}
      <Modal show={showTopupModal} onHide={() => setShowTopupModal(false)} centered>
        <Modal.Header closeButton className="bg-primary text-white">
          <Modal.Title>💳 Nạp Tiền Vào Ví</Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleTopupSubmit}>
          <Modal.Body>
            <Form.Group>
              <Form.Label className="fw-bold">Nhập số tiền muốn nạp</Form.Label>
              <InputGroup>
                <Form.Control 
                  type="number" 
                  min="10000" 
                  step="1000" 
                  value={topupAmount} 
                  onChange={(e) => setTopupAmount(e.target.value)} 
                  placeholder="Ví dụ: 50000"
                  required 
                />
                <InputGroup.Text className="fw-bold">VNĐ</InputGroup.Text>
              </InputGroup>
              <Form.Text className="text-muted">Hỗ trợ cổng thanh toán VNPay, MoMo, ZaloPay.</Form.Text>
            </Form.Group>
          </Modal.Body>
          <Modal.Footer className="justify-content-center">
            <Button variant="secondary" onClick={() => setShowTopupModal(false)} className="px-4">Hủy</Button>
            <Button variant="primary" type="submit" disabled={isProcessing} className="px-4 fw-bold shadow-sm">
              {isProcessing ? 'Đang chuyển hướng...' : 'Thanh Toán Ngay'}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* POPUP RÚT TIỀN CỦA TÀI XẾ */}
      <Modal show={showWithdrawModal} onHide={() => setShowWithdrawModal(false)} centered>
        <Modal.Header closeButton className="bg-success text-white">
          <Modal.Title>🏧 Rút Tiền Về Ngân Hàng</Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleWithdrawSubmit}>
          <Modal.Body>
            <Alert variant="info" className="text-center">
              Số dư khả dụng của bạn: <strong className="fs-5">{userBalance.toLocaleString()} đ</strong>
            </Alert>
            <Form.Group>
              <Form.Label className="fw-bold">Nhập số tiền cần rút</Form.Label>
              <InputGroup>
                <Form.Control 
                  type="number" 
                  min="50000" 
                  step="1000" 
                  max={userBalance} 
                  value={withdrawAmount} 
                  onChange={(e) => setWithdrawAmount(e.target.value)} 
                  placeholder="Ví dụ: 150000"
                  required 
                />
                <InputGroup.Text className="fw-bold">VNĐ</InputGroup.Text>
              </InputGroup>
              <Form.Text className="text-danger fw-bold">Mức rút tối thiểu: 50.000 đ</Form.Text>
            </Form.Group>
          </Modal.Body>
          <Modal.Footer className="justify-content-center">
            <Button variant="secondary" onClick={() => setShowWithdrawModal(false)} className="px-4">Hủy</Button>
            <Button variant="success" type="submit" disabled={isProcessing} className="px-4 fw-bold shadow-sm">
              {isProcessing ? 'Đang xử lý...' : '🚀 Xác nhận Rút'}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

    </Container>
  );
}

export default WalletPage;