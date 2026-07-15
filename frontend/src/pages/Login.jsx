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
    <Container className="d-flex align-items-center justify-content-center" style={{ minHeight: "100vh" }}>
      <Row className="w-100">
        <Col md={{ span: 6, offset: 3 }} lg={{ span: 4, offset: 4 }}>
          <Card className="shadow">
            <Card.Body>
              <h3 className="text-center mb-4 text-primary">Logistics Platform</h3>
              {errorMsg && <Alert variant="danger">{errorMsg}</Alert>}
              
              <Form onSubmit={handleLogin}>
                <Form.Group className="mb-3" controlId="formBasicEmail">
                  <Form.Label>Email</Form.Label>
                  <Form.Control type="email" placeholder="Nhập email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </Form.Group>

                <Form.Group className="mb-4" controlId="formBasicPassword">
                  <Form.Label>Mật khẩu</Form.Label>
                  <Form.Control type="password" placeholder="Nhập mật khẩu" value={password} onChange={(e) => setPassword(e.target.value)} required />
                </Form.Group>

                <Button variant="primary" type="submit" className="w-100 mb-3">Đăng nhập</Button>
                <div className="text-center">
                    <small className="text-muted">
                        Chưa có tài khoản? <span style={{ cursor: 'pointer', color: '#0d6efd', textDecoration: 'underline' }} onClick={() => navigate('/register')}>Đăng ký ngay</span>
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

export default Login; // Xuất ra để file khác sử dụng