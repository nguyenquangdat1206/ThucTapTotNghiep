import React, { useState, useEffect } from 'react';
import { Container, Card, Row, Col, Badge, Button, Form, Modal, Placeholder, Alert } from 'react-bootstrap';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';

// =========================================================
// [MỚI] IMPORT CÁC COMPONENT ĐÃ ĐƯỢC CHIA NHỎ
// =========================================================
import SwipeButton from '../components/SwipeButton';
import OrderChatBox from '../components/OrderChatBox';
import OrderContactInfo from '../components/OrderContactInfo';

// Hàm tính khoảng cách đường chim bay ra số Km
const calculateStraightDistance = (lat1, lon1, lat2, lon2) => {
  if (!lat1 || !lon1 || !lat2 || !lon2) return null;
  const R = 6371; 
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return (R * c).toFixed(2); 
};

// Hàm bắt GPS dạng Promise để đợi lấy tọa độ
const getCurrentLocation = () => {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true });
  });
};

export default function OrderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const userInfoString = localStorage.getItem('userInfo');
  const userInfo = userInfoString ? JSON.parse(userInfoString) : null;

  const [orderDetails, setOrderDetails] = useState(null);
  const [batchOrders, setBatchOrders] = useState([]); 
  const [loading, setLoading] = useState(true);
  const [updatingOrderId, setUpdatingOrderId] = useState(null);

  const [messages, setMessages] = useState([]);

  const [rating, setRating] = useState(5);
  const [feedback, setFeedback] = useState('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);

  const [showPodModal, setShowPodModal] = useState(false);
  const [podTargetId, setPodTargetId] = useState(null); 
  const [podActionType, setPodActionType] = useState('pickup'); 
  const [podFile, setPodFile] = useState(null);
  const [isUploadingPod, setIsUploadingPod] = useState(false);

  useEffect(() => {
    if (!userInfo) { navigate('/'); return; }
    const initData = async () => {
      setLoading(true);
      await fetchOrderDetails();
      await fetchMessages();
      setTimeout(() => setLoading(false), 600);
    };
    initData();

    const ws = new WebSocket(`wss://datquang-backend.onrender.com/ws/${userInfo.user_id}/${userInfo.role}`);
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.event === 'new_chat_message' && data.order_id === parseInt(id)) fetchMessages();
      if (data.event === 'status_changed') fetchOrderDetails();
    };
    return () => ws.close();
  }, [id]);

  useEffect(() => {
    if (userInfo?.role === 'customer' && orderDetails?.order?.status === 'completed' && !orderDetails?.order?.rating) {
      setShowReviewModal(true);
    }
  }, [orderDetails?.order?.status, orderDetails?.order?.rating]);

  const fetchOrderDetails = async () => {
    try {
      const response = await axios.get(`https://datquang-backend.onrender.com/orders/${id}/details`);
      setOrderDetails(response.data);
      if (response.data.order.batch_id) {
         const batchRes = await axios.get(`https://datquang-backend.onrender.com/orders/batch/${response.data.order.batch_id}/details`);
         setBatchOrders(batchRes.data);
      } else { setBatchOrders([]); }
    } catch (error) { console.error(error); }
  };

  const fetchMessages = async () => {
    try {
      const response = await axios.get(`https://datquang-backend.onrender.com/orders/${id}/messages`);
      setMessages(response.data);
    } catch (error) { console.error("Lỗi tải tin nhắn:", error); }
  };

  const handleUpdateStatus = async (orderIdToUpdate, newStatus) => {
    setUpdatingOrderId(orderIdToUpdate);
    try {
      await axios.put(`https://datquang-backend.onrender.com/orders/${orderIdToUpdate}/status?status=${newStatus}`);
      await new Promise(resolve => setTimeout(resolve, 800));
      await fetchOrderDetails();
    } catch (error) { console.error("Lỗi cập nhật trạng thái", error); } 
    finally { setUpdatingOrderId(null); }
  };

  const handleSwipeWithLocationCheck = async (orderId, targetLat, targetLng, actionType) => {
    setUpdatingOrderId(orderId);
    try {
        await new Promise(resolve => setTimeout(resolve, 800));
        let currentLat = null, currentLng = null;
        try {
            const pos = await getCurrentLocation();
            currentLat = pos.coords.latitude; currentLng = pos.coords.longitude;
        } catch(e) { console.warn("Không lấy được GPS", e); }

        if (currentLat && currentLng && targetLat && targetLng) {
            const distKm = calculateStraightDistance(currentLat, currentLng, targetLat, targetLng);
            if (parseFloat(distKm) > 0.5) {
                alert(`⚠️ CẢNH BÁO BẢO MẬT:\nBạn đang cách địa điểm yêu cầu ${distKm}km (xa hơn mức cho phép 500m).\nHệ thống yêu cầu bạn phải chụp ảnh rõ ràng hàng hóa và biển số nhà để lưu làm bằng chứng xác minh!`);
            }
        } else {
            alert(`⚠️ CHÚ Ý: Không thể xác định vị trí GPS của bạn lúc này.\nHệ thống yêu cầu chụp ảnh rõ ràng để xác minh!`);
        }
        setUpdatingOrderId(null);
        setPodTargetId(orderId);
        setPodActionType(actionType);
        setShowPodModal(true);
    } catch (err) { setUpdatingOrderId(null); }
  };

  const handleSubmitReview = async (e) => {
    e.preventDefault();
    setIsSubmittingReview(true);
    try {
      await axios.post(`https://datquang-backend.onrender.com/orders/${id}/review`, { rating, feedback });
      setShowReviewModal(false);
      fetchOrderDetails();
    } catch (error) { alert("❌ Có lỗi xảy ra khi gửi đánh giá."); } 
    finally { setIsSubmittingReview(false); }
  };

  const handleCompleteWithPod = async (e) => {
    e.preventDefault();
    if (!podFile) return alert("Vui lòng chụp ảnh xác nhận!");
    setIsUploadingPod(true);
    const formData = new FormData();
    formData.append("file", podFile);

    try {
      if (podActionType === 'pickup') {
          await axios.post(`https://datquang-backend.onrender.com/orders/${podTargetId}/pickup_with_pod`, formData, { headers: { 'Content-Type': 'multipart/form-data' }});
      } else {
          await axios.post(`https://datquang-backend.onrender.com/orders/${podTargetId}/complete_with_pod`, formData, { headers: { 'Content-Type': 'multipart/form-data' }});
      }
      setShowPodModal(false); setPodFile(null); fetchOrderDetails();
    } catch (error) { alert("❌ Lỗi khi tải ảnh lên!"); } 
    finally { setIsUploadingPod(false); }
  };

  const handleCustomerCancel = async () => {
    if(!window.confirm("⚠️ Bạn có muốn gửi yêu cầu Hủy đơn hàng này cho Trung tâm điều hành không?")) return;
    try { 
      await axios.put(`https://datquang-backend.onrender.com/orders/${id}/status?status=cancel_requested`); 
      fetchOrderDetails();
      alert("Đã gửi yêu cầu hủy đơn lên Admin. Vui lòng chờ xét duyệt!");
    } catch (error) { alert("❌ Không thể gửi yêu cầu lúc này, vui lòng thử lại!"); }
  };

  const handleDriverCancelBatch = async () => {
    if(!window.confirm("⚠️ BẠN CÓ CHẮC CHẮN MUỐN NHẢ TOÀN BỘ CHUYẾN NÀY KHÔNG?")) return;
    try { 
      const renderOrders = batchOrders.length > 0 ? batchOrders : [orderDetails.order];
      for (const o of renderOrders) {
          if (['accepted', 'arrived_pickup'].includes(o.status)) {
              await axios.put(`https://datquang-backend.onrender.com/orders/${o.id}/driver_cancel`);
          }
      }
      navigate('/dashboard'); 
    } catch (error) { console.error("Lỗi nhả cuốc", error); }
  };

  // =========================================================
  // [ĐÃ SỬA] Ép Google Maps dẫn đường theo tọa độ GPS chính xác
  // =========================================================
  const openGoogleMapsTo = (lat, lng, fallbackAddress) => {
    if (lat && lng && lat !== 0 && lng !== 0) {
      // Dẫn đường thẳng đến tọa độ GPS
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`, '_blank');
    } else {
      // Dùng chữ nếu đơn hàng cũ không có lưu tọa độ
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(fallbackAddress)}&travelmode=driving`, '_blank');
    }
  };

  const getStatusBadge = (status) => {
    switch(status) {
      case 'pending': return <Badge bg="secondary">Đang tìm tài xế</Badge>;
      case 'accepted': return <Badge bg="info">Tài xế đang đến</Badge>;
      case 'arrived_pickup': return <Badge bg="primary">Đã tới điểm lấy</Badge>;
      case 'picking_up': return <Badge bg="warning" text="dark">Đã lấy hàng</Badge>;
      case 'delivering': return <Badge bg="danger">Đã tới điểm giao</Badge>;
      case 'completed': return <Badge bg="success">Đã hoàn thành</Badge>;
      case 'cancel_requested': return <Badge bg="danger">Yêu cầu hủy</Badge>;
      case 'cancelled': return <Badge bg="dark">Đã hủy</Badge>;
      default: return <Badge bg="light" text="dark">{status}</Badge>;
    }
  };

  if (loading) return (
    <Container className="mt-4 mb-5">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <Placeholder as="h2" animation="glow" className="w-50"><Placeholder xs={6} /></Placeholder>
        <Placeholder.Button variant="secondary" xs={2} />
      </div>
      <Row>
        <Col lg={7} className="mb-4">
          <Card className="shadow-sm border-0 mb-4">
            <Card.Header className="bg-light border-bottom border-3 py-3"><Placeholder as="h5" animation="glow"><Placeholder xs={4} /></Placeholder></Card.Header>
            <Card.Body>
              <Placeholder as="p" animation="glow"><Placeholder xs={7} /> <Placeholder xs={4} /></Placeholder>
              <Placeholder as="p" animation="glow" className="mt-3"><Placeholder xs={12} bg="secondary" /><Placeholder xs={8} bg="secondary" /></Placeholder>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );

  if (!orderDetails) return <Container className="mt-5 text-center"><h4 className="text-danger">Không tìm thấy đơn hàng!</h4><Button onClick={() => navigate('/dashboard')}>Quay về</Button></Container>;

  const isDriverOwner = userInfo.role.startsWith('driver') && orderDetails.order.driver_id === userInfo.user_id;
  const renderOrders = batchOrders.length > 0 ? batchOrders : [orderDetails.order];
  const isBatchClosed = renderOrders.every(o => ['completed', 'cancelled', 'cancelled_timeout'].includes(o.status));
  const isCustomerWaiting = !orderDetails.driver && userInfo.role === 'customer';
  const isChatDisabled = isBatchClosed || isCustomerWaiting;
  const shouldHideInfo = isBatchClosed && userInfo.role !== 'admin';
  const canCancelBatch = renderOrders.every(o => ['pending', 'accepted', 'arrived_pickup'].includes(o.status));

  let totalCashToCollect = 0;
  renderOrders.forEach(o => {
      if (o.payment_method === 'cash') totalCashToCollect += o.price;
      if (o.cod_amount) totalCashToCollect += o.cod_amount;
  });

  return (
    <Container className="mt-4 mb-5">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2 className="text-primary mb-0">🏷️ {batchOrders.length > 0 ? "Lộ Trình Vận Hành (Đơn Ghép)" : `Chi tiết đơn hàng #${orderDetails.order.id}`}</h2>
        <Button variant="outline-secondary" onClick={() => navigate('/dashboard')}>⬅ Quay lại Radar</Button>
      </div>

      {isDriverOwner && orderDetails.order.batch_id && !isBatchClosed && (
        <Alert variant="warning" className="fw-bold shadow-sm border-warning border-2">
          🔥 CHÚ Ý: Đây là chuyến xe được hệ thống ghép thông minh. Vui lòng thực hiện tuần tự việc Lấy và Giao hàng theo lộ trình bên dưới!
        </Alert>
      )}

      <Row>
        <Col lg={7} className="mb-4">
          <Card className="shadow-sm border-0 mb-4">
            <Card.Header className={`text-white border-bottom border-3 py-3 ${batchOrders.length > 0 ? 'bg-danger' : 'bg-primary'}`}>
              <h5 className="mb-0 fw-bold">📦 Lộ Trình Công Việc</h5>
            </Card.Header>
            <Card.Body className="bg-light">
              
              <h6 className="fw-bold text-secondary mb-3">📍 NHIỆM VỤ LẤY HÀNG</h6>
              {renderOrders.map((o, index) => (
                <div key={`pickup-${o.id}`} className="p-3 mb-3 bg-white rounded border shadow-sm border-start border-primary border-4">
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <strong className="text-primary fs-5">Lấy đơn của Khách {index + 1} (Mã #{o.id})</strong>
                    {getStatusBadge(o.status)}
                  </div>
                  <div className="mb-3 text-muted"><strong>Địa chỉ:</strong> {o.pickup || o.pickup_location}</div>
                  
                  {o.pickup_image_url && (
                    <div className="mt-2 mb-3 bg-light p-2 rounded border border-primary d-inline-block">
                        <strong className="d-block text-primary mb-1" style={{fontSize: '12px'}}>📸 Ảnh xác nhận lấy hàng:</strong>
                        <img src={o.pickup_image_url} alt="POD Lấy" className="img-thumbnail" style={{height: '100px', objectFit: 'cover'}} />
                    </div>
                  )}

                  {isDriverOwner && !['completed', 'cancelled'].includes(o.status) && (
                    <div className="mt-2">
                      {/* [ĐÃ SỬA] TRUYỀN TỌA ĐỘ VÀO NÚT MAP */}
                      <Button size="sm" variant="outline-primary" onClick={() => openGoogleMapsTo(o.pickup_lat, o.pickup_lng, o.pickup || o.pickup_location)}>
                        🗺️ Dẫn đường Map (GPS)
                      </Button>
                      
                      {o.status === 'accepted' && (
                         <SwipeButton text="Quẹt xác nhận: Đã tới điểm đến" colorClass="primary" onComplete={() => handleUpdateStatus(o.id, 'arrived_pickup')} isLoading={updatingOrderId === o.id} />
                      )}

                      {o.status === 'arrived_pickup' && (
                         <SwipeButton text="Quẹt xác nhận: Đã lấy hàng" colorClass="primary" onComplete={() => handleSwipeWithLocationCheck(o.id, o.pickup_lat, o.pickup_lng, 'pickup')} isLoading={updatingOrderId === o.id} />
                      )}
                    </div>
                  )}
                </div>
              ))}

              <hr className="my-4" />

              <h6 className="fw-bold text-secondary mb-3">🚩 NHIỆM VỤ GIAO HÀNG</h6>
              {renderOrders.map((o, index) => (
                <div key={`dropoff-${o.id}`} className="p-3 mb-3 bg-white rounded border shadow-sm border-start border-danger border-4">
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <strong className="text-danger fs-5">Giao đơn Khách {index + 1} (Mã #{o.id})</strong>
                    {['completed', 'cancelled'].includes(o.status) ? getStatusBadge(o.status) : <Badge bg="warning" text="dark">Chưa giao</Badge>}
                  </div>
                  <div className="mb-2 text-muted"><strong>Địa chỉ:</strong> {o.dropoff || o.dropoff_location}</div>
                  <div className="mb-3 text-muted"><strong>Ghi chú:</strong> {o.package_details}</div>
                  
                  {o.proof_image_url && (
                    <div className="mt-2 mb-3 bg-light p-2 rounded border border-success d-inline-block">
                        <strong className="d-block text-success mb-1" style={{fontSize: '12px'}}>📸 Ảnh bằng chứng giao hàng (PoD):</strong>
                        <img src={o.proof_image_url} alt="POD Giao" className="img-thumbnail" style={{height: '100px', objectFit: 'cover'}} />
                    </div>
                  )}

                  {isDriverOwner && ['picking_up', 'delivering'].includes(o.status) && (
                    <div className="mt-2">
                      {/* [ĐÃ SỬA] TRUYỀN TỌA ĐỘ VÀO NÚT MAP */}
                      <Button size="sm" variant="outline-danger" onClick={() => openGoogleMapsTo(o.dropoff_lat, o.dropoff_lng, o.dropoff || o.dropoff_location)}>
                        🗺️ Dẫn đường Map (GPS)
                      </Button>
                      
                      {o.status === 'picking_up' && (
                         <SwipeButton text="Quẹt xác nhận: Đã tới điểm giao" colorClass="danger" onComplete={() => handleUpdateStatus(o.id, 'delivering')} isLoading={updatingOrderId === o.id} />
                      )}
                      
                      {o.status === 'delivering' && (
                         <SwipeButton text="Quẹt xác nhận: Hoàn thành đơn" colorClass="danger" onComplete={() => handleSwipeWithLocationCheck(o.id, o.dropoff_lat, o.dropoff_lng, 'dropoff')} isLoading={updatingOrderId === o.id} />
                      )}
                    </div>
                  )}
                </div>
              ))}

              <div className={`mt-4 p-4 border border-2 rounded text-center shadow-sm ${totalCashToCollect > 0 ? 'bg-white border-danger' : 'bg-success bg-opacity-10 border-success'}`}>
                 <h5 className={`fw-bold mb-2 ${totalCashToCollect > 0 ? 'text-danger' : 'text-success'}`}>
                   {totalCashToCollect > 0 ? '💰 TỔNG TIỀN MẶT PHẢI THU' : '💰 KHÔNG CẦN THU TIỀN MẶT'}
                 </h5>
                 {totalCashToCollect > 0 && <h1 className="text-danger fw-bold mb-0">{totalCashToCollect.toLocaleString()} đ</h1>}
              </div>

              {userInfo.role === 'customer' && !isBatchClosed && ['pending', 'accepted'].includes(orderDetails.order.status) && (
                 <div className="mt-4 d-flex justify-content-end border-top pt-3">
                   <Button variant="danger" className="fw-bold px-4" onClick={handleCustomerCancel}>🖐️ Yêu cầu Hủy đơn</Button>
                 </div>
              )}

              {isDriverOwner && !isBatchClosed && canCancelBatch && (
                <div className="mt-4 d-flex justify-content-end border-top pt-3">
                    <Button variant="outline-danger" onClick={handleDriverCancelBatch}>Hủy / Nhả toàn bộ chuyến xe</Button>
                </div>
              )}

            </Card.Body>
          </Card>

          {/* GỌI COMPONENT THÔNG TIN LIÊN LẠC VÀO ĐÂY */}
          <OrderContactInfo 
            renderOrders={renderOrders} 
            orderDetails={orderDetails} 
            shouldHideInfo={shouldHideInfo} 
            batchOrders={batchOrders} 
          />

          {orderDetails.order.rating && (
            <Card className="shadow-sm border-0 mt-4 mb-4 border-warning border-start border-4">
              <Card.Body className="bg-light">
                <h5 className="text-warning mb-2">⭐ Đánh giá từ khách hàng:</h5>
                <div className="fs-3 mb-2">
                  {[...Array(5)].map((_, index) => <span key={index} style={{ color: index < orderDetails.order.rating ? '#ffc107' : '#e4e5e9' }}>★</span>)}
                </div>
                {orderDetails.order.feedback && <p className="mb-0 text-muted fst-italic">"{orderDetails.order.feedback}"</p>}
              </Card.Body>
            </Card>
          )}

          {userInfo.role === 'customer' && orderDetails.order.status === 'completed' && !orderDetails.order.rating && (
            <Card className="shadow-sm border-0 mt-4 mb-4 border-success border-start border-4">
              <Card.Body className="d-flex justify-content-between align-items-center">
                <div>
                  <h5 className="text-success mb-1">📝 Chuyến đi đã hoàn thành!</h5>
                  <p className="mb-0 text-muted">Bạn chưa đánh giá chất lượng phục vụ của tài xế.</p>
                </div>
                <Button variant="success" className="fw-bold px-4 shadow-sm" onClick={() => setShowReviewModal(true)}>Đánh giá ngay ⭐</Button>
              </Card.Body>
            </Card>
          )}

        </Col>

        <Col lg={5}>
          {/* GỌI COMPONENT KHUNG CHAT VÀO ĐÂY */}
          <OrderChatBox 
            orderId={id} 
            userInfo={userInfo} 
            isChatDisabled={isChatDisabled} 
            isBatchClosed={isBatchClosed} 
            messages={messages} 
            fetchMessages={fetchMessages} 
          />
        </Col>
      </Row>

      <Modal show={showReviewModal} onHide={() => setShowReviewModal(false)} centered>
        <Modal.Header closeButton className="bg-success text-white border-0"><Modal.Title>🎉 Chuyến đi hoàn tất!</Modal.Title></Modal.Header>
        <Form onSubmit={handleSubmitReview}>
          <Modal.Body className="text-center p-4">
            <h5 className="mb-4 text-dark">Tài xế <strong className="text-primary">{orderDetails?.driver?.name}</strong> phục vụ bạn thế nào?</h5>
            <div className="mb-4 fs-1" style={{ cursor: 'pointer' }}>
              {[1, 2, 3, 4, 5].map((star) => <span key={star} onClick={() => setRating(star)} style={{ color: star <= rating ? '#ffc107' : '#e4e5e9', transition: 'color 0.2s', margin: '0 5px' }}>★</span>)}
            </div>
            <Form.Group className="mb-2 text-start">
              <Form.Label className="fw-bold text-muted">Nhận xét thêm (Không bắt buộc)</Form.Label>
              <Form.Control as="textarea" rows={3} className="bg-light" placeholder="Ví dụ: Tài xế thân thiện, đi đúng giờ..." value={feedback} onChange={(e) => setFeedback(e.target.value)} />
            </Form.Group>
          </Modal.Body>
          <Modal.Footer className="justify-content-center border-0 pb-4">
            <Button variant="success" type="submit" disabled={isSubmittingReview} className="w-75 fw-bold fs-5 rounded-pill shadow-sm">{isSubmittingReview ? "Đang gửi..." : "Gửi Đánh Giá Ngay"}</Button>
          </Modal.Footer>
        </Form>
      </Modal>

      <Modal show={showPodModal} onHide={() => setShowPodModal(false)} centered backdrop="static">
        <Modal.Header closeButton className="bg-success text-white">
          <Modal.Title>
            📸 {podActionType === 'pickup' ? 'CHỤP ẢNH LẤY HÀNG' : 'CHỤP ẢNH GIAO HÀNG'} KHÁCH #{podTargetId}
          </Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleCompleteWithPod}>
          <Modal.Body className="text-center p-4">
            <Alert variant="warning" className="fw-bold mb-4">
              Vui lòng chụp rõ mã vận đơn và tình trạng hàng hóa để đối chiếu!
            </Alert>
            <Form.Control type="file" accept="image/*" capture="environment" onChange={(e) => setPodFile(e.target.files[0])} required />
          </Modal.Body>
          <Modal.Footer className="justify-content-center">
            <Button variant="success" type="submit" disabled={isUploadingPod} className="fw-bold px-5">
              {isUploadingPod ? "Đang tải ảnh lên..." : "📤 HOÀN THÀNH"}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

    </Container>
  );
} 