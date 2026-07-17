import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Form, Button, Alert, InputGroup } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

import AddressSearchInput from '../components/AddressSearchInput';
import BookingMap from '../components/BookingMap';

// Đã khôi phục đầy đủ 8 Bến Cảng
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
        (error) => console.warn("GPS Error: ", error)
      );
    }
  }, []);

  useEffect(() => { 
    if (serviceType === 'container') {
      setIsBulky(false); setDropoffAddress(''); setDropoffCoords(null); 
    } 
  }, [serviceType]);

  useEffect(() => {
    if (distance > 0) {
      let calcBase = 0;
      if (serviceType === 'container') {
        calcBase = distance <= 20 ? 2600000 : 2600000 + (Math.ceil(distance - 20) * 33000);
      } else if (serviceType === 'truck') {
        // Logic Xe tải: 150k cho 5km đầu, sau đó 15k/km
        calcBase = distance <= 5 ? 150000 : 150000 + (Math.ceil(distance - 5) * 15000);
      } else {
        calcBase = distance <= 3 ? 16000 : 25000 + Math.ceil(distance - 5) * 6500; 
      }
      setBasePrice(Math.ceil(calcBase / 1000) * 1000);
    } else setBasePrice(0);
  }, [distance, serviceType]);

  useEffect(() => {
    let extra = isBulky ? 20000 : 0;
    extra += isDoorDelivery ? 10000 : 0;
    setTotalPrice(basePrice + extra + (parseInt(tipAmount) || 0));
  }, [basePrice, isBulky, isDoorDelivery, tipAmount]);

  useEffect(() => {
    if (appliedPromo && totalPrice < appliedPromo.min_order_value) {
      setAppliedPromo(null); setPromoCodeInput('');
    }
  }, [totalPrice, appliedPromo]);

  useEffect(() => {
    if (pickupCoords && dropoffCoords) fetchRouteDistance(pickupCoords, dropoffCoords);
    else { setDistance(0); setBasePrice(0); setRoutePolyline([]); }
  }, [pickupCoords, dropoffCoords]);

  const fetchRouteDistance = async (start, end) => {
    try {
      const response = await fetch(`https://router.project-osrm.org/route/v1/driving/${start.lng},${start.lat};${end.lng},${end.lat}?overview=full&geometries=geojson`);
      const data = await response.json();
      if (data.routes?.length > 0) {
        setDistance(parseFloat((data.routes[0].distance / 1000).toFixed(1)));
        setRoutePolyline(data.routes[0].geometry.coordinates.map(c => [c[1], c[0]]));
      }
    } catch (error) { setDistance(10.0); }
  };

  const reverseGeocode = async (lat, lng, type) => {
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`);
      const data = await res.json();
      if (data?.address) {
        const addr = data.address;
        const finalAddress = [addr.amenity || addr.building, addr.road, addr.suburb, addr.city_district].filter(Boolean).join(', ');
        type === 'pickup' ? setPickupAddress(finalAddress || data.display_name) : setDropoffAddress(finalAddress || data.display_name);
      }
    } catch (error) { console.error(error); }
  };

  const handleApplyPromo = async () => {
    if (!promoCodeInput.trim()) return;
    try {
      const response = await axios.post('https://datquang-backend.onrender.com/promotions/apply', { code: promoCodeInput, order_value: totalPrice });
      setAppliedPromo(response.data);
    } catch (error) { alert("❌ Lỗi mã khuyến mãi!"); setAppliedPromo(null); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!pickupCoords || !dropoffCoords) { setIsError(true); setMessage("⚠️ Vui lòng chọn điểm lấy và giao hàng!"); return; }
    
    setIsSubmitting(true); setMessage('Đang lên đơn...'); setIsError(false);
    try {
      const token = userInfo.access_token;
      const getAddrText = (addr, coords) => addr || `${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`;
      
      const pickupRes = await axios.post(`https://datquang-backend.onrender.com/users/${userInfo.user_id}/addresses`, { label: "Điểm lấy", latitude: pickupCoords.lat, longitude: pickupCoords.lng, address_text: getAddrText(pickupAddress, pickupCoords) }, { headers: { Authorization: `Bearer ${token}` } });
      const dropoffRes = await axios.post(`https://datquang-backend.onrender.com/users/${userInfo.user_id}/addresses`, { label: "Điểm giao", latitude: dropoffCoords.lat, longitude: dropoffCoords.lng, address_text: getAddrText(dropoffAddress, dropoffCoords) }, { headers: { Authorization: `Bearer ${token}` } });
      
      const extraFeesData = { bulky_fee: isBulky ? 20000 : 0, door_delivery_fee: isDoorDelivery ? 10000 : 0, tip: parseInt(tipAmount) || 0 };
      const finalDetails = `[${serviceType === 'express' ? '🛵 XE MÁY' : serviceType === 'truck' ? '🚚 XE TẢI' : '🚛 CONTAINER'}] ${packageDetails}`;
      
      await axios.post('https://datquang-backend.onrender.com/orders', {
        customer_id: userInfo.user_id, pickup_address_id: pickupRes.data.id, dropoff_address_id: dropoffRes.data.id,
        promo_id: appliedPromo ? appliedPromo.promo_id : null, discount_amount: appliedPromo ? appliedPromo.discount_amount : 0,                           
        package_details: finalDetails, original_price: basePrice, total_price: Math.max(0, totalPrice - (appliedPromo?.discount_amount || 0)),
        extra_fees: JSON.stringify(extraFeesData), payment_method: paymentMethod, cod_amount: hasCod ? (parseInt(codAmount) || 0) : 0,
        sender_name: senderName, sender_phone: senderPhone, receiver_name: receiverName, receiver_phone: receiverPhone
      }, { headers: { Authorization: `Bearer ${token}` } });

      setIsError(false); setMessage('🎉 Gọi tài xế thành công!');
      setTimeout(() => navigate('/dashboard'), 1500);
    } catch (error) { setIsError(true); setMessage("❌ Không thể xử lý đơn hàng lúc này."); } 
    finally { setIsSubmitting(false); }
  };

  const finalTotalPrice = Math.max(0, totalPrice - (appliedPromo ? appliedPromo.discount_amount : 0));

  return (
    <Container fluid className="py-4" style={{ backgroundColor: 'var(--bg-main)', minHeight: '100vh' }}>
      <Container style={{ maxWidth: '1200px' }}>
        
        {/* THANH ĐIỀU HƯỚNG TRÊN CÙNG GIỐNG ẢNH */}
        <div className="d-flex align-items-center mb-5 pb-3 border-bottom" style={{ borderColor: 'var(--border-color)' }}>
          <div className="d-flex align-items-center me-5">
            <div className="bg-primary text-white rounded me-2 d-flex align-items-center justify-content-center" style={{ width:'40px', height:'40px', backgroundColor: 'var(--brand-orange) !important' }}>🚚</div>
            <h4 className="mb-0 fw-bold text-white">VẬN CHỞ</h4>
          </div>
          <div className="d-flex gap-4">
             <div className="text-white fw-bold" style={{ borderBottom: '2px solid var(--brand-orange)', paddingBottom: '4px', cursor:'pointer' }}>Điều phối</div>
             <div className="text-muted fw-bold" style={{ cursor:'pointer' }} onClick={() => navigate('/dashboard')}>Theo dõi đơn</div>
          </div>
        </div>

        {message && <Alert variant={isError ? "danger" : "success"} className="logistics-card border-0 fw-bold">{message}</Alert>}

        <Row className="g-5">
          {/* ============================================== */}
          {/* CỘT TRÁI: FORM ĐẶT HÀNG (DỰA THEO ẢNH MẪU)   */}
          {/* ============================================== */}
          <Col lg={6}>
            <p className="text-muted mb-1" style={{fontSize:'14px'}}>Đặt vận chuyển</p>
            <h3 className="text-white fw-bold mb-4">Chọn phương tiện</h3>

            <Form onSubmit={handleSubmit}>
              
              {/* 1. LIST CARD CHỌN XE */}
              <div className="d-flex flex-column gap-3 mb-4">
                <div className={`vehicle-card ${serviceType === 'express' ? 'active' : ''}`} onClick={() => setServiceType('express')}>
                  <div className="d-flex align-items-center">
                    <span className="fs-3 me-3 v-icon text-muted">🛵</span>
                    <div>
                      <h6 className="mb-0 fw-bold text-white">Xe máy giao nhanh</h6>
                      <small className="text-muted">Nội thành • Dưới 20kg</small>
                    </div>
                  </div>
                  <div className="fw-bold v-price text-muted">{basePrice > 0 && serviceType==='express' ? `${basePrice.toLocaleString()}đ` : 'Từ 16.000đ'}</div>
                </div>

                <div className={`vehicle-card ${serviceType === 'truck' ? 'active' : ''}`} onClick={() => setServiceType('truck')}>
                  <div className="d-flex align-items-center">
                    <span className="fs-3 me-3 v-icon text-muted">🚚</span>
                    <div>
                      <h6 className="mb-0 fw-bold text-white">Xe tải nhẹ 1.5 tấn</h6>
                      <small className="text-muted">Liên quận • Hàng hóa lớn</small>
                    </div>
                  </div>
                  <div className="fw-bold v-price text-muted">{basePrice > 0 && serviceType==='truck' ? `${basePrice.toLocaleString()}đ` : 'Từ 150.000đ'}</div>
                </div>

                <div className={`vehicle-card ${serviceType === 'container' ? 'active' : ''}`} onClick={() => setServiceType('container')}>
                  <div className="d-flex align-items-center">
                    <span className="fs-3 me-3 v-icon text-muted">🚛</span>
                    <div>
                      <h6 className="mb-0 fw-bold text-white">Container 20ft/40ft</h6>
                      <small className="text-muted">Liên cảng • Hàng xuất nhập</small>
                    </div>
                  </div>
                  <div className="fw-bold v-price text-muted">{basePrice > 0 && serviceType==='container' ? `${basePrice.toLocaleString()}đ` : 'Báo giá'}</div>
                </div>
              </div>

              {/* 2. ĐỊA CHỈ LẤY GIAO NẰM NGANG */}
              <Row className="g-3 mb-4">
                <Col md={6}>
                  <div className="logistics-card p-3 h-100">
                    <small className="text-muted d-block mb-2">📍 Điểm lấy hàng</small>
                    <AddressSearchInput 
                      placeholder="Nhập địa chỉ..." value={pickupAddress} 
                      onChange={(val) => { setPickupAddress(val); setPickupCoords(null); }} 
                      onSelectLocation={(c) => { setPickupCoords(c); setDropoffCoords(null); setDropoffAddress(''); }} 
                      userLocation={userLocation} customClass="logistics-input border-0 px-0"
                    />
                  </div>
                </Col>
                <Col md={6}>
                  <div className="logistics-card p-3 h-100">
                    <small className="text-muted d-block mb-2" style={{color: 'var(--brand-orange) !important'}}>🚩 Điểm giao hàng</small>
                    {serviceType === 'container' ? (
                      <Form.Select className="logistics-input border-0 px-0 fw-bold" value={dropoffAddress} onChange={(e) => {
                          const port = PORT_LIST.find(p => p.name === e.target.value);
                          if (port) { setDropoffAddress(port.name); setDropoffCoords({ lat: port.lat, lng: port.lng }); }
                        }}>
                        <option value="">-- Chọn Cảng --</option>
                        {PORT_LIST.map((p, i) => <option key={i} value={p.name}>{p.name}</option>)}
                      </Form.Select>
                    ) : (
                      <AddressSearchInput 
                        placeholder="Nhập địa chỉ..." value={dropoffAddress} 
                        onChange={(val) => { setDropoffAddress(val); setDropoffCoords(null); }} 
                        onSelectLocation={setDropoffCoords} userLocation={userLocation} customClass="logistics-input border-0 px-0"
                      />
                    )}
                  </div>
                </Col>
              </Row>

              {/* 3. THÔNG TIN LIÊN HỆ GỌN GÀNG */}
              <div className="logistics-card p-3 mb-4">
                 <Row className="g-2">
                   <Col md={6}><Form.Control className="logistics-input" placeholder="Tên người gửi" value={senderName} onChange={e=>setSenderName(e.target.value)} required/></Col>
                   <Col md={6}><Form.Control className="logistics-input" placeholder="SĐT người gửi" value={senderPhone} onChange={e=>setSenderPhone(e.target.value)} required/></Col>
                   <Col md={6}><Form.Control className="logistics-input mt-2" placeholder="Tên người nhận" value={receiverName} onChange={e=>setReceiverName(e.target.value)} required/></Col>
                   <Col md={6}><Form.Control className="logistics-input mt-2" placeholder="SĐT người nhận" value={receiverPhone} onChange={e=>setReceiverPhone(e.target.value)} required/></Col>
                 </Row>
                 <Form.Control as="textarea" rows={2} className="logistics-input mt-3" placeholder="Ghi chú chi tiết hàng hóa..." value={packageDetails} onChange={e=>setPackageDetails(e.target.value)} required/>
              </div>

              {/* 4. DỊCH VỤ THÊM & THANH TOÁN */}
              <Row className="g-3 mb-4">
                 <Col md={6}>
                   <div className="logistics-card p-3 h-100">
                     <h6 className="text-white mb-3">Dịch vụ phụ</h6>
                     {serviceType === 'express' && <Form.Check type="checkbox" label="Cồng kềnh (+20K)" className="text-muted mb-2" checked={isBulky} onChange={e=>setIsBulky(e.target.checked)} />}
                     <Form.Check type="checkbox" label="Tận cửa (+10K)" className="text-muted mb-3" checked={isDoorDelivery} onChange={e=>setIsDoorDelivery(e.target.checked)} />
                     <Form.Control type="number" className="logistics-input" placeholder="Tiền tip cho tài xế (VNĐ)" value={tipAmount} onChange={e=>setTipAmount(e.target.value)} />
                   </div>
                 </Col>
                 <Col md={6}>
                   <div className="logistics-card p-3 h-100">
                     <h6 className="text-white mb-3">Thanh toán</h6>
                     <Form.Select value={paymentMethod} onChange={e=>setPaymentMethod(e.target.value)} className="logistics-input mb-3">
                        <option value="cash">Tiền mặt</option>
                        <option value="bank">Ví nền tảng</option>
                     </Form.Select>
                     <Form.Check type="checkbox" label="Thu hộ COD" className="text-white mb-2" checked={hasCod} onChange={e=>{setHasCod(e.target.checked); setCodAmount('');}} />
                     {hasCod && <Form.Control type="number" className="logistics-input" placeholder="Tiền thu hộ..." value={codAmount} onChange={e=>setCodAmount(e.target.value)} />}
                   </div>
                 </Col>
              </Row>

              <Button type="submit" className="btn-orange w-100 py-3 fs-5" disabled={!pickupCoords || !dropoffCoords || isSubmitting}>
                {isSubmitting ? 'ĐANG TÌM TÀI XẾ...' : 'TÌM TÀI XẾ/XE NGAY'}
              </Button>
            </Form>
          </Col>

          {/* ============================================== */}
          {/* CỘT PHẢI: BẢN ĐỒ DARK MODE VÀ HÀNH TRÌNH TẠM   */}
          {/* ============================================== */}
          <Col lg={6} className="border-start ps-lg-5" style={{ borderColor: 'var(--border-color) !important' }}>
             <div className="d-flex justify-content-between align-items-end mb-4">
                <div>
                   <p className="text-muted mb-1" style={{fontSize:'14px'}}>Theo dõi bản đồ</p>
                   <h3 className="text-white fw-bold mb-0">Lộ trình dự kiến</h3>
                </div>
                <h4 className="text-primary fw-bold mb-0">{finalTotalPrice.toLocaleString()}đ</h4>
             </div>

             {/* MAP WRAPPER CÓ CSS FILTER MÀU ĐEN */}
             <div className="logistics-card p-2 mb-4 dark-map-container" style={{ height: '350px', overflow: 'hidden' }}>
                <BookingMap 
                    pickupCoords={pickupCoords} setPickupCoords={setPickupCoords} 
                    dropoffCoords={dropoffCoords} setDropoffCoords={setDropoffCoords} 
                    setDropoffAddress={setDropoffAddress} reverseGeocode={reverseGeocode} 
                    routePolyline={routePolyline} 
                />
             </div>

             <h6 className="text-muted fw-bold mb-3">Chi tiết cước phí</h6>
             <div className="logistics-card p-3">
                <div className="d-flex justify-content-between text-muted mb-2"><span>Quãng đường ({distance} km)</span><span className="text-white">{basePrice.toLocaleString()}đ</span></div>
                {isBulky && <div className="d-flex justify-content-between text-muted mb-2"><span>Phí cồng kềnh</span><span className="text-white">20.000đ</span></div>}
                {isDoorDelivery && <div className="d-flex justify-content-between text-muted mb-2"><span>Phí giao tận cửa</span><span className="text-white">10.000đ</span></div>}
                {(parseInt(tipAmount)>0) && <div className="d-flex justify-content-between text-muted mb-2"><span>Tiền tip bồi dưỡng</span><span className="text-white">{parseInt(tipAmount).toLocaleString()}đ</span></div>}
                
                <div className="d-flex mt-3 gap-2">
                   <Form.Control type="text" className="logistics-input flex-grow-1" placeholder="Mã giảm giá..." value={promoCodeInput} onChange={e=>setPromoCodeInput(e.target.value.toUpperCase())}/>
                   <Button variant="outline-light" className="fw-bold" style={{borderColor:'var(--border-color)', color:'var(--text-muted)'}} onClick={handleApplyPromo}>ÁP DỤNG</Button>
                </div>
                {appliedPromo && <div className="text-success mt-2 fs-6">Đã giảm {appliedPromo.discount_amount.toLocaleString()}đ</div>}
             </div>
          </Col>

        </Row>
      </Container>
    </Container>
  );
}