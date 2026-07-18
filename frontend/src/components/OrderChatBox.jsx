import React, { useState, useEffect, useRef } from 'react';
import { Badge, Form, InputGroup, Button } from 'react-bootstrap';
import axios from 'axios';

export default function OrderChatBox({ orderId, userInfo, isChatDisabled, isBatchClosed, messages, fetchMessages }) {
  const [chatInput, setChatInput] = useState('');
  const messagesEndRef = useRef(null);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    try {
      await axios.post(`https://datquang-backend.onrender.com/orders/${orderId}/messages`, { sender_id: userInfo.user_id, content: chatInput });
      setChatInput(''); 
      fetchMessages();
    } catch (error) { console.error("Lỗi gửi tin nhắn", error); }
  };

  return (
    <div className="logistics-card d-flex flex-column h-100 overflow-hidden" style={{ maxHeight: '750px' }}>
      <div className="p-4 border-bottom d-flex justify-content-between align-items-center" style={{ borderColor: 'var(--border-color)', backgroundColor: 'rgba(255,255,255,0.02)' }}>
        <h5 className="mb-0 fw-bold text-white d-flex align-items-center gap-2">
          <span className="fs-4">💬</span> Kênh Liên Lạc
        </h5>
        <Badge bg={isBatchClosed ? "dark" : "success"} className={`border px-3 py-2 ${isBatchClosed ? 'border-secondary' : 'border-success'}`}>
          {isBatchClosed ? "Đã đóng" : "Online"}
        </Badge>
      </div>
      
      <div className="p-4 flex-grow-1" style={{ overflowY: 'auto', backgroundColor: 'var(--bg-main)' }}>
          {messages.length === 0 && (
            <div className="text-center text-muted fw-bold mt-5">
              <div className="fs-1 mb-3">👋</div>
              Hãy gửi lời chào để bắt đầu cuộc trò chuyện!
            </div>
          )}
          {messages.map((msg) => {
            const isMyMessage = msg.sender_id === userInfo.user_id;
            return (
              <div key={msg.id} className={`d-flex mb-3 ${isMyMessage ? 'justify-content-end' : 'justify-content-start'}`}>
                <div className={`p-3 fw-bold ${isMyMessage ? 'text-white' : 'text-white border'}`} 
                     style={{ 
                       maxWidth: '80%', 
                       backgroundColor: isMyMessage ? 'var(--brand-orange)' : 'var(--bg-card)',
                       borderColor: isMyMessage ? 'transparent' : 'var(--border-color)',
                       borderTopLeftRadius: '15px',
                       borderTopRightRadius: '15px',
                       borderBottomLeftRadius: isMyMessage ? '15px' : '4px',
                       borderBottomRightRadius: isMyMessage ? '4px' : '15px'
                     }}>
                  {msg.content}
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
      </div>
      
      <div className="p-3 border-top" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-card)' }}>
        <Form onSubmit={handleSendMessage}>
          <InputGroup>
            <Form.Control 
              type="text" 
              className="logistics-input fw-bold px-3 py-2"
              placeholder={isBatchClosed ? "🔒 Kênh chat đã đóng." : "Nhập tin nhắn..."} 
              value={chatInput} 
              onChange={(e) => setChatInput(e.target.value)} 
              disabled={isChatDisabled} 
              style={{ borderRadius: '12px 0 0 12px' }}
            />
            <Button type="submit" className="btn-orange px-4 fw-bold" disabled={isChatDisabled} style={{ borderRadius: '0 12px 12px 0' }}>Gửi</Button>
          </InputGroup>
        </Form>
      </div>
    </div>
  );
}