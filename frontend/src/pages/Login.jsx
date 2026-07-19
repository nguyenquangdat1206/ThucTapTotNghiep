import React, { useState } from 'react';
import { Container, Row, Col, Card, Form, Button, Alert } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    
    try {
      const response = await axios.post('https://datquang-backend.onrender.com/login', {
        email: email,
        password: password
      });

      const userData = response.data;
      localStorage.setItem('userInfo', JSON.stringify(userData));
      navigate('/dashboard');

    } catch (error) {
      if (error.response && error.response.data) {
        setErrorMsg(error.response.data.detail); 
      } else {
        setErrorMsg("Không thể kết nối đến máy chủ!");
      }
    }
  };

  return (
    <Container fluid className="d-flex align-items-center justify-content-center" 
               style={{ 
                 minHeight: "100vh", 
                 // Phủ một lớp màu tối (gradient) lên trên ảnh nền để form đăng nhập nổi bật hơn
                 backgroundImage: `linear-gradient(rgba(11, 19, 14, 0.6), rgba(11, 19, 14, 0.8)), url('/bg-login.jpg')`,
                 backgroundSize: 'cover',
                 backgroundPosition: 'center',
                 backgroundRepeat: 'no-repeat'
               }}>
      <Row className="w-100">
        <Col md={{ span: 6, offset: 3 }} lg={{ span: 4, offset: 4 }}>
          {/* Form đăng nhập dạng kính mờ (Glassmorphism) trên nền tối */}
          <Card className="border-0 p-3" 
                style={{ 
                  boxShadow: '0 15px 35px rgba(0,0,0,0.6)', 
                  backgroundColor: 'rgba(11, 19, 14, 0.75)', // Nền đen trong suốt 75%
                  backdropFilter: 'blur(10px)', // Hiệu ứng làm mờ cảnh phía sau
                  border: '1px solid rgba(255, 102, 51, 0.3) !important', // Viền cam siêu mỏng
                  borderRadius: '16px'
                }}>
            <Card.Body>
              <div className="text-center mb-4">
                  <div className="d-inline-flex justify-content-center align-items-center rounded-circle mb-3 shadow" style={{ width: '60px', height: '60px', backgroundColor: 'var(--brand-orange)', color: '#fff', fontSize: '28px' }}>🚚</div>
                  <h3 className="fw-bold tracking-wide text-white" style={{ letterSpacing: '2px', textShadow: '0 2px 4px rgba(0,0,0,0.8)' }}>LOGISTICS PRO</h3>
              </div>
              
              {errorMsg && <Alert variant="danger" className="fw-bold border-danger bg-transparent text-danger">{errorMsg}</Alert>}
              
              <Form onSubmit={handleLogin}>
                <Form.Group className="mb-3" controlId="formBasicEmail">
                  <Form.Label className="text-white fw-bold" style={{ fontSize: '13px' }}>EMAIL ĐĂNG NHẬP</Form.Label>
                  <Form.Control type="email" className="logistics-input py-2" placeholder="Nhập email..." value={email} onChange={(e) => setEmail(e.target.value)} required />
                </Form.Group>

                <Form.Group className="mb-4" controlId="formBasicPassword">
                  <Form.Label className="text-white fw-bold" style={{ fontSize: '13px' }}>MẬT KHẨU</Form.Label>
                  <Form.Control type="password" className="logistics-input py-2" placeholder="Nhập mật khẩu..." value={password} onChange={(e) => setPassword(e.target.value)} required />
                </Form.Group>

                <Button type="submit" className="btn-orange w-100 mb-4 py-3 fs-5 fw-bold tracking-wide shadow">ĐĂNG NHẬP</Button>
                
                <div className="text-center border-top pt-3" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
                    <small className="text-light fw-bold">
                        Chưa có tài khoản? <span style={{ cursor: 'pointer', color: 'var(--brand-orange)' }} onClick={() => navigate('/register')}>Đăng ký ngay</span>
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

export default Login;