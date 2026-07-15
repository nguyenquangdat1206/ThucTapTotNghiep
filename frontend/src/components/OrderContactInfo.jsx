import React from 'react';
import { Card, Badge } from 'react-bootstrap';

export default function OrderContactInfo({ renderOrders, orderDetails, shouldHideInfo, batchOrders }) {
  return (
    <Card className="shadow-sm border-0">
      <Card.Header className="bg-white border-bottom border-info border-3"><h5 className="mb-0 text-info">👥 Thông liên lạc</h5></Card.Header>
      <Card.Body>
        <div className="mb-4">
          <strong className="text-secondary d-block mb-2">Người gửi (Khách hàng):</strong>
          {renderOrders.map((o) => (
              <div key={`contact-cust-${o.id}`} className="d-flex align-items-center p-3 mb-2 bg-light rounded border">
                <div className="fs-1 me-3">👤</div>
                <div>
                  <div className="fw-bold fs-5">{o.customer_name || (o.id === orderDetails.order.id ? orderDetails.customer.name : `Khách hàng #${o.customer_id}`)}</div>
                  <div className={shouldHideInfo ? "text-muted fst-italic" : "text-primary fw-bold"}>
                    📞 {shouldHideInfo ? '🔒 Đã ẩn bảo mật' : (o.customer_phone || (o.id === orderDetails.order.id ? orderDetails.customer.phone : 'Chưa có SĐT'))}
                  </div>
                  {batchOrders.length > 0 && <Badge bg="secondary" className="mt-1">Khách đơn #{o.id}</Badge>}
                </div>
              </div>
          ))}
        </div>
        
        <div>
          <strong className="text-secondary d-block mb-2">Tài xế tiếp nhận:</strong>
          {orderDetails.driver ? (
            <div className="d-flex align-items-center p-3 bg-light rounded border">
              {orderDetails.driver.avatar_url ? <img src={orderDetails.driver.avatar_url} width="50" height="50" className="rounded-circle me-3" style={{objectFit: 'cover'}} alt="avt"/> : <div className="fs-1 me-3">🛵</div>}
              <div>
                <div className="fw-bold fs-5">{orderDetails.driver.name}</div>
                <div className={shouldHideInfo ? "text-muted fst-italic" : "text-primary fw-bold"}>📞 {shouldHideInfo ? '🔒 Đã ẩn bảo mật' : (orderDetails.driver.phone || 'Chưa có SĐT')}</div>
              </div>
            </div>
          ) : <div className="p-3 bg-light rounded border text-center text-muted"><i>Đơn hàng đang chờ tài xế nhận...</i></div>}
        </div>
      </Card.Body>
    </Card>
  );
}