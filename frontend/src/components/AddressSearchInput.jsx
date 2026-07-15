import React, { useState, useEffect, useRef } from 'react';
import { Form, ListGroup, Placeholder } from 'react-bootstrap';

// Hàm tính khoảng cách đường chim bay
const calculateStraightDistance = (lat1, lon1, lat2, lon2) => {
  if (!lat1 || !lon1 || !lat2 || !lon2) return null;
  const R = 6371; 
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return (R * c).toFixed(2); 
};

export default function AddressSearchInput({ label, placeholder, value, onChange, onSelectLocation, badgeColor, userLocation }) {
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const wrapperRef = useRef(null);
  const searchTimeoutRef = useRef(null);

  const handleInputChange = (e) => {
    const text = e.target.value;
    onChange(text); 
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    if (text.length < 2) { setResults([]); setShowDropdown(false); return; }

    searchTimeoutRef.current = setTimeout(async () => {
      setIsLoading(true); setShowDropdown(true);
      try {
        const searchQuery = text.toLowerCase().includes('hồ chí minh') || text.toLowerCase().includes('hcm') 
                            ? text : `${text}, Hồ Chí Minh`;
        const res = await fetch(`https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates?f=json&singleLine=${encodeURIComponent(searchQuery)}&maxLocations=5`);
        const data = await res.json();
        setResults(data.candidates || []);
      } catch (error) { console.error(error); } 
      finally { setIsLoading(false); }
    }, 600);
  };

  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) setShowDropdown(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (item) => {
    onChange(item.address);
    onSelectLocation({ lat: item.location.y, lng: item.location.x });
    setShowDropdown(false);
  };

  return (
    <Form.Group className="mb-3 position-relative" ref={wrapperRef}>
      <Form.Label className={`fw-bold text-${badgeColor}`}>{label}</Form.Label>
      <Form.Control type="text" placeholder={placeholder} value={value} onChange={handleInputChange} onFocus={() => { if (results.length > 0) setShowDropdown(true); }} />
      {showDropdown && (
        <ListGroup className="position-absolute w-100 shadow-lg mt-1" style={{ zIndex: 1050, maxHeight: '250px', overflowY: 'auto' }}>
          {isLoading ? (
            <><ListGroup.Item><Placeholder animation="glow"><Placeholder xs={7}/></Placeholder></ListGroup.Item><ListGroup.Item><Placeholder animation="glow"><Placeholder xs={5}/></Placeholder></ListGroup.Item></>
          ) : results.length > 0 ? (
            results.map((item, index) => {
              const splitAddress = item.address.split(',');
              const distKm = calculateStraightDistance(userLocation?.lat, userLocation?.lng, item.location.y, item.location.x);
              
              return (
                <ListGroup.Item action key={index} onClick={() => handleSelect(item)} className="d-flex align-items-start py-2">
                  <span className="me-2 mt-1">📍</span>
                  <div className="flex-grow-1 overflow-hidden">
                    <div className="fw-bold text-truncate" style={{maxWidth: '280px'}}>{splitAddress[0]}</div>
                    <div style={{fontSize: '0.8rem'}} className="text-muted text-truncate">
                      {distKm && <span className="text-primary fw-bold me-1">{distKm}km •</span>}
                      {splitAddress.slice(1).join(',').trim() || "Thành phố Hồ Chí Minh"}
                    </div>
                  </div>
                </ListGroup.Item>
              )
            })
          ) : (<ListGroup.Item className="text-muted text-center py-3">Không tìm thấy địa điểm...</ListGroup.Item>)}
        </ListGroup>
      )}
    </Form.Group>
  );
}