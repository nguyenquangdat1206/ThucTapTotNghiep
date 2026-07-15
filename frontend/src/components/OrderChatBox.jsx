import React, { useState, useEffect, useRef } from 'react';
import { Card, Badge, Form, InputGroup, Button } from 'react-bootstrap';
import axios from 'axios';

export default function OrderChatBox({ orderId, userInfo, isChatDisabled, isBatchClosed, messages, fetchMessages }) {
  const [chatInput, setChatInput] = useState('');
  const messagesEndRef = useRef(null);

  // Tự động cuộn xuống tin nhắn mới nhất
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
    <Card className="shadow-sm border-0 h-100" style={{ maxHeight: '750px' }}>
      <Card.Header className={`text-white d-flex justify-content-between align-items-center py-3 ${isBatchClosed ? 'bg-secondary' : 'bg-dark'}`}>
        <h5 className="mb-0">💬 Kênh Chat Trực Tiếp</h5>
        <Badge bg={isBatchClosed ? "dark" : "success"} pill className={isBatchClosed ? "" : "animate-pulse"}>{isBatchClosed ? "Đã đóng" : "Online"}</Badge>
      </Card.Header>
      <Card.Body className="bg-light" style={{ overflowY: 'auto' }}>
          {messages.map((msg) => {
            const isMyMessage = msg.sender_id === userInfo.user_id;
            return (
              <div key={msg.id} className={`d-flex mb-3 ${isMyMessage ? 'justify-content-end' : 'justify-content-start'}`}>
                <div className={`p-3 rounded-3 shadow-sm ${isMyMessage ? 'bg-primary text-white' : 'bg-white border text-dark'}`} style={{ maxWidth: '80%' }}>{msg.content}</div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
      </Card.Body>
      <Card.Footer className="bg-white p-3">
        <Form onSubmit={handleSendMessage}>
          <InputGroup>
            <Form.Control type="text" placeholder={isBatchClosed ? "🔒 Kênh chat đã đóng." : "Nhập tin nhắn..."} value={chatInput} onChange={(e) => setChatInput(e.target.value)} disabled={isChatDisabled} />
            <Button variant="primary" type="submit" disabled={isChatDisabled}>Gửi</Button>
          </InputGroup>
        </Form>
      </Card.Footer>
    </Card>
  );
}