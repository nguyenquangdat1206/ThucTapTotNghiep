import React, { useState, useEffect } from 'react';
import { Container, Form, Button, Alert, Row, Col, InputGroup, Badge } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

import AddressSearchInput from '../components/AddressSearchInput';
import BookingMap from '../components/BookingMap';

const PORT_LIST = [
  { name: "Cảng Cát Lái", lat: 10.7661, lng: 106.7820 },
  { name: "Cảng Tân Cảng Phú Hữu", lat: 10.7895, lng: 106.8138 },
  { name: "Cảng Tân Cảng Hiệp Phước", lat: 10.6272, lng: 106.7594 },
  { name: "Cảng Container Quốc tế Việt Nam (VICT)", lat: 10.7437, lng: 106.7322 },
  { name: "Cảng Tân Thuận", lat: 10.7578, lng: 106.7419 },
  { name: "Cảng Bến Nghé", lat: 10.7538, lng: 106.7383 },
  { name: "Cảng Saigon Premier Container Terminal (SPCT)", lat: 10.6214, lng: 106.7567 },
  { name: "Cảng Container Quốc tế SP-ITC", lat: 10.7905, lng: 106.8202 }
];

export default function Booking() {
  const [promoCodeInput, setPromoCodeInput] = useState('');
  const [appliedPromo, setAppliedPromo] = useState(null);

  const navigate = useNavigate();
  const userInfoString = localStorage.getItem('userInfo');
  const userInfo = userInfoString ? JSON.parse(userInfoString) : null;

  const [userLocation, setUserLocation] = useState(null);
  const [pickupCoords, setPickupCoords] = useState(null);
  const [dropoffCoords, setDropoffCoords] = useState(null);
  const [pickupAddress, setPickupAddress] = useState('');
  const [dropoffAddress, setDropoffAddress] = useState('');
  
  const [senderName, setSenderName] = useState(userInfo?.name || '');
  const [senderPhone, setSenderPhone] = useState(userInfo?.phone || '');
  const [receiverName, setReceiverName] = useState('');
  const [receiverPhone, setReceiverPhone] = useState('');
  
  const [packageDetails, setPackageDetails] = useState('');

  const [distance, setDistance] = useState(0);
  const [serviceType, setServiceType] = useState('express'); 
  const [routePolyline, setRoutePolyline] = useState([]); 
  
  const [basePrice, setBasePrice] = useState(0);
  const [isBulky, setIsBulky] = useState(false);
  const [isDoorDelivery, setIsDoorDelivery] = useState(false);
  const [tipAmount, setTipAmount] = useState(''); 
  const [totalPrice, setTotalPrice] = useState(0);

  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [hasCod, setHasCod] = useState(false);
  const [codAmount, setCodAmount] = useState('');

  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => setUserLocation({ lat: position.coords.latitude, lng: position.coords.longitude }),
        (error) => console.warn("Lỗi không lấy được GPS: ", error)
      );
    }
  }, []);

  useEffect(() => { 
    if (serviceType === 'container') {
      setIsBulky(false);
      setDropoffAddress(''); 
      setDropoffCoords(null); 
    } 
  }, [serviceType]);

  useEffect(() => {
    if (distance > 0) {
      let calcBase = 0;
      if (serviceType === 'container') {
        const BASE_CONTAINER = 2600000;
        if (distance <= 20) calcBase = BASE_CONTAINER;
        else {
          const extraKm = Math.ceil(distance - 20); 
          calcBase = BASE_CONTAINER + (extraKm * (distance < 50 ? 33000 : distance < 100 ? 32000 : distance < 200 ? 31500 : 29500));
        }
      } else {
        if (distance <= 3) calcBase = 16000;
        else if (distance <= 4) calcBase = 20000;
        else if (distance <= 5) calcBase = 25000;
        else calcBase = 25000 + Math.ceil(distance - 5) * 6500; 
      }
      setBasePrice(Math.ceil(calcBase / 1000) * 1000);
    } else setBasePrice(0);
  }, [distance, serviceType]);

  useEffect(() => {
    let extra = 0;
    if (isBulky) extra += 20000;
    if (isDoorDelivery) extra += 10000;
    const currentTip = parseInt(tipAmount) || 0;
    setTotalPrice(basePrice + extra + currentTip);
  }, [basePrice, isBulky, isDoorDelivery, tipAmount]);

  useEffect(() => {
    if (appliedPromo && totalPrice < appliedPromo.min_order_value) {
      setAppliedPromo(null); setPromoCodeInput('');
      alert("⚠️ Đơn hàng không còn đủ điều kiện áp dụng mã khuyến mãi này!");
    }
  }, [totalPrice, appliedPromo]);

  useEffect(() => {
    if (pickupCoords && dropoffCoords) { fetchRouteDistance(pickupCoords, dropoffCoords); } 
    else { setDistance(0); setBasePrice(0); setRoutePolyline([]); }
  }, [pickupCoords, dropoffCoords]);

  const fetchRouteDistance = async (start, end) => {
    try {
      const response = await fetch(`https://router.project-osrm.org/route/v1/driving/${start.lng},${start.lat};${end.lng},${end.lat}?overview=full&geometries=geojson`);
      if (!response.ok) throw new Error("OSRM Server Error");
      const data = await response.json();
      if (data.routes?.length > 0) {
        const routeData = data.routes[0];
        setDistance(parseFloat((routeData.distance / 1000).toFixed(1)));
        setRoutePolyline(routeData.geometry.coordinates.map(coord => [coord[1], coord[0]]));
      } else throw new Error("No route");
    } catch (error) {
      setDistance(10.0); 
      setRoutePolyline([]); 
    }
  };

  const reverseGeocode = async (lat, lng, type) => {
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`);
      const data = await res.json();
      if (data && data.address) {
        const addr = data.address;
        const poi = addr.amenity || addr.building || addr.shop || '';
        const street = addr.road || '';
        const ward = addr.suburb || addr.village || '';
        const district = addr.city_district || addr.city || '';
        
        const parts = [];
        if (poi) parts.push(poi);
        if (street && street !== poi) {
           if (addr.house_number) parts.push(`${addr.house_number} ${street}`);
           else parts.push(street);
        }
        if (ward) parts.push(ward);
        if (district) parts.push(district);
        
        const finalAddress = parts.length > 0 ? parts.join(', ') : (data.display_name || "Vị trí đã chọn");
        if (type === 'pickup') setPickupAddress(finalAddress);
        else setDropoffAddress(finalAddress);
      }
    } catch (error) { console.error("Reverse geocoding error:", error); }
  };

  const handleApplyPromo = async () => {
    if (!promoCodeInput.trim()) return;
    try {
      const response = await axios.post('https://datquang-backend.onrender.com/promotions/apply', { code: promoCodeInput, order_value: totalPrice });
      setAppliedPromo(response.data);
      alert("🎉 " + response.data.message);
    } catch (error) {
      alert("❌ " + (error.response?.data?.detail || "Lỗi áp dụng mã khuyến mãi!"));
      setAppliedPromo(null);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    if (!pickupCoords || !dropoffCoords) { setIsError(true); setMessage("⚠️ Vui lòng chọn đủ 2 điểm lấy và giao hàng!"); return; }
    
    setIsSubmitting(true); setMessage('Đang xử lý tọa độ và lên đơn...'); setIsError(false);

    try {
      const token = userInfo.access_token;
      const getAddrText = (addr, coords) => addr || `${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`;
      
      const pickupRes = await axios.post(`https://datquang-backend.onrender.com/users/${userInfo.user_id}/addresses`, { label: "Điểm lấy", latitude: pickupCoords.lat, longitude: pickupCoords.lng, address_text: getAddrText(pickupAddress, pickupCoords) }, { headers: { Authorization: `Bearer ${token}` } });
      const dropoffRes = await axios.post(`https://datquang-backend.onrender.com/users/${userInfo.user_id}/addresses`, { label: "Điểm giao", latitude: dropoffCoords.lat, longitude: dropoffCoords.lng, address_text: getAddrText(dropoffAddress, dropoffCoords) }, { headers: { Authorization: `Bearer ${token}` } });
      
      const extraFeesData = { bulky_fee: isBulky ? 20000 : 0, door_delivery_fee: isDoorDelivery ? 10000 : 0, tip: parseInt(tipAmount) || 0 };
      
      let addonTags = "";
      if (isBulky) addonTags += " - CỒNG KỀNH";
      if (isDoorDelivery) addonTags += " - TẬN CỬA";
      const finalDetails = `[${serviceType === 'express' ? '🛵 GIAO NHANH' : '🚛 CONTAINER'}] ${packageDetails}${addonTags}`;
      
      const discountAmount = appliedPromo ? appliedPromo.discount_amount : 0;
      const finalTotalPrice = Math.max(0, totalPrice - discountAmount);

      await axios.post('https://datquang-backend.onrender.com/orders', {
        customer_id: userInfo.user_id, 
        pickup_address_id: pickupRes.data.id, 
        dropoff_address_id: dropoffRes.data.id,
        promo_id: appliedPromo ? appliedPromo.promo_id : null, 
        discount_amount: discountAmount,                           
        package_details: finalDetails, 
        original_price: basePrice, 
        total_price: finalTotalPrice,
        extra_fees: JSON.stringify(extraFeesData), 
        payment_method: paymentMethod, 
        cod_amount: hasCod ? (parseInt(codAmount) || 0) : 0,
        sender_name: senderName,
        sender_phone: senderPhone,
        receiver_name: receiverName,
        receiver_phone: receiverPhone
      }, { headers: { Authorization: `Bearer ${token}` } });

      setIsError(false); setMessage('🎉 Đặt cuốc thành công! Hệ thống đang gọi tài xế...');
      setTimeout(() => navigate('/dashboard'), 2000);
    } catch (error) {
      setIsError(true); setMessage("❌ Lỗi hệ thống: Không thể xử lý đơn hàng lúc này.");
    } finally { setIsSubmitting(false); }
  };

  if (!userInfo || userInfo.role !== 'customer') return <Container className="mt-5 text-center"><h3 className="text-danger">Không có quyền truy cập!</h3></Container>;

  const finalTotalPrice = Math.max(0, totalPrice - (appliedPromo ? appliedPromo.discount_amount : 0));

  return (
    <Container className="mt-4 mb-5" style={{ maxWidth: '1200px', position: 'relative', zIndex: 1 }}>
      
      {/* KHUNG KÍNH LỚN BỌC TOÀN BỘ TRANG */}
      <div className="glass-card p-4">
        <div className="text-center mb-4">
            <h2 className="fw-bold text-primary" style={{ textShadow: '0 2px 5px rgba(255,255,255,0.8)' }}>
                Bản Đồ Đặt Cuốc Xe
            </h2>
            <p className="text-dark fw-bold">Điền thông tin và theo dõi lộ trình trực tiếp</p>
        </div>

        {message && <Alert variant={isError ? "danger" : "info"} className="glass-card fw-bold shadow-sm border-0">{message}</Alert>}
        
        {((pickupAddress && !pickupCoords) || (dropoffAddress && !dropoffCoords)) && (
          <Alert variant="warning" className="glass-card fw-bold py-2 shadow-sm border-warning border-start border-4">
             ⚠️ Gợi ý: Bạn đã nhập chữ, nhưng quên click chọn địa chỉ trong danh sách gợi ý!
          </Alert>
        )}

        {serviceType === 'container' && (
           <Alert variant="info" className="glass-card fw-bold shadow-sm border-info border-start border-4">
             🚢 CHẾ ĐỘ CONTAINER: Điểm giao hàng (trả hàng) bắt buộc phải nằm trong các Bến cảng được cấp phép tại TP.HCM.
           </Alert>
        )}

        <Row>
          {/* ============================== */}
          {/* CỘT TRÁI: FORM ĐIỀN THÔNG TIN */}
          {/* ============================== */}
          <Col lg={4} className="mb-4">
            <Form className="glass-card p-4 h-100 shadow-sm" style={{ maxHeight: '800px', overflowY: 'auto' }} onSubmit={handleSubmit}>
              
              <h5 className="text-primary mb-3 fw-bold">Tùy chọn dịch vụ</h5>
              <Form.Select className="glass-input mb-4 fw-bold text-primary py-2" value={serviceType} onChange={(e) => setServiceType(e.target.value)}>
                <option value="express">🛵 Giao Hàng Nhanh (Xe máy)</option>
                <option value="container">🚛 Vận tải Container (40 feet)</option>
              </Form.Select>
              
              <hr className="text-muted opacity-50" />

              {/* 1. ĐỊA CHỈ GIAO NHẬN */}
              <div className="position-relative mb-3">
                  <AddressSearchInput 
                    label="📍 Điểm lấy hàng" placeholder="Nhập địa chỉ lấy hàng..." 
                    value={pickupAddress} onChange={(val) => { setPickupAddress(val); setPickupCoords(null); }} 
                    onSelectLocation={(coords) => { setPickupCoords(coords); setDropoffCoords(null); setDropoffAddress(''); }} 
                    badgeColor="primary" userLocation={userLocation} 
                  />
              </div>
              
              {serviceType === 'container' ? (
                <Form.Group className="mb-3 position-relative">
                  <Form.Label className="fw-bold text-danger">🚩 Điểm giao hàng (Bến cảng)</Form.Label>
                  <Form.Select 
                    className="glass-input border-danger border-2 fw-bold text-danger py-2"
                    value={dropoffAddress}
                    onChange={(e) => {
                      const selectedPort = PORT_LIST.find(p => p.name === e.target.value);
                      if (selectedPort) {
                        setDropoffAddress(selectedPort.name);
                        setDropoffCoords({ lat: selectedPort.lat, lng: selectedPort.lng });
                      } else {
                        setDropoffAddress('');
                        setDropoffCoords(null);
                      }
                    }}
                  >
                    <option value="">-- Vui lòng chọn Bến cảng --</option>
                    {PORT_LIST.map((port, index) => (
                       <option key={index} value={port.name}>🚢 {port.name}</option>
                    ))}
                  </Form.Select>
                </Form.Group>
              ) : (
                <div className="position-relative mb-3">
                  <AddressSearchInput 
                    label="🚩 Điểm giao hàng" placeholder="Nhập địa chỉ giao hàng..." 
                    value={dropoffAddress} onChange={(val) => { setDropoffAddress(val); setDropoffCoords(null); }} 
                    onSelectLocation={setDropoffCoords} badgeColor="danger" userLocation={userLocation} 
                  />
                </div>
              )}

              {/* 2. THÔNG TIN LIÊN HỆ ĐƯỢC GIẤU GỌN TRONG THẺ KÍNH */}
              <div className="mt-4 mb-4 p-3 glass-card border-info border-start border-4 shadow-sm">
                <h6 className="text-primary fw-bold mb-3">👤 Thông Tin Liên Hệ</h6>
                
                <Badge bg="light" text="dark" className="mb-2 shadow-sm">📍 Lấy hàng từ</Badge>
                <Row className="mb-3">
                  <Col md={6}>
                    <Form.Control type="text" className="glass-input mb-2 mb-md-0" placeholder="Tên người gửi" value={senderName} onChange={e => setSenderName(e.target.value)} required />
                  </Col>
                  <Col md={6}>
                    <Form.Control type="tel" className="glass-input" placeholder="SĐT người gửi" value={senderPhone} onChange={e => setSenderPhone(e.target.value)} required />
                  </Col>
                </Row>
                
                <Badge bg="light" text="danger" className="mb-2 shadow-sm border border-danger">🚩 Giao hàng cho</Badge>
                <Row>
                  <Col md={6}>
                    <Form.Control type="text" className="glass-input mb-2 mb-md-0" placeholder="Tên người nhận" value={receiverName} onChange={e => setReceiverName(e.target.value)} required />
                  </Col>
                  <Col md={6}>
                    <Form.Control type="tel" className="glass-input" placeholder="SĐT người nhận" value={receiverPhone} onChange={e => setReceiverPhone(e.target.value)} required />
                  </Col>
                </Row>
              </div>

              <hr className="text-muted opacity-50" />
              
              {/* 3. CÁC TÙY CHỌN & THANH TOÁN */}
              <h6 className="fw-bold text-dark mb-3">Dịch vụ bổ sung</h6>
              {serviceType === 'express' && (
                <Form.Check type="checkbox" id="bulky-check" className="mb-2 fw-bold" label={<>Hàng cồng kềnh <span className="text-danger">+20.000đ</span></>} checked={isBulky} onChange={(e) => setIsBulky(e.target.checked)} />
              )}
              <Form.Check type="checkbox" id="door-check" className="mb-3 fw-bold" label={<>Giao tận cửa / Lên lầu <span className="text-danger">+10.000đ</span></>} checked={isDoorDelivery} onChange={(e) => setIsDoorDelivery(e.target.checked)} />
              <Form.Group className="mb-3">
                <Form.Label className="fw-bold text-success" style={{fontSize: '14px'}}>💰 Tiền Tip cho Tài xế (VND)</Form.Label>
                <Form.Control type="number" className="glass-input" placeholder="Tùy tâm bồi dưỡng tài xế..." value={tipAmount} onChange={(e) => setTipAmount(e.target.value)} />
              </Form.Group>

              <hr className="text-muted opacity-50" />

              <h6 className="fw-bold text-dark mb-3">💳 Thanh toán & Thu hộ</h6>
              <Form.Group className="mb-3">
                <Form.Label className="fw-bold text-muted" style={{fontSize: '13px'}}>Phương thức thanh toán phí ship</Form.Label>
                <Form.Select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className="glass-input fw-bold text-primary">
                  <option value="cash">💵 Tiền mặt (Tài xế thu tiền ship)</option>
                  <option value="bank">💳 Thẻ / Ví điện tử (Trừ tiền trong App)</option>
                </Form.Select>
              </Form.Group>
              
              <div className="glass-card p-3 mb-4 border-danger border-start border-4 shadow-sm">
                <Form.Check type="checkbox" id="cod-check" className="mb-2 fw-bold text-danger" label="📦 Thu hộ tiền hàng (COD)" checked={hasCod} onChange={(e) => { setHasCod(e.target.checked); if(!e.target.checked) setCodAmount(''); }} />
                {hasCod && (
                  <Form.Group className="mt-2">
                    <Form.Control type="number" className="glass-input border-danger" placeholder="Nhập số tiền thu hộ (VD: 250000)" value={codAmount} onChange={(e) => setCodAmount(e.target.value)} />
                    <Form.Text className="text-dark fw-bold mt-2 d-block" style={{fontSize: '12px'}}>Tài xế sẽ thu khoản tiền này từ người nhận và mang về đưa cho bạn.</Form.Text>
                  </Form.Group>
                )}
              </div>

              {/* KHUYẾN MÃI & TỔNG TIỀN */}
              <div className="glass-card p-3 mb-4 shadow-sm">
                <Form.Label className="fw-bold text-danger">🎁 Mã Khuyến Mãi</Form.Label>
                <InputGroup className="mb-3">
                  <Form.Control type="text" className="glass-input fw-bold text-primary" placeholder="Nhập voucher..." value={promoCodeInput} onChange={e => setPromoCodeInput(e.target.value.toUpperCase())} disabled={appliedPromo !== null} />
                  {appliedPromo ? (
                      <Button variant="danger" className="glass-btn text-danger fw-bold border-danger" onClick={() => {setAppliedPromo(null); setPromoCodeInput('');}}>Hủy mã</Button>
                  ) : (
                      <Button variant="success" className="glass-btn text-success fw-bold border-success" onClick={handleApplyPromo}>Áp dụng</Button>
                  )}
                </InputGroup>
                {appliedPromo && <div className="text-success fw-bold"><span className="me-1">✔️</span>Đã giảm: {appliedPromo.discount_amount.toLocaleString()} đ</div>}
                
                <hr className="text-muted opacity-50" />

                <div className="d-flex justify-content-between mb-2 text-dark fw-bold"><span>Lộ trình ({distance} km):</span><span>{basePrice.toLocaleString()} đ</span></div>
                {isBulky && <div className="d-flex justify-content-between mb-2 text-dark fw-bold"><span>Phí cồng kềnh:</span><span>20,000 đ</span></div>}
                {isDoorDelivery && <div className="d-flex justify-content-between mb-2 text-dark fw-bold"><span>Giao tận cửa:</span><span>10,000 đ</span></div>}
                {(parseInt(tipAmount) > 0) && <div className="d-flex justify-content-between mb-2 text-dark fw-bold"><span>Tiền Tip:</span><span>{parseInt(tipAmount).toLocaleString()} đ</span></div>}
                {appliedPromo && <div className="d-flex justify-content-between mb-2 text-danger fw-bold"><span>Mã giảm giá:</span><span>-{appliedPromo.discount_amount.toLocaleString()} đ</span></div>}

                <div className="d-flex justify-content-between align-items-center mt-3 pt-3 border-top border-dark border-2">
                  <span className="fw-bold fs-5 text-dark">Thành tiền:</span>
                  <span className="fs-3 fw-bold text-success" style={{ textShadow: '1px 1px 0 #fff' }}>{finalTotalPrice.toLocaleString()} đ</span>
                </div>
                {hasCod && parseInt(codAmount) > 0 && (
                    <div className="d-flex justify-content-between align-items-center mt-2 text-danger fw-bold">
                        <span>Tiền thu hộ (COD):</span>
                        <span className="fs-5">{parseInt(codAmount).toLocaleString()} đ</span>
                    </div>
                )}
              </div>

              <Form.Group className="mb-4">
                <Form.Control as="textarea" className="glass-input" rows={2} placeholder="Ghi chú thêm cho tài xế (VD: Đến hẻm 20 thì rẽ trái)..." value={packageDetails} onChange={(e) => setPackageDetails(e.target.value)} required />
              </Form.Group>
              
              <Button type="submit" className="glass-btn-primary w-100 py-3 mb-3 fw-bold fs-5 shadow-lg" disabled={!pickupCoords || !dropoffCoords || isSubmitting} style={{ borderRadius: '15px' }}>
                {isSubmitting ? '⏳ ĐANG TÌM TÀI XẾ...' : '🚀 XÁC NHẬN ĐẶT ĐƠN NGAY'}
              </Button>
              <div className="text-center">
                  <Button variant="link" className="text-dark fw-bold text-decoration-none" onClick={() => navigate('/dashboard')}>⬅️ Hủy bỏ & Quay về</Button>
              </div>
            </Form>
          </Col>
          
          {/* ============================== */}
          {/* CỘT PHẢI: BẢN ĐỒ LỚN */}
          {/* ============================== */}
          <Col lg={8}>
            <div className="glass-card p-2 h-100 shadow-sm" style={{ minHeight: '600px' }}>
                <BookingMap 
                    pickupCoords={pickupCoords} setPickupCoords={setPickupCoords} 
                    dropoffCoords={dropoffCoords} setDropoffCoords={setDropoffCoords} 
                    setDropoffAddress={setDropoffAddress} reverseGeocode={reverseGeocode} 
                    routePolyline={routePolyline} 
                />
            </div>
          </Col>
        </Row>
      </div>
    </Container>
  );
}