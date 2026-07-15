import React from 'react';
import { Container, Card, Placeholder, Row, Col } from 'react-bootstrap';

export default function DashboardSkeleton() {
  return (
    <Container className="mt-5">
      <Card className="shadow p-4 border-top border-secondary border-4 mb-5">
        <Placeholder as="h2" animation="glow" className="mb-4">
          <Placeholder xs={4} />
        </Placeholder>
        <div className="d-flex justify-content-between align-items-center mb-3">
          <div className="d-flex align-items-center">
            <Placeholder animation="glow">
              <Placeholder style={{width: '60px', height: '60px', borderRadius: '50%'}} />
            </Placeholder>
            <div className="ms-3">
              <Placeholder as="h5" animation="glow" className="mb-1">
                <Placeholder xs={12} style={{width: '150px'}} />
              </Placeholder>
              <Placeholder as="div" animation="glow">
                <Placeholder xs={12} style={{width: '100px'}} />
              </Placeholder>
            </div>
          </div>
          <div>
            <Placeholder.Button variant="outline-secondary" className="me-2" style={{width: '80px'}} />
            <Placeholder.Button variant="outline-secondary" style={{width: '80px'}} />
          </div>
        </div>
        <hr />
        <Row className="mb-4 mt-4">
          {[1, 2, 3, 4].map(i => (
            <Col md={3} key={i}>
              <Placeholder animation="glow">
                <Placeholder className="w-100 rounded shadow-sm" style={{height: '90px'}} />
              </Placeholder>
            </Col>
          ))}
        </Row>
        <Placeholder animation="glow">
          <Placeholder className="w-100 rounded" style={{height: '250px'}} />
        </Placeholder>
      </Card>
    </Container>
  );
}