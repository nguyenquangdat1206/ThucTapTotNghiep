import React, { useState, useEffect } from 'react';
import { Container, Card, Row, Col, Badge, Button, Form, Modal, Placeholder, Alert } from 'react-bootstrap';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';

// Component con
import SwipeButton from '../components/SwipeButton';
import OrderChatBox from '../components/OrderChatBox';
import OrderContactInfo from '../components/OrderContactInfo';

const calculateStraightDistance = (lat1, lon1, lat2, lon2) => {
  if (!lat1 || !lon1 || !lat2 || !lon2) return null;
  const R = 6371; 
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return (R * c).toFixed(2); 
};

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

    let ws;
    let pingInterval;
    let reconnectTimeout;

    const connectWebSocket = () => {
      ws = new WebSocket(`wss://datquang-backend.onrender.com/ws/${userInfo.user_id}/${userInfo.role}`);
      ws.onopen = () => {
        pingInterval = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "ping_keep_alive" }));
        }, 30000);
      };
      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.event === 'new_chat_message' && data.order_id === parseInt(id)) fetchMessages();
        if (data.event === 'status_changed') fetchOrderDetails();
      };
      ws.onclose = () => {
        clearInterval(pingInterval);
        reconnectTimeout = setTimeout(connectWebSocket, 3000);
      };
    };

    connectWebSocket();

    return () => {
      clearInterval(pingInterval);
      clearTimeout(reconnectTimeout);
      if (ws) { ws.onclose = null; ws.close(); }
    };
  }, [id, userInfo?.user_id, userInfo?.role]);

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
    } catch (error) { console.error("Lỗi cập nhật", error); } 
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
        } catch(e) {}

        if (currentLat && currentLng && targetLat && targetLng) {
            const distKm = calculateStraightDistance(currentLat, currentLng, targetLat, targetLng);
            if (parseFloat(distKm) > 0.5) {
                alert(`⚠️ CẢNH BÁO: Bạn đang cách địa điểm yêu cầu ${distKm}km.\nHệ thống yêu cầu chụp ảnh rõ ràng hàng hóa làm bằng chứng!`);
            }
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
      setShowReviewModal(false); fetchOrderDetails();
    } catch (error) { alert("❌ Lỗi khi gửi đánh giá."); } 
    finally { setIsSubmittingReview(false); }
  };

  const handleCompleteWithPod = async (e) => {
    e.preventDefault();
    if (!podFile) return alert("Vui lòng chụp ảnh xác nhận!");
    setIsUploadingPod(true);
    const formData = new FormData(); formData.append("file", podFile);
    try {
      if (podActionType === 'pickup') {
          await axios.post(`https://datquang-backend.onrender.com/orders/${podTargetId}/pickup_with_pod`, formData, { headers: { 'Content-Type': 'multipart/form-data' }});
      } else {
          await axios.post(`https://datquang-backend.onrender.com/orders/${podTargetId}/complete_with_pod`, formData, { headers: { 'Content-Type': 'multipart/form-data' }});
      }
      setShowPodModal(false); setPodFile(null); fetchOrderDetails();
    } catch (error) { alert("❌ Lỗi tải ảnh!"); } 
    finally { setIsUploadingPod(false); }
  };

  const handleCustomerCancel = async () => {
    if(!window.confirm("⚠️ Bạn có muốn yêu cầu Hủy đơn hàng này?")) return;
    try { 
      await axios.put(`https://datquang-backend.onrender.com/orders/${id}/status?status=cancel_requested`); 
      fetchOrderDetails(); alert("Đã gửi yêu cầu hủy!");
    } catch (error) { alert("❌ Lỗi gửi yêu cầu!"); }
  };

  const handleDriverCancelBatch = async () => {
    if(!window.confirm("⚠️ BẠN CÓ CHẮC MUỐN NHẢ TOÀN BỘ CHUYẾN NÀY?")) return;
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

  const openGoogleMapsTo = (lat, lng, fallbackAddress) => {
    if (lat && lng && lat !== 0 && lng !== 0) window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`, '_blank');
    else window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(fallbackAddress)}&travelmode=driving`, '_blank');
  };

  const getStatusBadge = (status) => {
    switch(status) {
      case 'pending': return <Badge bg="secondary">Đang tìm tài xế</Badge>;
      case 'accepted': return <Badge bg="info">Tài xế đang đến</Badge>;
      case 'arrived_pickup': return <Badge bg="primary">Đã tới điểm lấy</Badge>;
      case 'picking_up': return <Badge bg="warning" text="dark">Đã lấy hàng</Badge>;
      case 'delivering': return <Badge bg="danger">Đang giao</Badge>;
      case 'completed': return <Badge bg="success">Hoàn thành</Badge>;
      case 'cancel_requested': return <Badge bg="danger">Yêu cầu hủy</Badge>;
      case 'cancelled': return <Badge bg="dark">Đã hủy</Badge>;
      default: return <Badge bg="light" text="dark">{status}</Badge>;
    }
  };

  if (loading) return (
    <Container className="mt-4 mb-5">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <Placeholder as="h2" animation="glow" className="w-50"><Placeholder xs={6} /></Placeholder>
      </div>
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
    <Container className="mt-4 mb-5" style={{ position: 'relative', zIndex: 1 }}>
      {/* HEADER */}
      <div className="glass-card p-3 mb-4 d-flex justify-content-between align-items-center border-top border-primary border-4 shadow-sm">
        <h3 className="text-primary fw-bold mb-0">🏷️ {batchOrders.length > 0 ? "Lộ Trình Vận Hành (Đơn Ghép)" : `Chi tiết đơn hàng #${orderDetails.order.id}`}</h3>
        <Button variant="link" className="glass-btn text-dark fw-bold text-decoration-none px-4" onClick={() => navigate('/dashboard')}>⬅ Quay lại Radar</Button>
      </div>

      {isDriverOwner && orderDetails.order.batch_id && !isBatchClosed && (
        <Alert variant="warning" className="glass-card fw-bold shadow-sm border-warning border-start border-4">
          🔥 CHÚ Ý: Đây là chuyến xe được hệ thống ghép thông minh. Vui lòng thực hiện tuần tự việc Lấy và Giao hàng theo lộ trình bên dưới!
        </Alert>
      )}

      {/* THANH TIẾN TRÌNH GIAO HÀNG (PROGRESS BAR) */}
      <div className="glass-card p-4 mb-4 shadow-sm text-center">
        <h5 className="fw-bold text-secondary mb-3">Tiến trình vận đơn</h5>
        <div className="d-flex justify-content-between align-items-center position-relative mx-auto" style={{ maxWidth: '800px' }}>
            <div style={{ position: 'absolute', top: '50%', left: '10%', right: '10%', height: '4px', background: 'rgba(0,0,0,0.1)', zIndex: 0 }}></div>
            
            <Badge bg={orderDetails.order.status !== 'pending' ? "success" : "warning"} className="p-3 rounded-circle shadow position-relative z-index-1" style={{ width: '50px', height: '50px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>1</Badge>
            <Badge bg={['arrived_pickup', 'picking_up', 'delivering', 'completed'].includes(orderDetails.order.status) ? "success" : "light"} text={['arrived_pickup', 'picking_up', 'delivering', 'completed'].includes(orderDetails.order.status) ? "white" : "dark"} className="p-3 rounded-circle shadow position-relative z-index-1" style={{ width: '50px', height: '50px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>2</Badge>
            <Badge bg={['delivering', 'completed'].includes(orderDetails.order.status) ? "primary" : "light"} text={['delivering', 'completed'].includes(orderDetails.order.status) ? "white" : "dark"} className="p-3 rounded-circle shadow position-relative z-index-1" style={{ width: '50px', height: '50px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>3</Badge>
            <Badge bg={orderDetails.order.status === 'completed' ? "success" : "light"} text={orderDetails.order.status === 'completed' ? "white" : "dark"} className="p-3 rounded-circle shadow position-relative z-index-1" style={{ width: '50px', height: '50px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>4</Badge>
        </div>
        <div className="d-flex justify-content-between mx-auto mt-2 text-dark fw-bold" style={{ maxWidth: '840px', fontSize: '12px' }}>
            <span style={{ width: '80px' }}>Đang xử lý</span>
            <span style={{ width: '80px' }}>Đã lấy hàng</span>
            <span style={{ width: '80px' }}>Đang giao</span>
            <span style={{ width: '80px' }}>Hoàn thành</span>
        </div>
      </div>

      <Row>
        {/* ======================================= */}
        {/* CỘT TRÁI: THÔNG TIN VẬN ĐƠN */}
        {/* ======================================= */}
        <Col lg={7} className="mb-4">
          <div className="glass-card p-4 h-100 shadow-sm">
            <h5 className="fw-bold text-dark border-bottom border-secondary pb-2 mb-4">📦 Lộ Trình Công Việc</h5>
            
            <h6 className="fw-bold text-primary mb-3">📍 NHIỆM VỤ LẤY HÀNG</h6>
            {renderOrders.map((o, index) => (
              <div key={`pickup-${o.id}`} className="p-3 mb-3 bg-white bg-opacity-50 rounded border shadow-sm border-start border-primary border-4">
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <strong className="text-primary fs-5">Khách {index + 1} (Mã #{o.id})</strong>
                  {getStatusBadge(o.status)}
                </div>
                <div className="mb-3 text-dark"><strong>Địa chỉ:</strong> {o.pickup || o.pickup_location}</div>
                
                {o.pickup_image_url && (
                  <div className="mt-2 mb-3 p-2 rounded border border-primary d-inline-block bg-white bg-opacity-75">
                      <strong className="d-block text-primary mb-1" style={{fontSize: '12px'}}>📸 Ảnh xác nhận lấy hàng:</strong>
                      <img src={o.pickup_image_url} alt="POD Lấy" className="img-thumbnail" style={{height: '100px', objectFit: 'cover'}} />
                  </div>
                )}

                {isDriverOwner && !['completed', 'cancelled'].includes(o.status) && (
                  <div className="mt-2">
                    <Button size="sm" variant="outline-primary" className="glass-btn fw-bold mb-2 w-100" onClick={() => openGoogleMapsTo(o.pickup_lat, o.pickup_lng, o.pickup || o.pickup_location)}>
                      🗺️ Dẫn đường Bản đồ (GPS)
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

            <hr className="my-4 text-muted" />

            <h6 className="fw-bold text-danger mb-3">🚩 NHIỆM VỤ GIAO HÀNG</h6>
            {renderOrders.map((o, index) => (
              <div key={`dropoff-${o.id}`} className="p-3 mb-3 bg-white bg-opacity-50 rounded border shadow-sm border-start border-danger border-4">
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <strong className="text-danger fs-5">Khách {index + 1} (Mã #{o.id})</strong>
                  {['completed', 'cancelled'].includes(o.status) ? getStatusBadge(o.status) : <Badge bg="warning" text="dark" className="shadow-sm">Chưa giao</Badge>}
                </div>
                <div className="mb-2 text-dark"><strong>Địa chỉ:</strong> {o.dropoff || o.dropoff_location}</div>
                <div className="mb-3 text-dark"><strong>Ghi chú:</strong> {o.package_details}</div>
                
                {o.proof_image_url && (
                  <div className="mt-2 mb-3 p-2 rounded border border-success d-inline-block bg-white bg-opacity-75">
                      <strong className="d-block text-success mb-1" style={{fontSize: '12px'}}>📸 Ảnh bằng chứng giao hàng (PoD):</strong>
                      <img src={o.proof_image_url} alt="POD Giao" className="img-thumbnail" style={{height: '100px', objectFit: 'cover'}} />
                  </div>
                )}

                {isDriverOwner && ['picking_up', 'delivering'].includes(o.status) && (
                  <div className="mt-2">
                    <Button size="sm" variant="outline-danger" className="glass-btn fw-bold text-danger border-danger mb-2 w-100" onClick={() => openGoogleMapsTo(o.dropoff_lat, o.dropoff_lng, o.dropoff || o.dropoff_location)}>
                      🗺️ Dẫn đường Bản đồ (GPS)
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

            <div className={`mt-4 p-4 border border-2 rounded text-center shadow-sm ${totalCashToCollect > 0 ? 'glass-card border-danger' : 'bg-success bg-opacity-25 border-success'}`}>
               <h5 className={`fw-bold mb-2 ${totalCashToCollect > 0 ? 'text-danger' : 'text-success'}`}>
                 {totalCashToCollect > 0 ? '💰 TỔNG TIỀN MẶT PHẢI THU' : '💰 KHÔNG CẦN THU TIỀN MẶT'}
               </h5>
               {totalCashToCollect > 0 && <h1 className="text-danger fw-bold mb-0">{totalCashToCollect.toLocaleString()} đ</h1>}
            </div>

            {userInfo.role === 'customer' && !isBatchClosed && ['pending', 'accepted'].includes(orderDetails.order.status) && (
               <div className="mt-4 d-flex justify-content-end border-top pt-3 border-secondary">
                 <Button variant="danger" className="glass-btn-primary fw-bold px-4 bg-danger" onClick={handleCustomerCancel}>🖐️ Yêu cầu Hủy đơn</Button>
               </div>
            )}

            {isDriverOwner && !isBatchClosed && canCancelBatch && (
              <div className="mt-4 d-flex justify-content-end border-top pt-3 border-secondary">
                  <Button variant="outline-danger" className="glass-btn text-danger fw-bold border-danger" onClick={handleDriverCancelBatch}>Hủy / Nhả toàn bộ chuyến xe</Button>
              </div>
            )}
          </div>

          <OrderContactInfo renderOrders={renderOrders} orderDetails={orderDetails} shouldHideInfo={shouldHideInfo} batchOrders={batchOrders} />

          {orderDetails.order.rating && (
            <div className="glass-card p-4 shadow-sm mt-4 mb-4 border-warning border-start border-4">
                <h5 className="text-warning fw-bold mb-2">⭐ Đánh giá từ khách hàng:</h5>
                <div className="fs-3 mb-2">
                  {[...Array(5)].map((_, index) => <span key={index} style={{ color: index < orderDetails.order.rating ? '#ffc107' : '#e4e5e9' }}>★</span>)}
                </div>
                {orderDetails.order.feedback && <p className="mb-0 text-dark fw-bold fst-italic">"{orderDetails.order.feedback}"</p>}
            </div>
          )}

          {userInfo.role === 'customer' && orderDetails.order.status === 'completed' && !orderDetails.order.rating && (
            <div className="glass-card p-4 shadow-sm mt-4 mb-4 border-success border-start border-4 d-flex justify-content-between align-items-center flex-wrap">
                <div className="mb-3 mb-md-0">
                  <h5 className="text-success fw-bold mb-1">📝 Chuyến đi đã hoàn thành!</h5>
                  <p className="mb-0 text-dark fw-bold">Bạn chưa đánh giá chất lượng phục vụ của tài xế.</p>
                </div>
                <Button variant="success" className="glass-btn-primary fw-bold px-4" onClick={() => setShowReviewModal(true)}>Đánh giá ngay ⭐</Button>
            </div>
          )}
        </Col>

        {/* ======================================= */}
        {/* CỘT PHẢI: KHUNG CHAT                      */}
        {/* ======================================= */}
        <Col lg={5}>
          <OrderChatBox orderId={id} userInfo={userInfo} isChatDisabled={isChatDisabled} isBatchClosed={isBatchClosed} messages={messages} fetchMessages={fetchMessages} />
        </Col>
      </Row>

      {/* MODAL ĐÁNH GIÁ VÀ HÌNH ẢNH */}
      <Modal show={showReviewModal} onHide={() => setShowReviewModal(false)} centered contentClassName="glass-card border-0">
        <Modal.Header closeButton className="bg-success text-white border-0"><Modal.Title className="fw-bold">🎉 Chuyến đi hoàn tất!</Modal.Title></Modal.Header>
        <Form onSubmit={handleSubmitReview}>
          <Modal.Body className="text-center p-4">
            <h5 className="mb-4 text-dark fw-bold">Tài xế <strong className="text-primary">{orderDetails?.driver?.name}</strong> phục vụ bạn thế nào?</h5>
            <div className="mb-4 fs-1" style={{ cursor: 'pointer' }}>
              {[1, 2, 3, 4, 5].map((star) => <span key={star} onClick={() => setRating(star)} style={{ color: star <= rating ? '#ffc107' : '#e4e5e9', transition: 'color 0.2s', margin: '0 5px', textShadow: '0 2px 4px rgba(0,0,0,0.2)' }}>★</span>)}
            </div>
            <Form.Group className="mb-2 text-start">
              <Form.Label className="fw-bold text-dark">Nhận xét thêm (Không bắt buộc)</Form.Label>
              <Form.Control as="textarea" rows={3} className="glass-input" placeholder="Ví dụ: Tài xế thân thiện, đi đúng giờ..." value={feedback} onChange={(e) => setFeedback(e.target.value)} />
            </Form.Group>
          </Modal.Body>
          <Modal.Footer className="justify-content-center border-0 pb-4">
            <Button variant="success" type="submit" disabled={isSubmittingReview} className="glass-btn-primary w-75 fw-bold fs-5 rounded-pill shadow-sm">{isSubmittingReview ? "Đang gửi..." : "Gửi Đánh Giá Ngay"}</Button>
          </Modal.Footer>
        </Form>
      </Modal>

      <Modal show={showPodModal} onHide={() => setShowPodModal(false)} centered backdrop="static" contentClassName="glass-card border-0">
        <Modal.Header closeButton className="bg-success text-white">
          <Modal.Title className="fw-bold">📸 {podActionType === 'pickup' ? 'CHỤP ẢNH LẤY HÀNG' : 'CHỤP ẢNH GIAO HÀNG'}</Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleCompleteWithPod}>
          <Modal.Body className="text-center p-4">
            <Alert variant="warning" className="fw-bold mb-4 glass-card border-warning border-2">Vui lòng chụp rõ mã vận đơn và tình trạng hàng hóa để đối chiếu!</Alert>
            <Form.Control type="file" className="glass-input py-2" accept="image/*" capture="environment" onChange={(e) => setPodFile(e.target.files[0])} required />
          </Modal.Body>
          <Modal.Footer className="justify-content-center border-light">
            <Button variant="secondary" className="glass-btn" onClick={() => setShowPodModal(false)}>Hủy</Button>
            <Button variant="success" type="submit" disabled={isUploadingPod} className="glass-btn-primary fw-bold px-5">
              {isUploadingPod ? "Đang tải lên..." : "📤 HOÀN THÀNH"}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </Container>
  );
}