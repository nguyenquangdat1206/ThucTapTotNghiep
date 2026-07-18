import React from 'react';
import { Container, Placeholder, Row, Col } from 'react-bootstrap';

export default function DashboardSkeleton() {
  return (
    <Container fluid className="py-5" style={{ backgroundColor: 'var(--bg-main)', minHeight: '100vh' }}>
      <Container style={{ maxWidth: '1200px' }}>
        
        {/* KHUNG HEADER TẢI TRANG */}
        <div className="logistics-card p-4 mb-4 d-flex justify-content-between align-items-center flex-wrap">
          <div className="d-flex align-items-center w-50">
            <Placeholder animation="glow" className="me-3">
              <Placeholder style={{ width: '65px', height: '65px', borderRadius: '12px', backgroundColor: 'var(--border-color)' }} />
            </Placeholder>
            <Placeholder as="div" animation="glow" className="w-50">
              <Placeholder xs={6} className="mb-2 rounded" style={{ backgroundColor: 'var(--border-color)', height: '20px' }} />
              <br/>
              <Placeholder xs={4} className="rounded" style={{ backgroundColor: 'var(--border-color)', height: '15px' }} />
            </Placeholder>
          </div>
          <Placeholder as="div" animation="glow" className="d-flex gap-2 mt-3 mt-md-0">
             <Placeholder.Button xs={12} style={{ width: '80px', backgroundColor: 'var(--border-color)', borderColor: 'var(--border-color)' }} />
             <Placeholder.Button xs={12} style={{ width: '80px', backgroundColor: 'var(--border-color)', borderColor: 'var(--border-color)' }} />
          </Placeholder>
        </div>

        {/* KHUNG THỐNG KÊ (Dùng chung cho Admin/Driver) */}
        <Row className="g-3 mb-4">
          {[1, 2, 3, 4].map(i => (
            <Col md={3} sm={6} key={i}>
              <div className="logistics-card p-4 text-center">
                <Placeholder as="div" animation="glow">
                  <Placeholder xs={8} className="mb-3 rounded" style={{ backgroundColor: 'var(--border-color)', height: '12px' }} />
                  <br/>
                  <Placeholder xs={5} className="rounded" style={{ backgroundColor: 'var(--border-color)', height: '30px' }} />
                </Placeholder>
              </div>
            </Col>
          ))}
        </Row>

        {/* KHUNG DANH SÁCH ĐƠN HÀNG */}
        <div className="logistics-card p-4">
          <Placeholder as="div" animation="glow" className="mb-4">
            <Placeholder xs={3} className="rounded" style={{ backgroundColor: 'var(--border-color)', height: '25px' }} />
          </Placeholder>
          
          {[1, 2, 3].map(i => (
            <div key={i} className="p-3 mb-3 rounded" style={{ border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-input)' }}>
              <Placeholder as="div" animation="glow" className="d-flex justify-content-between align-items-center">
                <div className="w-75">
                  <Placeholder xs={3} className="mb-2 rounded" style={{ backgroundColor: 'var(--border-color)', height: '20px' }} />
                  <br/>
                  <Placeholder xs={8} className="rounded" style={{ backgroundColor: 'var(--border-color)', height: '15px' }} />
                </div>
                <Placeholder.Button xs={2} style={{ backgroundColor: 'var(--border-color)', borderColor: 'var(--border-color)' }} />
              </Placeholder>
            </div>
          ))}
        </div>
        
      </Container>
    </Container>
  );
}