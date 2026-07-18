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
      const response = await axios.get(`https://datquang-backend.onrender.com/admin/drivers/${id}/profile`);
      setDriverInfo(response.data.driver);
    } catch (error) { alert("Lỗi khi thay đổi trạng thái!"); }
  };

  // HIỆU ỨNG SKELETON CHUẨN DARK MODE
  if (loading) return (
    <Container fluid className="py-5" style={{ backgroundColor: 'var(--bg-main)', minHeight: '100vh' }}>
      <Container style={{ maxWidth: '1000px' }}>
        <Placeholder.Button variant="secondary" className="mb-4" style={{width: '100px', backgroundColor: 'var(--border-color)', borderColor: 'var(--border-color)'}} />
        <Row className="g-4">
          <Col md={4}>
            <div className="logistics-card p-4 text-center">
              <Placeholder animation="glow" className="mb-3">
                <Placeholder style={{width: '100px', height: '100px', borderRadius: '50%', backgroundColor: 'var(--border-color)'}} />
              </Placeholder>
              <Placeholder as="h4" animation="glow"><Placeholder xs={6} style={{backgroundColor: 'var(--border-color)'}}/></Placeholder>
              <Placeholder as="p" animation="glow" className="mb-1"><Placeholder xs={4} style={{backgroundColor: 'var(--border-color)'}}/></Placeholder>
              <Placeholder animation="glow" className="mb-3"><Placeholder xs={4} style={{height: '25px', borderRadius: '5px', backgroundColor: 'var(--border-color)'}}/></Placeholder>
            </div>
          </Col>
          <Col md={8}>
            <div className="logistics-card p-4">
              <Placeholder as="h4" animation="glow" className="mb-4"><Placeholder xs={4} style={{backgroundColor: 'var(--border-color)'}}/></Placeholder>
              <Placeholder animation="glow">
                <Placeholder className="w-100 mb-3 rounded" style={{height: '60px', backgroundColor: 'var(--bg-input)'}} />
                <Placeholder className="w-100 mb-3 rounded" style={{height: '60px', backgroundColor: 'var(--bg-input)'}} />
              </Placeholder>
            </div>
          </Col>
        </Row>
      </Container>
    </Container>
  );

  if (!driverInfo) return <Container fluid className="py-5 text-center text-white" style={{ backgroundColor: 'var(--bg-main)', minHeight: '100vh' }}><h3>Không tìm thấy tài xế</h3></Container>;

  const badReviews = orders.filter(o => o.rating && o.rating <= 2);
  const ratedOrders = orders.filter(o => o.rating);
  const avgRating = ratedOrders.length > 0 ? (ratedOrders.reduce((sum, o) => sum + o.rating, 0) / ratedOrders.length).toFixed(1) : "Chưa có";

  return (
    <Container fluid className="py-5" style={{ backgroundColor: 'var(--bg-main)', minHeight: '100vh' }}>
      <Container style={{ maxWidth: '1100px' }}>
        <Button variant="outline-light" className="mb-4 fw-bold" style={{ borderColor: 'var(--border-color)' }} onClick={() => navigate('/dashboard')}>
          ⬅ Quay lại Quản lý
        </Button>
        
        <Row className="g-4">
          {/* CỘT TRÁI: THÔNG TIN TÀI XẾ */}
          <Col md={4}>
            <div className="logistics-card p-4 text-center" style={{ borderTop: `4px solid ${driverInfo.is_active ? '#4ADE80' : '#FF4D4D'}` }}>
              {driverInfo.avatar_url ? (
                <img src={driverInfo.avatar_url} width="100" height="100" className="rounded-circle mb-3 border" style={{objectFit: 'cover', borderColor: 'var(--border-color)'}} alt="avt"/>
              ) : (
                <div className="d-inline-flex justify-content-center align-items-center rounded-circle mb-3 border" style={{width: '100px', height: '100px', backgroundColor: 'var(--bg-input)', borderColor: 'var(--border-color)', fontSize: '40px'}}>🛵</div>
              )}
              
              <h4 className="text-white fw-bold">{driverInfo.name}</h4>
              <p className="text-muted mb-2">📞 {driverInfo.phone}</p>
              <Badge bg="dark" className="mb-4 fs-6 px-3 py-2 border border-secondary text-white">{driverInfo.license_plate}</Badge>
              
              <div className="d-flex justify-content-between p-3 rounded mb-4" style={{ backgroundColor: 'var(--bg-input)' }}>
                <div className="text-center w-50 border-end" style={{ borderColor: 'var(--border-color) !important' }}>
                  <h4 className="mb-1 text-success fw-bold">{orders.length}</h4>
                  <small className="text-muted fw-bold">Tổng cuốc</small>
                </div>
                <div className="text-center w-50">
                  <h4 className="mb-1 text-warning fw-bold">{avgRating} <span className="fs-5">⭐</span></h4>
                  <small className="text-muted fw-bold">Đánh giá TB</small>
                </div>
              </div>

              <Button 
                variant={driverInfo.is_active ? "outline-danger" : "success"} 
                className={`w-100 fw-bold py-2 ${driverInfo.is_active ? '' : 'btn-orange border-0'}`} 
                onClick={handleToggleBan}
              >
                {driverInfo.is_active ? "🔒 KHÓA TÀI KHOẢN (BAN)" : "🔓 MỞ KHÓA TÀI KHOẢN"}
              </Button>
              
              {!driverInfo.is_active && (
                <div className="mt-3 p-3 rounded text-start" style={{ backgroundColor: 'rgba(255, 77, 77, 0.1)', border: '1px solid #FF4D4D' }}>
                  <strong className="text-danger">Lý do khóa:</strong> <br/><span className="text-white">{driverInfo.ban_reason}</span>
                </div>
              )}
            </div>
          </Col>

          {/* CỘT PHẢI: LỊCH SỬ & CẢNH BÁO */}
          <Col md={8}>
            
            {/* DANH SÁCH CẢNH BÁO SAO THẤP */}
            <div className="logistics-card p-4 mb-4">
              <h5 className="fw-bold mb-4 d-flex align-items-center gap-2" style={{ color: '#FF4D4D' }}>
                <span className="fs-4">🚩</span> Cảnh báo: Đơn hàng bị đánh giá thấp
              </h5>
              
              {badReviews.length === 0 ? (
                <div className="p-3 rounded fw-bold text-success" style={{ backgroundColor: 'rgba(74, 222, 128, 0.1)', border: '1px solid #4ADE80' }}>
                  Tài xế này chưa có đánh giá nào từ 2 sao trở xuống. Phong độ rất tốt!
                </div>
              ) : (
                <div className="table-responsive">
                  <Table className="align-middle mb-0" style={{ '--bs-table-bg': 'transparent', '--bs-table-color': 'var(--text-main)', '--bs-table-border-color': 'var(--border-color)' }}>
                    <thead>
                      <tr>
                        <th className="py-2 text-muted fw-bold border-bottom">Mã Đơn</th>
                        <th className="py-2 text-muted fw-bold border-bottom">Số Sao</th>
                        <th className="py-2 text-muted fw-bold border-bottom">Nhận xét của khách</th>
                        <th className="py-2 text-muted fw-bold border-bottom text-end">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody>
                      {badReviews.map(order => (
                        <tr key={order.id}>
                          <td className="py-3 fw-bold">#{order.id}</td>
                          <td className="py-3 text-danger fw-bold fs-5">{order.rating} ⭐</td>
                          <td className="py-3 fst-italic text-white">"{order.feedback || "Không có nhận xét"}"</td>
                          <td className="py-3 text-end"><Button size="sm" variant="outline-light" style={{ borderColor: 'var(--border-color)' }} onClick={() => navigate(`/order/${order.id}`)}>Chi tiết</Button></td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </div>
              )}
            </div>

            {/* TẤT CẢ LỊCH SỬ CUỐC XE */}
            <div className="logistics-card p-4">
              <h5 className="text-white fw-bold mb-4 d-flex align-items-center gap-2">
                <span className="fs-4">📦</span> Lịch sử tất cả cuốc xe
              </h5>
              
              <div className="table-responsive">
                <Table className="align-middle mb-0" style={{ '--bs-table-bg': 'transparent', '--bs-table-color': 'var(--text-main)', '--bs-table-border-color': 'var(--border-color)' }}>
                  <thead>
                    <tr>
                      <th className="py-3 text-muted fw-bold border-bottom">Mã</th>
                      <th className="py-3 text-muted fw-bold border-bottom">Lộ trình</th>
                      <th className="py-3 text-muted fw-bold border-bottom">Giá tiền</th>
                      <th className="py-3 text-muted fw-bold border-bottom">Trạng thái</th>
                      <th className="py-3 text-muted fw-bold border-bottom text-end">Đánh giá</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map(order => (
                      <tr key={order.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/order/${order.id}`)}>
                        <td className="py-3 fw-bold">#{order.id}</td>
                        <td className="py-3" style={{ maxWidth: '200px' }}>
                          <div className="text-truncate text-white" title={order.pickup_location}>{order.pickup_location}</div>
                          <div className="text-muted" style={{ fontSize: '12px' }}>⬇</div>
                          <div className="text-truncate text-white" title={order.dropoff_location}>{order.dropoff_location}</div>
                        </td>
                        <td className="py-3 text-success fw-bold">{order.price.toLocaleString()}đ</td>
                        <td className="py-3"><Badge bg={order.status === 'completed' ? 'success' : 'secondary'} className="px-2 py-1">{order.status}</Badge></td>
                        <td className="py-3 text-end fw-bold text-warning">{order.rating ? `${order.rating} ⭐` : <span className="text-muted fw-normal">-</span>}</td>
                      </tr>
                    ))}
                    {orders.length === 0 && (
                      <tr><td colSpan="5" className="text-center py-4 text-muted fw-bold">Chưa có chuyến xe nào</td></tr>
                    )}
                  </tbody>
                </Table>
              </div>
            </div>

          </Col>
        </Row>
      </Container>
    </Container>
  );
}

export default DriverProfileAdmin;