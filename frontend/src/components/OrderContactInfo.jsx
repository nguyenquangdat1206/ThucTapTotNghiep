import React from 'react';
import { Row, Col, Button } from 'react-bootstrap';

export default function OrderContactInfo({ renderOrders, orderDetails, shouldHideInfo, batchOrders }) {
  return (
    <div className="logistics-card p-4 mt-4 mb-4">
      <h5 className="mb-4 text-white fw-bold d-flex align-items-center gap-2 border-bottom pb-3" style={{ borderColor: 'var(--border-color) !important' }}>
        <span className="fs-4">👥</span> Hồ Sơ Liên Lạc
      </h5>
      
      {/* ======================================= */}
      {/* 1. THÔNG TIN NGƯỜI GỬI VÀ NGƯỜI NHẬN */}
      {/* ======================================= */}
      {renderOrders.map((o, index) => (
        <div key={`contact-${o.id}`} className="mb-4 p-4 rounded border" style={{ backgroundColor: 'var(--bg-input)', borderColor: 'var(--border-color) !important' }}>
          <h6 className="text-white fw-bold mb-4">
              Đơn hàng #{o.id} <span className="text-muted ms-2">{batchOrders.length > 0 ? `(Khách thứ ${index + 1})` : ''}</span>
          </h6>
          <Row className="g-4">
              {/* NGƯỜI GỬI */}
              <Col md={6} className="border-end-md" style={{ borderColor: 'var(--border-color) !important' }}>
                  <strong className="text-muted d-block mb-2" style={{ fontSize: '12px' }}>📍 THÔNG TIN NGƯỜI GỬI</strong>
                  <div className="fs-5 fw-bold text-white mb-1">
                      {o.sender_name || (o.id === orderDetails.order?.id ? orderDetails.customer?.name : "Chưa cập nhật")}
                  </div>
                  <div className={shouldHideInfo ? "text-muted fst-italic mb-3" : "text-white fw-bold fs-6 mb-3"}>
                      {shouldHideInfo ? '🔒 Đã ẩn bảo mật' : (o.sender_phone || (o.id === orderDetails.order?.id ? orderDetails.customer?.phone : "Chưa có SĐT"))}
                  </div>
                  {!shouldHideInfo && (o.sender_phone || orderDetails.customer?.phone) && (
                      <Button variant="outline-light" size="sm" className="fw-bold w-100" style={{ borderColor: 'var(--border-color)' }} onClick={() => window.open(`tel:${o.sender_phone || orderDetails.customer?.phone}`)}>
                          📞 Gọi Người Gửi
                      </Button>
                  )}
              </Col>

              {/* NGƯỜI NHẬN */}
              <Col md={6}>
                  <strong className="text-muted d-block mb-2" style={{ fontSize: '12px' }}>🚩 THÔNG TIN NGƯỜI NHẬN</strong>
                  <div className="fs-5 fw-bold text-white mb-1">
                      {o.receiver_name || "Chưa cập nhật"}
                  </div>
                  <div className={shouldHideInfo ? "text-muted fst-italic mb-3" : "text-white fw-bold fs-6 mb-3"}>
                      {shouldHideInfo ? '🔒 Đã ẩn bảo mật' : (o.receiver_phone || "Chưa cập nhật")}
                  </div>
                  {!shouldHideInfo && o.receiver_phone && (
                      <Button variant="outline-light" size="sm" className="fw-bold w-100" style={{ borderColor: 'var(--border-color)' }} onClick={() => window.open(`tel:${o.receiver_phone}`)}>
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
      <div className="mt-5">
        <strong className="text-muted d-block mb-3 text-uppercase" style={{ fontSize: '12px' }}>🏍️ Tài xế tiếp nhận chuyến xe</strong>
        {orderDetails.driver ? (
          <div className="d-flex align-items-center p-3 rounded border" style={{ backgroundColor: 'var(--bg-main)', borderColor: 'var(--border-color) !important' }}>
            {orderDetails.driver.avatar_url ? (
                <img src={orderDetails.driver.avatar_url} width="60" height="60" className="rounded-circle me-3 border" style={{objectFit: 'cover', borderColor: 'var(--border-color)'}} alt="avt"/>
            ) : (
                <div className="fs-2 me-3 p-2 rounded-circle border d-flex align-items-center justify-content-center" style={{ width: '60px', height: '60px', backgroundColor: 'var(--bg-input)', borderColor: 'var(--border-color)' }}>🛵</div>
            )}
            <div className="w-100">
              <div className="fw-bold fs-5 text-white">{orderDetails.driver.name}</div>
              <div className={shouldHideInfo ? "text-muted fst-italic mt-1" : "text-white fw-bold fs-6 mt-1"}>
                  {shouldHideInfo ? '🔒 Đã ẩn bảo mật' : (orderDetails.driver.phone || 'Chưa có SĐT')}
              </div>
              {!shouldHideInfo && orderDetails.driver.phone && (
                  <Button className="btn-orange btn-sm fw-bold w-100 mt-3 py-2" onClick={() => window.open(`tel:${orderDetails.driver.phone}`)}>
                      📞 GỌI TÀI XẾ
                  </Button>
              )}
            </div>
          </div>
        ) : (
            <div className="p-4 rounded border text-center text-muted fw-bold" style={{ backgroundColor: 'var(--bg-main)', borderColor: 'var(--border-color) !important', borderStyle: 'dashed !important' }}>
                <span className="fs-3 d-block mb-2">⏳</span> Đơn hàng đang chờ tài xế nhận...
            </div>
        )}
      </div>
    </div>
  );
}