import React, { useState, useEffect } from 'react';
import { Container, Card, Button, Table, Badge, Row, Col, Alert, Placeholder } from 'react-bootstrap';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';

function DriverProfileAdmin() {
  const { id } = useParams();
  const navigate = useNavigate();
  const userInfoString = localStorage.getItem('userInfo');
  const userInfo = userInfoString ? JSON.parse(userInfoString) : null;

  const [driverInfo, setDriverInfo] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userInfo || userInfo.role !== 'admin') { navigate('/'); return; }
    
    const fetchDriverProfile = async () => {
      setLoading(true);
      try {
        const response = await axios.get(`https://datquang-backend.onrender.com/admin/drivers/${id}/profile`);
        setDriverInfo(response.data.driver);
        setOrders(response.data.orders);
      } catch (error) { console.error(error); }
      setTimeout(() => setLoading(false), 600);
    };

    fetchDriverProfile();
  }, [id]);

  const handleToggleBan = async () => {
    let reason = "";
    if (driverInfo.is_active) {
      reason = window.prompt("🚨 Vui lòng nhập lý do KHÓA tài khoản (Tài xế sẽ nhìn thấy lý do này):", "Thái độ phục vụ kém, bị đánh giá dưới 2 sao nhiều lần.");
      if (reason === null) return; 
    } else {
      if (!window.confirm("🔓 Bạn muốn MỞ KHÓA cho tài khoản này?")) return;
    }

    try {
      await axios.put(`https://datquang-backend.onrender.com/admin/users/${id}/toggle_active`, { reason });
      // Reload lại thông tin
      const response = await axios.get(`https://datquang-backend.onrender.com/admin/drivers/${id}/profile`);
      setDriverInfo(response.data.driver);
    } catch (error) { alert("Lỗi khi thay đổi trạng thái!"); }
  };

  // HIỆU ỨNG SKELETON
  if (loading) return (
    <Container className="mt-4 mb-5">
      <Placeholder.Button variant="secondary" className="mb-3" style={{width: '100px'}} />
      <Row>
        <Col md={4}>
          <Card className="shadow-sm border-0 border-top border-4 border-secondary mb-4">
            <Card.Body className="text-center">
              <Placeholder animation="glow" className="mb-3">
                <Placeholder style={{width: '100px', height: '100px', borderRadius: '50%'}} />
              </Placeholder>
              <Placeholder as="h4" animation="glow"><Placeholder xs={6} /></Placeholder>
              <Placeholder as="p" animation="glow" className="mb-1"><Placeholder xs={4} /></Placeholder>
              <Placeholder animation="glow" className="mb-3"><Placeholder xs={3} bg="dark" style={{height: '25px', borderRadius: '5px'}}/></Placeholder>
              
              <div className="d-flex justify-content-between px-3 mt-3 mb-3">
                <Placeholder animation="glow" className="w-25"><Placeholder className="w-100" style={{height: '40px'}}/></Placeholder>
                <Placeholder animation="glow" className="w-25"><Placeholder className="w-100" style={{height: '40px'}}/></Placeholder>
              </div>
              <hr />
              <Placeholder.Button variant="secondary" className="w-100" style={{height: '40px'}} />
            </Card.Body>
          </Card>
        </Col>
        <Col md={8}>
          <Placeholder as="h4" animation="glow" className="border-bottom pb-2 mb-3"><Placeholder xs={5} /></Placeholder>
          <Placeholder animation="glow">
            <Placeholder className="w-100 mb-2 rounded" style={{height: '50px'}} />
            <Placeholder className="w-100 mb-2 rounded" style={{height: '50px'}} />
          </Placeholder>
          
          <Placeholder as="h4" animation="glow" className="border-bottom pb-2 mb-3 mt-5"><Placeholder xs={4} /></Placeholder>
          <Placeholder animation="glow">
            <Placeholder className="w-100 mb-2 rounded" style={{height: '40px'}} />
            <Placeholder className="w-100 mb-2 rounded" style={{height: '40px'}} />
            <Placeholder className="w-100 mb-2 rounded" style={{height: '40px'}} />
          </Placeholder>
        </Col>
      </Row>
    </Container>
  );

  if (!driverInfo) return <Container className="mt-5 text-center"><h3>Không tìm thấy tài xế</h3></Container>;

  const badReviews = orders.filter(o => o.rating && o.rating <= 2);
  const ratedOrders = orders.filter(o => o.rating);
  const avgRating = ratedOrders.length > 0 ? (ratedOrders.reduce((sum, o) => sum + o.rating, 0) / ratedOrders.length).toFixed(1) : "Chưa có";

  return (
    <Container className="mt-4 mb-5">
      <Button variant="outline-secondary" className="mb-3" onClick={() => navigate('/dashboard')}>⬅ Quay lại</Button>
      
      <Row>
        <Col md={4}>
          <Card className={`shadow-sm border-0 border-top border-4 ${driverInfo.is_active ? 'border-primary' : 'border-danger'} mb-4`}>
            <Card.Body className="text-center">
              {driverInfo.avatar_url ? <img src={driverInfo.avatar_url} width="100" height="100" className="rounded-circle mb-3" style={{objectFit: 'cover'}} alt="avt"/> : <div className="fs-1 mb-3">🛵</div>}
              <h4>{driverInfo.name}</h4>
              <p className="text-muted mb-1">📞 {driverInfo.phone}</p>
              <Badge bg="dark" className="mb-3 fs-6">{driverInfo.license_plate}</Badge>
              
              <div className="d-flex justify-content-between px-3 mt-3">
                <div className="text-center">
                  <h5 className="mb-0 text-success fw-bold">{orders.length}</h5>
                  <small className="text-muted">Tổng cuốc</small>
                </div>
                <div className="text-center">
                  <h5 className="mb-0 text-warning fw-bold">{avgRating} ⭐</h5>
                  <small className="text-muted">Đánh giá TB</small>
                </div>
              </div>

              <hr />
              <Button 
                variant={driverInfo.is_active ? "danger" : "success"} 
                className="w-100 fw-bold" 
                onClick={handleToggleBan}
              >
                {driverInfo.is_active ? "🔒 KHÓA TÀI KHOẢN (BAN)" : "🔓 MỞ KHÓA TÀI KHOẢN"}
              </Button>
              {!driverInfo.is_active && (
                <Alert variant="danger" className="mt-3 text-start mb-0 px-2 py-1 fs-6">
                  <strong>Lý do khóa:</strong> {driverInfo.ban_reason}
                </Alert>
              )}
            </Card.Body>
          </Card>
        </Col>

        <Col md={8}>
          <h4 className="text-danger border-bottom pb-2 mb-3">🚩 Cảnh báo: Các đơn hàng bị đánh giá thấp</h4>
          {badReviews.length === 0 ? (
            <Alert variant="success">Tài xế này chưa có đánh giá nào từ 2 sao trở xuống. Phong độ rất tốt!</Alert>
          ) : (
            <Table striped bordered hover className="mb-5">
              <thead className="table-danger">
                <tr><th>Mã Đơn</th><th>Số Sao</th><th>Nhận xét của khách</th><th>Thao tác</th></tr>
              </thead>
              <tbody>
                {badReviews.map(order => (
                  <tr key={order.id}>
                    <td>#{order.id}</td>
                    <td className="text-danger fw-bold">{order.rating} ⭐</td>
                    <td className="fst-italic">"{order.feedback || "Không có nhận xét"}"</td>
                    <td><Button size="sm" variant="info" className="text-white" onClick={() => navigate(`/order/${order.id}`)}>Xem chi tiết</Button></td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}

          <h4 className="text-primary border-bottom pb-2 mb-3">📦 Lịch sử tất cả cuốc xe</h4>
          <Table responsive hover size="sm">
            <thead className="table-light">
              <tr><th>Mã</th><th>Lộ trình</th><th>Giá tiền</th><th>Trạng thái</th><th>Đánh giá</th></tr>
            </thead>
            <tbody>
              {orders.map(order => (
                <tr key={order.id}>
                  <td>#{order.id}</td>
                  <td><small>{order.pickup_location} &rarr; {order.dropoff_location}</small></td>
                  <td className="text-success">{order.price.toLocaleString()}đ</td>
                  <td><Badge bg={order.status === 'completed' ? 'success' : 'secondary'}>{order.status}</Badge></td>
                  <td>{order.rating ? `${order.rating}⭐` : '-'}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Col>
      </Row>
    </Container>
  );
}

export default DriverProfileAdmin;