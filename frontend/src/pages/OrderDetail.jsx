import React, { useState, useEffect } from 'react';
import { Container, Card, Row, Col, Badge, Button, Form, Modal, Placeholder, Alert } from 'react-bootstrap';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';

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

  const isAdmin = userInfo?.role === 'admin';

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
        } catch(e) {}

        if (currentLat && currentLng && targetLat && targetLng) {
            const distKm = calculateStraightDistance(currentLat, currentLng, targetLat, targetLng);
            if (parseFloat(distKm) > 0.5) {
                alert(`⚠️ CẢNH BÁO BẢO MẬT:\nBạn đang cách địa điểm yêu cầu ${distKm}km.\nHệ thống yêu cầu chụp ảnh rõ ràng để xác minh!`);
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
    } catch (error) { alert("❌ Có lỗi xảy ra khi gửi đánh giá."); } 
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
    } catch (error) { alert("❌ Lỗi khi tải ảnh lên!"); } 
    finally { setIsUploadingPod(false); }
  };

  const handleCustomerCancel = async () => {
    if(!window.confirm("⚠️ Bạn có muốn gửi yêu cầu Hủy đơn hàng này không?")) return;
    try { 
      await axios.put(`https://datquang-backend.onrender.com/orders/${id}/status?status=cancel_requested`); 
      fetchOrderDetails(); alert("Đã gửi yêu cầu hủy đơn!");
    } catch (error) { alert("❌ Không thể gửi yêu cầu lúc này!"); }
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

  const openGoogleMapsTo = (lat, lng, fallbackAddress) => {
    if (lat && lng && lat !== 0 && lng !== 0) {
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`, '_blank');
    } else {
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(fallbackAddress)}&travelmode=driving`, '_blank');
    }
  };

  const getStatusBadge = (status) => {
    switch(status) {
      case 'pending': return <Badge bg="secondary" className="px-2 py-1">Đang tìm tài xế</Badge>;
      case 'accepted': return <Badge bg="info" className="px-2 py-1 text-dark">Tài xế đang đến</Badge>;
      case 'arrived_pickup': return <Badge bg="primary" className="px-2 py-1">Đã tới điểm lấy</Badge>;
      case 'picking_up': return <Badge bg="warning" className="px-2 py-1 text-dark">Đã lấy hàng</Badge>;
      case 'delivering': return <Badge bg="danger" className="px-2 py-1">Đang giao</Badge>;
      case 'completed': return <Badge bg="success" className="px-2 py-1">Đã hoàn thành</Badge>;
      case 'cancel_requested': return <Badge bg="danger" className="px-2 py-1">Yêu cầu hủy</Badge>;
      case 'cancelled': return <Badge bg="dark" className="px-2 py-1 border border-secondary">Đã hủy</Badge>;
      default: return <Badge bg="light" className="px-2 py-1 text-dark">{status}</Badge>;
    }
  };

  if (loading) return (
    <Container fluid className="py-5" style={{ backgroundColor: 'var(--bg-main)', minHeight: '100vh' }}>
      <Container style={{ maxWidth: '1000px' }}>
        <div className="d-flex justify-content-between align-items-center mb-4">
          <Placeholder as="h2" animation="glow" className="w-50"><Placeholder xs={6} style={{backgroundColor: 'var(--border-color)'}} /></Placeholder>
          <Placeholder.Button variant="secondary" xs={2} style={{backgroundColor: 'var(--border-color)', borderColor: 'var(--border-color)'}} />
        </div>
        <Placeholder animation="glow">
            <Placeholder className="w-100 mb-4 rounded" style={{height: '150px', backgroundColor: 'var(--bg-card)'}} />
            <Placeholder className="w-100 mb-4 rounded" style={{height: '300px', backgroundColor: 'var(--bg-card)'}} />
        </Placeholder>
      </Container>
    </Container>
  );

  if (!orderDetails) return <Container fluid className="py-5 text-center text-white" style={{ backgroundColor: 'var(--bg-main)', minHeight: '100vh' }}><h4 className="text-danger">Không tìm thấy đơn hàng!</h4><Button variant="outline-light" onClick={() => navigate('/dashboard')}>Quay về</Button></Container>;

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
    <Container fluid className="py-5" style={{ backgroundColor: 'var(--bg-main)', minHeight: '100vh' }}>
      <Container style={{ maxWidth: '1200px' }}>
        <div className="d-flex justify-content-between align-items-center mb-4">
          <h3 className="mb-0 fw-bold" style={{ color: 'var(--brand-orange)' }}>🏷️ {batchOrders.length > 0 ? "Lộ Trình Vận Hành (Đơn Ghép)" : `Chi tiết đơn hàng #${orderDetails.order.id}`}</h3>
          <Button variant="outline-light" style={{ borderColor: 'var(--border-color)' }} onClick={() => navigate(isAdmin ? '/admin' : '/dashboard')}>⬅ Quay lại</Button>
        </div>

        {isDriverOwner && orderDetails.order.batch_id && !isBatchClosed && (
          <Alert variant="warning" className="fw-bold shadow-sm border-2 logistics-card text-warning" style={{ borderColor: '#FFC107 !important' }}>
            🔥 CHÚ Ý: Đây là chuyến xe được hệ thống ghép thông minh. Vui lòng thực hiện tuần tự việc Lấy và Giao hàng theo lộ trình bên dưới!
          </Alert>
        )}

        {/* THANH TIẾN TRÌNH */}
        <div className="logistics-card mb-4 p-4 text-center">
          <h6 className="fw-bold text-muted mb-4 text-uppercase tracking-wide">Tiến trình vận đơn</h6>
          <div className="d-flex justify-content-between align-items-center position-relative mx-auto" style={{ maxWidth: '800px' }}>
              <div style={{ position: 'absolute', top: '50%', left: '10%', right: '10%', height: '4px', background: 'var(--border-color)', zIndex: 0 }}></div>
              
              <Badge bg={['arrived_pickup', 'picking_up', 'delivering', 'completed'].includes(orderDetails.order.status) ? "success" : "secondary"} className="p-3 rounded-circle position-relative z-index-1" style={{ width: '50px', height: '50px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', backgroundColor: ['arrived_pickup', 'picking_up', 'delivering', 'completed'].includes(orderDetails.order.status) ? 'var(--brand-orange) !important' : 'var(--border-color)' }}>1</Badge>
              <Badge bg={['delivering', 'completed'].includes(orderDetails.order.status) ? "success" : ['arrived_pickup', 'picking_up'].includes(orderDetails.order.status) ? "warning" : "secondary"} text={['arrived_pickup', 'picking_up', 'delivering', 'completed'].includes(orderDetails.order.status) ? "dark" : "light"} className="p-3 rounded-circle position-relative z-index-1 border border-dark" style={{ width: '50px', height: '50px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', backgroundColor: ['delivering', 'completed'].includes(orderDetails.order.status) ? 'var(--brand-orange) !important' : '' }}>2</Badge>
              <Badge bg={orderDetails.order.status === 'completed' ? "success" : orderDetails.order.status === 'delivering' ? "primary" : "secondary"} text={['delivering', 'completed'].includes(orderDetails.order.status) ? "white" : "light"} className="p-3 rounded-circle position-relative z-index-1 border border-dark" style={{ width: '50px', height: '50px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', backgroundColor: orderDetails.order.status === 'completed' ? 'var(--brand-orange) !important' : '' }}>3</Badge>
              <Badge bg={orderDetails.order.status === 'completed' ? "success" : "secondary"} text={orderDetails.order.status === 'completed' ? "white" : "light"} className="p-3 rounded-circle position-relative z-index-1 border border-dark" style={{ width: '50px', height: '50px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', backgroundColor: orderDetails.order.status === 'completed' ? 'var(--brand-orange) !important' : '' }}>4</Badge>
          </div>
          <div className="d-flex justify-content-between mx-auto mt-3 text-muted fw-bold" style={{ maxWidth: '840px', fontSize: '13px' }}>
              <span style={{ width: '80px', color: ['arrived_pickup', 'picking_up', 'delivering', 'completed'].includes(orderDetails.order.status) ? 'var(--text-main)' : '' }}>Đang xử lý</span>
              <span style={{ width: '80px', color: ['delivering', 'completed'].includes(orderDetails.order.status) ? 'var(--text-main)' : '' }}>Đã lấy hàng</span>
              <span style={{ width: '80px', color: orderDetails.order.status === 'completed' ? 'var(--text-main)' : '' }}>Đang giao</span>
              <span style={{ width: '80px', color: orderDetails.order.status === 'completed' ? 'var(--text-main)' : '' }}>Hoàn thành</span>
          </div>
        </div>

        <Row className={isAdmin ? "justify-content-center" : ""}>
          <Col lg={isAdmin ? 8 : 7} className="mb-4">
            
            {/* LỘ TRÌNH CÔNG VIỆC */}
            <div className="logistics-card mb-4 overflow-hidden">
              <div className="text-white border-bottom py-3 px-4 d-flex align-items-center" style={{ backgroundColor: batchOrders.length > 0 ? '#4ADE80' : 'var(--brand-orange)', borderColor: 'var(--border-color) !important' }}>
                <h5 className="mb-0 fw-bold text-dark">📦 Lộ Trình Công Việc</h5>
              </div>
              <div className="p-4">
                
                <h6 className="fw-bold mb-3 d-flex align-items-center gap-2" style={{ color: '#FF4D4D' }}><span className="fs-5">📍</span> NHIỆM VỤ LẤY HÀNG</h6>
                {renderOrders.map((o, index) => (
                  <div key={`pickup-${o.id}`} className="p-3 mb-4 rounded border" style={{ backgroundColor: 'var(--bg-input)', borderColor: 'var(--border-color) !important', borderLeft: '4px solid #FF4D4D !important' }}>
                    <div className="d-flex justify-content-between align-items-center mb-3">
                      <strong className="text-white fs-5">Khách {index + 1} (Mã #{o.id})</strong>
                      {getStatusBadge(o.status)}
                    </div>
                    <div className="mb-3 text-muted"><strong>Địa chỉ:</strong> <span className="text-white">{o.pickup || o.pickup_location}</span></div>
                    
                    {o.pickup_image_url && (
                      <div className="mt-2 mb-3 p-2 rounded border d-inline-block" style={{ backgroundColor: 'var(--bg-main)', borderColor: 'var(--border-color) !important' }}>
                          <strong className="d-block mb-2" style={{fontSize: '12px', color: '#FF4D4D'}}>📸 Ảnh xác nhận lấy hàng:</strong>
                          <img src={o.pickup_image_url} alt="POD Lấy" className="img-thumbnail border-0 bg-transparent" style={{height: '100px', objectFit: 'cover'}} />
                      </div>
                    )}

                    {isDriverOwner && !['completed', 'cancelled'].includes(o.status) && (
                      <div className="mt-3">
                        <Button size="sm" variant="outline-light" className="mb-3" style={{ borderColor: 'var(--border-color)' }} onClick={() => openGoogleMapsTo(o.pickup_lat, o.pickup_lng, o.pickup || o.pickup_location)}>
                          🗺️ Dẫn đường Map (GPS)
                        </Button>
                        
                        {o.status === 'accepted' && (
                           <SwipeButton text="Quẹt xác nhận: Đã tới điểm đến" colorClass="danger" onComplete={() => handleUpdateStatus(o.id, 'arrived_pickup')} isLoading={updatingOrderId === o.id} />
                        )}
                        {o.status === 'arrived_pickup' && (
                           <SwipeButton text="Quẹt xác nhận: Đã lấy hàng" colorClass="danger" onComplete={() => handleSwipeWithLocationCheck(o.id, o.pickup_lat, o.pickup_lng, 'pickup')} isLoading={updatingOrderId === o.id} />
                        )}
                      </div>
                    )}
                  </div>
                ))}

                <hr className="my-4" style={{ borderColor: 'var(--border-color)' }} />

                <h6 className="fw-bold mb-3 d-flex align-items-center gap-2" style={{ color: '#4ADE80' }}><span className="fs-5">🚩</span> NHIỆM VỤ GIAO HÀNG</h6>
                {renderOrders.map((o, index) => (
                  <div key={`dropoff-${o.id}`} className="p-3 mb-4 rounded border" style={{ backgroundColor: 'var(--bg-input)', borderColor: 'var(--border-color) !important', borderLeft: '4px solid #4ADE80 !important' }}>
                    <div className="d-flex justify-content-between align-items-center mb-3">
                      <strong className="text-white fs-5">Khách {index + 1} (Mã #{o.id})</strong>
                      {['completed', 'cancelled'].includes(o.status) ? getStatusBadge(o.status) : <Badge bg="dark" className="border border-secondary">Chưa giao</Badge>}
                    </div>
                    <div className="mb-2 text-muted"><strong>Địa chỉ:</strong> <span className="text-white">{o.dropoff || o.dropoff_location}</span></div>
                    <div className="mb-3 text-muted"><strong>Ghi chú:</strong> <span className="text-white">{o.package_details}</span></div>
                    
                    {o.proof_image_url && (
                      <div className="mt-2 mb-3 p-2 rounded border d-inline-block" style={{ backgroundColor: 'var(--bg-main)', borderColor: 'var(--border-color) !important' }}>
                          <strong className="d-block mb-2" style={{fontSize: '12px', color: '#4ADE80'}}>📸 Ảnh bằng chứng giao hàng (PoD):</strong>
                          <img src={o.proof_image_url} alt="POD Giao" className="img-thumbnail border-0 bg-transparent" style={{height: '100px', objectFit: 'cover'}} />
                      </div>
                    )}

                    {isDriverOwner && ['picking_up', 'delivering'].includes(o.status) && (
                      <div className="mt-3">
                        <Button size="sm" variant="outline-light" className="mb-3" style={{ borderColor: 'var(--border-color)' }} onClick={() => openGoogleMapsTo(o.dropoff_lat, o.dropoff_lng, o.dropoff || o.dropoff_location)}>
                          🗺️ Dẫn đường Map (GPS)
                        </Button>
                        
                        {o.status === 'picking_up' && (
                           <SwipeButton text="Quẹt xác nhận: Đã tới điểm giao" colorClass="success" onComplete={() => handleUpdateStatus(o.id, 'delivering')} isLoading={updatingOrderId === o.id} />
                        )}
                        {o.status === 'delivering' && (
                           <SwipeButton text="Quẹt xác nhận: Hoàn thành đơn" colorClass="success" onComplete={() => handleSwipeWithLocationCheck(o.id, o.dropoff_lat, o.dropoff_lng, 'dropoff')} isLoading={updatingOrderId === o.id} />
                        )}
                      </div>
                    )}
                  </div>
                ))}

                <div className={`mt-4 p-4 border border-2 rounded text-center shadow-sm ${totalCashToCollect > 0 ? 'bg-dark' : 'bg-dark'}`} style={{ borderColor: totalCashToCollect > 0 ? '#FF4D4D !important' : '#4ADE80 !important' }}>
                   <h6 className={`fw-bold mb-2 ${totalCashToCollect > 0 ? 'text-danger' : 'text-success'}`}>
                     {totalCashToCollect > 0 ? '💰 TỔNG TIỀN MẶT PHẢI THU' : '💰 KHÔNG CẦN THU TIỀN MẶT'}
                   </h6>
                   {totalCashToCollect > 0 && <h2 className="text-white fw-bold mb-0">{totalCashToCollect.toLocaleString()} đ</h2>}
                </div>

                {userInfo.role === 'customer' && !isBatchClosed && ['pending', 'accepted'].includes(orderDetails.order.status) && (
                   <div className="mt-4 d-flex justify-content-end border-top pt-4" style={{ borderColor: 'var(--border-color) !important' }}>
                     <Button variant="outline-danger" className="fw-bold px-4" onClick={handleCustomerCancel}>🖐️ Yêu cầu Hủy đơn</Button>
                   </div>
                )}

                {isDriverOwner && !isBatchClosed && canCancelBatch && (
                  <div className="mt-4 d-flex justify-content-end border-top pt-4" style={{ borderColor: 'var(--border-color) !important' }}>
                      <Button variant="outline-danger" className="fw-bold px-4" onClick={handleDriverCancelBatch}>Hủy / Nhả toàn bộ chuyến xe</Button>
                  </div>
                )}

              </div>
            </div>

            {/* THÔNG TIN LIÊN LẠC ĐƯỢC CHIA RA COMPONENT */}
            <OrderContactInfo renderOrders={renderOrders} orderDetails={orderDetails} shouldHideInfo={shouldHideInfo} batchOrders={batchOrders} />

            {/* NHẬT KÝ CHAT CHO ADMIN */}
            {isAdmin && (
              <div className="logistics-card p-4 mt-4 mb-4" style={{ borderLeft: '4px solid var(--brand-orange)' }}>
                  <h5 className="fw-bold text-white border-bottom pb-3 mb-3 d-flex align-items-center gap-2" style={{ borderColor: 'var(--border-color) !important' }}>
                    <span className="fs-4">💬</span> Nhật ký Chat (Khách ↔ Tài xế)
                  </h5>
                  {messages.length === 0 ? (
                    <div className="text-muted fst-italic text-center py-3">Không có cuộc trò chuyện nào được ghi nhận.</div>
                  ) : (
                    <div style={{ maxHeight: '350px', overflowY: 'auto' }} className="pe-2">
                      {messages.map(msg => {
                        const isSystem = msg.content.includes("HỆ THỐNG:");
                        if (isSystem) return <div key={msg.id} className="text-center my-3"><Badge bg="danger" className="p-2 fw-normal">{msg.content}</Badge></div>;
                        
                        const isDriver = msg.sender_id === orderDetails?.order?.driver_id;
                        return (
                          <div key={msg.id} className="mb-3 p-3 rounded border" style={{ backgroundColor: 'var(--bg-input)', borderColor: 'var(--border-color) !important' }}>
                            <strong className={isDriver ? 'text-success' : 'text-primary'} style={{ color: isDriver ? '#4ADE80 !important' : 'var(--brand-orange) !important' }}>
                              {isDriver ? '🛵 Tài xế' : '👤 Khách hàng'}:
                            </strong> <span className="text-white fw-bold ms-2">{msg.content}</span>
                            <div className="text-muted mt-2 fw-bold" style={{fontSize: '11px'}}>{new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                          </div>
                        );
                      })}
                    </div>
                  )}
              </div>
            )}

            {/* PHẦN ĐÁNH GIÁ CỦA KHÁCH */}
            {orderDetails.order.rating && (
              <div className="logistics-card p-4 mt-4 mb-4" style={{ borderLeft: '4px solid #FFC107' }}>
                  <h6 className="text-warning mb-3 fw-bold text-uppercase">⭐ Đánh giá từ khách hàng:</h6>
                  <div className="fs-3 mb-2">
                    {[...Array(5)].map((_, index) => <span key={index} style={{ color: index < orderDetails.order.rating ? '#ffc107' : '#333' }}>★</span>)}
                  </div>
                  {orderDetails.order.feedback && <p className="mb-0 text-white fst-italic mt-2">"{orderDetails.order.feedback}"</p>}
              </div>
            )}

            {/* YÊU CẦU KHÁCH ĐÁNH GIÁ */}
            {userInfo.role === 'customer' && orderDetails.order.status === 'completed' && !orderDetails.order.rating && (
              <div className="logistics-card p-4 mt-4 mb-4 d-flex justify-content-between align-items-center flex-wrap gap-3" style={{ borderLeft: '4px solid #4ADE80' }}>
                  <div>
                    <h5 className="text-success fw-bold mb-2">📝 Chuyến đi đã hoàn thành!</h5>
                    <p className="mb-0 text-muted">Bạn chưa đánh giá chất lượng phục vụ của tài xế.</p>
                  </div>
                  <Button variant="outline-success" className="fw-bold px-4" onClick={() => setShowReviewModal(true)}>Đánh giá ngay ⭐</Button>
              </div>
            )}
          </Col>

          {/* CỘT PHẢI: KHUNG CHAT TƯƠNG TÁC (ẨN VỚI ADMIN) */}
          {!isAdmin && (
            <Col lg={5}>
              <OrderChatBox orderId={id} userInfo={userInfo} isChatDisabled={isChatDisabled} isBatchClosed={isBatchClosed} messages={messages} fetchMessages={fetchMessages} />
            </Col>
          )}
        </Row>

        {/* MODALS */}
        <Modal show={showReviewModal} onHide={() => setShowReviewModal(false)} centered contentClassName="logistics-card border-0">
          <Modal.Header closeButton className="border-bottom" style={{ borderColor: 'var(--border-color)' }}>
            <Modal.Title className="fw-bold text-white">🎉 Chuyến đi hoàn tất!</Modal.Title>
          </Modal.Header>
          <Form onSubmit={handleSubmitReview}>
            <Modal.Body className="text-center p-4">
              <h5 className="mb-4 text-white">Tài xế <strong style={{ color: 'var(--brand-orange)' }}>{orderDetails?.driver?.name}</strong> phục vụ bạn thế nào?</h5>
              <div className="mb-4 fs-1" style={{ cursor: 'pointer' }}>
                {[1, 2, 3, 4, 5].map((star) => <span key={star} onClick={() => setRating(star)} style={{ color: star <= rating ? '#ffc107' : '#333', transition: 'color 0.2s', margin: '0 5px' }}>★</span>)}
              </div>
              <Form.Group className="mb-2 text-start">
                <Form.Label className="fw-bold text-muted" style={{ fontSize: '13px' }}>NHẬN XÉT THÊM (KHÔNG BẮT BUỘC)</Form.Label>
                <Form.Control as="textarea" rows={3} className="logistics-input" placeholder="Ví dụ: Tài xế thân thiện, đi đúng giờ..." value={feedback} onChange={(e) => setFeedback(e.target.value)} />
              </Form.Group>
            </Modal.Body>
            <Modal.Footer className="justify-content-center border-top" style={{ borderColor: 'var(--border-color)' }}>
              <Button type="submit" disabled={isSubmittingReview} className="btn-orange px-5 py-2 fw-bold w-100">{isSubmittingReview ? "Đang gửi..." : "Gửi Đánh Giá Ngay"}</Button>
            </Modal.Footer>
          </Form>
        </Modal>

        <Modal show={showPodModal} onHide={() => setShowPodModal(false)} centered backdrop="static" contentClassName="logistics-card border-0">
          <Modal.Header closeButton className="border-bottom" style={{ borderColor: 'var(--border-color)' }}>
            <Modal.Title className="fw-bold text-white">📸 {podActionType === 'pickup' ? 'CHỤP ẢNH LẤY HÀNG' : 'CHỤP ẢNH GIAO HÀNG'}</Modal.Title>
          </Modal.Header>
          <Form onSubmit={handleCompleteWithPod}>
            <Modal.Body className="text-center p-4">
              <Alert variant="warning" className="fw-bold mb-4 border-warning bg-transparent text-warning">Vui lòng chụp rõ mã vận đơn và tình trạng hàng hóa để đối chiếu!</Alert>
              <Form.Control type="file" className="logistics-input" accept="image/*" capture="environment" onChange={(e) => setPodFile(e.target.files[0])} required />
            </Modal.Body>
            <Modal.Footer className="justify-content-center border-top" style={{ borderColor: 'var(--border-color)' }}>
              <Button variant="outline-secondary" className="border-0 text-muted" onClick={() => setShowPodModal(false)}>Hủy</Button>
              <Button variant="success" type="submit" disabled={isUploadingPod} className="fw-bold px-5">
                {isUploadingPod ? "Đang tải ảnh lên..." : "📤 HOÀN THÀNH"}
              </Button>
            </Modal.Footer>
          </Form>
        </Modal>
      </Container>
    </Container>
  );
}