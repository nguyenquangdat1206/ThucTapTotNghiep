import React, { useState } from 'react';
import { Container, Row, Col, Card, Form, Button, Alert } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

function Register() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('customer'); // Mặc định là khách hàng
  
  // --- STATE MỚI ĐƯỢC THÊM VÀO ---
  const [phone, setPhone] = useState('');
  const [licensePlate, setLicensePlate] = useState('');
  
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);
  const navigate = useNavigate();

  const handleRegister = async (e) => {
    e.preventDefault();
    setMessage('');
    
    try {
      // Bắn API Đăng ký sang FastAPI (Đã bổ sung phone và license_plate)
      await axios.post('https://datquang-backend.onrender.com/register', {
        name: name,
        email: email,
        password: password,
        role: role,
        phone: phone,
        license_plate: role.startsWith('driver') ? licensePlate : null // Chỉ gửi biển số nếu là tài xế
      });

      setIsError(false);
      setMessage('🎉 Đăng ký thành công! Đang chuyển hướng về đăng nhập...');
      
      // Tự động chuyển về trang Login sau 2 giây
      setTimeout(() => {
        navigate('/');
      }, 2000);

    } catch (error) {
      setIsError(true);
      if (error.response && error.response.data) {
        setMessage(`❌ ${error.response.data.detail}`); 
      } else {
        setMessage("❌ Không thể kết nối đến máy chủ!");
      }
    }
  };

  return (
    <Container className="d-flex align-items-center justify-content-center" style={{ minHeight: "100vh" }}>
      <Row className="w-100">
        <Col md={{ span: 6, offset: 3 }} lg={{ span: 4, offset: 4 }}>
          <Card className="shadow border-top border-success border-4 my-4">
            <Card.Body>
              <h3 className="text-center mb-4 text-success">Đăng ký tài khoản</h3>
              
              {message && <Alert variant={isError ? "danger" : "success"}>{message}</Alert>}
              
              <Form onSubmit={handleRegister}>
                <Form.Group className="mb-3">
                  <Form.Label>Họ và Tên</Form.Label>
                  <Form.Control type="text" placeholder="Nhập tên của bạn" value={name} onChange={(e) => setName(e.target.value)} required />
                </Form.Group>

                <Form.Group className="mb-3">
                  <Form.Label>Email</Form.Label>
                  <Form.Control type="email" placeholder="Nhập email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </Form.Group>

                <Form.Group className="mb-3">
                  <Form.Label>Mật khẩu</Form.Label>
                  <Form.Control type="password" placeholder="Tạo mật khẩu" value={password} onChange={(e) => setPassword(e.target.value)} required />
                </Form.Group>
                
                {/* --- Ô NHẬP SỐ ĐIỆN THOẠI (BẮT BUỘC CHUNG) --- */}
                <Form.Group className="mb-3">
                  <Form.Label>Số điện thoại liên lạc</Form.Label>
                  <Form.Control 
                    type="tel" 
                    placeholder="Nhập số điện thoại..."
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required 
                  />
                </Form.Group>

                <Form.Group className="mb-3">
                  <Form.Label>Bạn là ai?</Form.Label>
                  <Form.Select value={role} onChange={(e) => {
                      setRole(e.target.value);
                      // Nếu chuyển về khách hàng thì xóa trắng ô biển số xe để tránh rác dữ liệu
                      if (!e.target.value.startsWith('driver')) {
                          setLicensePlate('');
                      }
                  }}>
                    <option value="customer">Khách hàng (Đặt giao hàng)</option>
                    <option value="driver_express">Tài xế (Xe máy - Giao hàng nhanh)</option>
                    <option value="driver_container">Tài xế (Xe đầu kéo - Container)</option>
                  </Form.Select>
                </Form.Group>

                {/* --- CHỈ HIỆN Ô NÀY NẾU CHỌN ROLE LÀ TÀI XẾ --- */}
                {role.startsWith('driver') && (
                  <Form.Group className="mb-4">
                    <Form.Label className="text-danger fw-bold">Biển số phương tiện</Form.Label>
                    <Form.Control 
                      type="text" 
                      placeholder="Ví dụ: 59X1-123.45"
                      value={licensePlate}
                      onChange={(e) => setLicensePlate(e.target.value)}
                      required={role.startsWith('driver')} // Bắt buộc nhập nếu là tài xế
                    />
                  </Form.Group>
                )}

                <Button variant="success" type="submit" className="w-100 mb-3">Hoàn tất Đăng ký</Button>
                
                <div className="text-center">
                  <small className="text-muted">
                    Đã có tài khoản? <span style={{ cursor: 'pointer', color: '#0d6efd', textDecoration: 'underline' }} onClick={() => navigate('/')}>Đăng nhập ngay</span>
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