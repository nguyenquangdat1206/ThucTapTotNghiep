import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, Polyline, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix lỗi icon của Leaflet trong React
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

function MapClickHandler({ pickupCoords, setPickupCoords, dropoffCoords, setDropoffCoords, setDropoffAddress, reverseGeocode }) {
  useMapEvents({
    click(e) {
      if (!pickupCoords) { 
        setPickupCoords(e.latlng); 
        reverseGeocode(e.latlng.lat, e.latlng.lng, 'pickup'); 
      }
      else if (!dropoffCoords) { 
        setDropoffCoords(e.latlng); 
        reverseGeocode(e.latlng.lat, e.latlng.lng, 'dropoff'); 
      }
      else { 
        setPickupCoords(e.latlng); 
        setDropoffCoords(null); 
        setDropoffAddress(''); 
        reverseGeocode(e.latlng.lat, e.latlng.lng, 'pickup'); 
      }
    },
  });
  return null;
}

function MapUpdater({ pickupCoords, dropoffCoords }) {
  const map = useMap();
  useEffect(() => {
    if (pickupCoords && dropoffCoords) { map.fitBounds(L.latLngBounds([pickupCoords, dropoffCoords]), { padding: [50, 50] }); } 
    else if (pickupCoords) { map.flyTo(pickupCoords, 15); } 
    else if (dropoffCoords) { map.flyTo(dropoffCoords, 15); }
  }, [pickupCoords, dropoffCoords, map]);
  return null;
}

export default function BookingMap({ pickupCoords, setPickupCoords, dropoffCoords, setDropoffCoords, setDropoffAddress, reverseGeocode, routePolyline }) {
  return (
    <div style={{ height: '700px', width: '100%', borderRadius: '8px', overflow: 'hidden', border: '2px solid #dee2e6', position: 'relative' }}>
      <MapContainer center={[10.7626, 106.6601]} zoom={13} style={{ height: '100%', width: '100%' }}>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        
        <MapClickHandler 
          pickupCoords={pickupCoords} setPickupCoords={setPickupCoords} 
          dropoffCoords={dropoffCoords} setDropoffCoords={setDropoffCoords} 
          setDropoffAddress={setDropoffAddress} reverseGeocode={reverseGeocode} 
        />
        <MapUpdater pickupCoords={pickupCoords} dropoffCoords={dropoffCoords} />
        
        {pickupCoords && <Marker position={pickupCoords}><Popup>📍 Lấy hàng</Popup></Marker>}
        {dropoffCoords && <Marker position={dropoffCoords}><Popup>🚩 Giao hàng</Popup></Marker>}
        {routePolyline.length > 0 && <Polyline positions={routePolyline} color="#0d6efd" weight={5} opacity={0.7} dashArray="10, 10" />}
      </MapContainer>
      
      <div style={{ position: 'absolute', top: 10, right: 10, zIndex: 1000, backgroundColor: 'rgba(255,255,255,0.95)', padding: '10px 15px', borderRadius: '6px', border: '1px solid #ccc', fontSize: '13px' }}>
        <strong>💡 Mẹo Thao Tác:</strong><br/>1. Gõ địa chỉ vào ô bên trái để tìm kiếm.<br/>2. Hoặc <strong>Click trực tiếp</strong> lên bản đồ.
      </div>
    </div>
  );
}