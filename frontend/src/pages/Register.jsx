import React, { useState } from 'react';
import { Container, Row, Col, Card, Form, Button, Alert } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

function Register() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('customer'); 
  const [phone, setPhone] = useState('');
  const [licensePlate, setLicensePlate] = useState('');
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);
  const navigate = useNavigate();

  const handleRegister = async (e) => {
    e.preventDefault();
    setMessage('');
    
    try {
      await axios.post('https://datquang-backend.onrender.com/register', {
        name: name, email: email, password: password, role: role, phone: phone,
        license_plate: role.startsWith('driver') ? licensePlate : null 
      });

      setIsError(false);
      setMessage('🎉 Đăng ký thành công! Đang chuyển hướng...');
      setTimeout(() => { navigate('/'); }, 2000);

    } catch (error) {
      setIsError(true);
      if (error.response && error.response.data) { setMessage(`❌ ${error.response.data.detail}`); } 
      else { setMessage("❌ Không thể kết nối đến máy chủ!"); }
    }
  };

  return (
    <Container fluid className="d-flex align-items-center justify-content-center py-5" style={{ minHeight: "100vh", backgroundColor: 'var(--bg-main)' }}>
      <Row className="w-100">
        <Col md={{ span: 8, offset: 2 }} lg={{ span: 6, offset: 3 }} xl={{ span: 4, offset: 4 }}>
          <Card className="logistics-card border-0 shadow-lg p-3" style={{ borderTop: '4px solid var(--brand-orange) !important' }}>
            <Card.Body>
              <h3 className="text-center mb-4 text-white fw-bold tracking-wide">TẠO TÀI KHOẢN</h3>
              
              {message && <Alert variant={isError ? "danger" : "success"} className="fw-bold bg-transparent" style={{ borderColor: isError ? '#FF4D4D' : '#4ADE80', color: isError ? '#FF4D4D' : '#4ADE80' }}>{message}</Alert>}
              
              <Form onSubmit={handleRegister}>
                <Row className="g-3 mb-3">
                  <Col md={6}>
                    <Form.Group>
                      <Form.Label className="text-muted fw-bold" style={{ fontSize: '12px' }}>HỌ VÀ TÊN</Form.Label>
                      <Form.Control type="text" className="logistics-input" placeholder="Tên của bạn" value={name} onChange={(e) => setName(e.target.value)} required />
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group>
                      <Form.Label className="text-muted fw-bold" style={{ fontSize: '12px' }}>SỐ ĐIỆN THOẠI</Form.Label>
                      <Form.Control type="tel" className="logistics-input" placeholder="09xx..." value={phone} onChange={(e) => setPhone(e.target.value)} required />
                    </Form.Group>
                  </Col>
                </Row>

                <Form.Group className="mb-3">
                  <Form.Label className="text-muted fw-bold" style={{ fontSize: '12px' }}>EMAIL</Form.Label>
                  <Form.Control type="email" className="logistics-input" placeholder="Nhập email..." value={email} onChange={(e) => setEmail(e.target.value)} required />
                </Form.Group>

                <Form.Group className="mb-3">
                  <Form.Label className="text-muted fw-bold" style={{ fontSize: '12px' }}>MẬT KHẨU</Form.Label>
                  <Form.Control type="password" className="logistics-input" placeholder="Tạo mật khẩu an toàn..." value={password} onChange={(e) => setPassword(e.target.value)} required />
                </Form.Group>

                <Form.Group className="mb-3">
                  <Form.Label className="text-muted fw-bold" style={{ fontSize: '12px' }}>BẠN LÀ AI?</Form.Label>
                  <Form.Select className="logistics-input fw-bold" value={role} onChange={(e) => {
                      setRole(e.target.value);
                      if (!e.target.value.startsWith('driver')) setLicensePlate('');
                  }}>
                    <option value="customer">Khách hàng (Cần giao hàng)</option>
                    <option value="driver_express">Tài xế (Xe máy - Chở nhẹ)</option>
                    <option value="driver_container">Tài xế (Đầu kéo - Container)</option>
                  </Form.Select>
                </Form.Group>

                {role.startsWith('driver') && (
                  <Form.Group className="mb-4 p-3 rounded" style={{ backgroundColor: 'var(--brand-orange-dim)', border: '1px solid var(--brand-orange)' }}>
                    <Form.Label className="fw-bold" style={{ color: 'var(--brand-orange)', fontSize: '12px' }}>BIỂN SỐ PHƯƠNG TIỆN</Form.Label>
                    <Form.Control type="text" className="logistics-input text-uppercase fw-bold text-white" placeholder="VD: 51H-123.45" value={licensePlate} onChange={(e) => setLicensePlate(e.target.value)} required={role.startsWith('driver')} />
                  </Form.Group>
                )}

                <Button type="submit" className="btn-orange w-100 mt-2 mb-4 py-3 fs-5 fw-bold tracking-wide">ĐĂNG KÝ NGAY</Button>
                
                <div className="text-center border-top pt-3" style={{ borderColor: 'var(--border-color)' }}>
                  <small className="text-muted fw-bold">
                    Đã có tài khoản? <span style={{ cursor: 'pointer', color: 'var(--brand-orange)' }} onClick={() => navigate('/')}>Đăng nhập ngay</span>
                  </small>
                </div>
              </Form>

            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
}

export default Register;