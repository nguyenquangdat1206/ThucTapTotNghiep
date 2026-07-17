import React from 'react';
import { Card, Badge, Row, Col, Button } from 'react-bootstrap';

export default function OrderContactInfo({ renderOrders, orderDetails, shouldHideInfo, batchOrders }) {
  return (
    <Card className="shadow-sm border-0 mt-4 mb-4">
      <Card.Header className="bg-white border-bottom border-info border-3">
        <h5 className="mb-0 text-info fw-bold">👥 Thông Tin Liên Lạc</h5>
      </Card.Header>
      <Card.Body className="bg-light">
        {/* ======================================= */}
        {/* 1. THÔNG TIN NGƯỜI GỬI VÀ NGƯỜI NHẬN */}
        {/* ======================================= */}
        {renderOrders.map((o, index) => (
          <div key={`contact-${o.id}`} className="mb-4 p-3 bg-white border rounded shadow-sm border-info border-start border-4">
            <h6 className="text-primary fw-bold border-bottom pb-2 mb-3">
                📦 Đơn hàng #{o.id} {batchOrders.length > 0 ? `(Khách thứ ${index + 1})` : ''}
            </h6>
            <Row>
                {/* NGƯỜI GỬI */}
                <Col md={6} className="mb-3 mb-md-0 border-end">
                    <strong className="text-secondary d-block mb-1">📍 Người Gửi:</strong>
                    <div className="fs-5 fw-bold text-dark">
                        {o.sender_name || (o.id === orderDetails.order?.id ? orderDetails.customer?.name : "Chưa cập nhật")}
                    </div>
                    <div className={shouldHideInfo ? "text-muted fst-italic mb-2" : "text-primary fw-bold fs-6 mb-2"}>
                        {shouldHideInfo ? '🔒 Đã ẩn bảo mật' : (o.sender_phone || (o.id === orderDetails.order?.id ? orderDetails.customer?.phone : "Chưa có SĐT"))}
                    </div>
                    {!shouldHideInfo && (o.sender_phone || orderDetails.customer?.phone) && (
                        <Button variant="outline-primary" size="sm" className="fw-bold w-100 mt-2" onClick={() => window.open(`tel:${o.sender_phone || orderDetails.customer?.phone}`)}>
                            📞 Gọi Người Gửi
                        </Button>
                    )}
                </Col>

                {/* NGƯỜI NHẬN */}
                <Col md={6}>
                    <strong className="text-secondary d-block mb-1">🚩 Người Nhận:</strong>
                    <div className="fs-5 fw-bold text-dark">
                        {o.receiver_name || "Chưa cập nhật"}
                    </div>
                    <div className={shouldHideInfo ? "text-muted fst-italic mb-2" : "text-danger fw-bold fs-6 mb-2"}>
                        {shouldHideInfo ? '🔒 Đã ẩn bảo mật' : (o.receiver_phone || "Chưa cập nhật")}
                    </div>
                    {!shouldHideInfo && o.receiver_phone && (
                        <Button variant="outline-danger" size="sm" className="fw-bold w-100 mt-2" onClick={() => window.open(`tel:${o.receiver_phone}`)}>
                            📞 Gọi Người Nhận
                        </Button>
                    )}
                </Col>
            </Row>
          </div>
        ))}

        {/* ======================================= */}
        {/* 2. THÔNG TIN TÀI XẾ TIẾP NHẬN */}
        {/* ======================================= */}
        <div className="mt-4">
          <strong className="text-secondary d-block mb-2">🏍️ Tài xế tiếp nhận:</strong>
          {orderDetails.driver ? (
            <div className="d-flex align-items-center p-3 bg-white rounded border shadow-sm border-success border-start border-4">
              {orderDetails.driver.avatar_url ? (
                  <img src={orderDetails.driver.avatar_url} width="60" height="60" className="rounded-circle me-3 border border-2 border-success" style={{objectFit: 'cover'}} alt="avt"/>
              ) : (
                  <div className="fs-1 me-3 p-2 bg-light rounded-circle">🛵</div>
              )}
              <div className="w-100">
                <div className="fw-bold fs-5 text-dark">{orderDetails.driver.name}</div>
                <div className={shouldHideInfo ? "text-muted fst-italic" : "text-success fw-bold fs-6"}>
                    📞 {shouldHideInfo ? '🔒 Đã ẩn bảo mật' : (orderDetails.driver.phone || 'Chưa có SĐT')}
                </div>
                {!shouldHideInfo && orderDetails.driver.phone && (
                    <Button variant="outline-success" size="sm" className="fw-bold w-100 mt-2" onClick={() => window.open(`tel:${orderDetails.driver.phone}`)}>
                        📞 Gọi Tài Xế
                    </Button>
                )}
              </div>
            </div>
          ) : (
              <div className="p-3 bg-white rounded border border-warning border-start border-4 text-center text-muted shadow-sm">
                  <i className="fs-6 text-warning fw-bold">⏳ Đơn hàng đang chờ tài xế nhận...</i>
              </div>
          )}
        </div>
      </Card.Body>
    </Card>
  );
}