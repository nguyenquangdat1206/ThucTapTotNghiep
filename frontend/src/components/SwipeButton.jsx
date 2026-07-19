import React, { useState, useEffect, useRef } from 'react';

export default function SwipeButton({ text, colorClass, onComplete, isLoading }) {
  const [isDragging, setIsDragging] = useState(false);
  const [left, setLeft] = useState(0);
  const sliderRef = useRef(null);

  const handleDown = () => { if (!isLoading) setIsDragging(true); };

  const handleMove = (e) => {
    if (!isDragging || isLoading || !sliderRef.current) return;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const rect = sliderRef.current.getBoundingClientRect();
    let newLeft = clientX - rect.left - 25; 
    const maxLeft = rect.width - 50; 
    
    if (newLeft < 0) newLeft = 0;
    if (newLeft > maxLeft) newLeft = maxLeft;
    setLeft(newLeft);
  };

  const handleUp = () => {
    if (!isDragging || isLoading || !sliderRef.current) return;
    setIsDragging(false);
    const maxLeft = sliderRef.current.getBoundingClientRect().width - 50;
    
    if (left > maxLeft * 0.8) {
      setLeft(maxLeft);
      onComplete();
    } else { setLeft(0); }
  };

  useEffect(() => { if (!isLoading) setLeft(0); }, [isLoading]);

  return (
    <div ref={sliderRef} className={`position-relative rounded-pill border mt-3`} style={{ height: '54px', touchAction: 'none', userSelect: 'none', overflow: 'hidden', backgroundColor: 'var(--bg-input)', borderColor: 'var(--border-color) !important' }} onMouseMove={handleMove} onMouseUp={handleUp} onMouseLeave={handleUp} onTouchMove={handleMove} onTouchEnd={handleUp}>
      <div className={`position-absolute h-100 bg-${colorClass}`} style={{ width: `${left + 25}px`, opacity: 0.15, transition: isDragging ? 'none' : 'width 0.3s' }} />
      <div className="position-absolute w-100 h-100 d-flex justify-content-center align-items-center fw-bold" style={{ color: 'var(--text-muted)', zIndex: 1, fontSize: '14px', letterSpacing: '0.5px' }}>
         <span style={{ opacity: left > 20 ? 1 - left/(sliderRef.current?.getBoundingClientRect().width || 1) : 1 }}>{text}</span>
      </div>
      <div className={`position-absolute h-100 rounded-pill d-flex justify-content-center align-items-center bg-${colorClass} text-white fw-bold shadow-lg`} style={{ width: '54px', left: `${left}px`, transition: isDragging ? 'none' : 'left 0.3s', zIndex: 2, cursor: isLoading ? 'default' : 'grab' }} onMouseDown={handleDown} onTouchStart={handleDown}>
        {isLoading ? <span className="spinner-border spinner-border-sm" /> : '>>>'}
      </div>
    </div>
  );
}