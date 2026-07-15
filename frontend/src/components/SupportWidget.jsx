import React, { useState, useEffect, useRef } from 'react';
import { Card, Button, Form, InputGroup } from 'react-bootstrap';
import axios from 'axios';

export default function SupportWidget({ userInfo }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef(null);

  const fetchMessages = async () => {
    try {
      const res = await axios.get(`https://datquang-backend.onrender.com/support/${userInfo.user_id}/messages`);
      setMessages(res.data);
    } catch (error) { console.error(error); }
  };

  useEffect(() => { if (isOpen) fetchMessages(); }, [isOpen]);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, isOpen]);

  useEffect(() => {
    const ws = new WebSocket(`wss://datquang.onrender.com/ws/${userInfo.user_id}/${userInfo.role}`);
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.event === 'new_support_msg' && isOpen) fetchMessages();
    };
    return () => ws.close();
  }, [isOpen, userInfo]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    try {
      await axios.post('https://datquang-backend.onrender.com/support/messages', { user_id: userInfo.user_id, sender_type: "user", content: inputText });
      setInputText(''); fetchMessages();
    } catch (error) {}
  };

  return (
    <>
      {!isOpen && (
        <div onClick={() => setIsOpen(true)} className="position-fixed bg-primary text-white rounded-circle d-flex justify-content-center align-items-center shadow-lg" style={{ bottom: '30px', right: '30px', width: '60px', height: '60px', cursor: 'pointer', zIndex: 9999 }}>
          <h3 className="mb-0">💬</h3>
        </div>
      )}

      {isOpen && (
        <Card className="position-fixed shadow-lg border-primary border-2" style={{ bottom: '20px', right: '20px', width: '350px', height: '500px', zIndex: 9999, display: 'flex', flexDirection: 'column' }}>
          <Card.Header className="bg-primary text-white d-flex justify-content-between align-items-center">
            <h6 className="mb-0 fw-bold">🎧 Trung Tâm Hỗ Trợ CSKH</h6>
            <Button variant="link" className="text-white p-0 text-decoration-none fs-5" onClick={() => setIsOpen(false)}>✖</Button>
          </Card.Header>
          <Card.Body className="bg-light" style={{ overflowY: 'auto', flex: 1 }}>
            <div className="text-center text-muted mb-3" style={{ fontSize: '0.8rem' }}>Hệ thống Chatbot tự động 24/7</div>
            {messages.map((msg, idx) => {
              const isMe = msg.sender_type === 'user';
              const isBot = msg.sender_type === 'bot';
              return (
                <div key={idx} className={`d-flex mb-2 ${isMe ? 'justify-content-end' : 'justify-content-start'}`}>
                  <div className={`p-2 rounded-3 shadow-sm ${isMe ? 'bg-primary text-white' : isBot ? 'bg-white border text-dark' : 'bg-danger text-white'}`} style={{ maxWidth: '85%', fontSize: '0.9rem' }}>
                    {!isMe && !isBot && <strong className="d-block" style={{fontSize: '11px'}}>👑 ADMIN</strong>}
                    {msg.content}
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </Card.Body>
          <Card.Footer className="bg-white p-2 border-top">
            <Form onSubmit={handleSend}>
              <InputGroup>
                <Form.Control type="text" placeholder="Nhập câu hỏi (rút tiền, hủy đơn...)" value={inputText} onChange={e => setInputText(e.target.value)} />
                <Button variant="primary" type="submit">Gửi</Button>
              </InputGroup>
            </Form>
          </Card.Footer>
        </Card>
      )}
    </>
  );
}