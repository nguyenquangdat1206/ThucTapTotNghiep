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
    const ws = new WebSocket(`wss://datquang-backend.onrender.com/ws/${userInfo.user_id}/${userInfo.role}`);
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
        <div onClick={() => setIsOpen(true)} className="position-fixed text-white rounded-circle d-flex justify-content-center align-items-center" style={{ bottom: '30px', right: '30px', width: '60px', height: '60px', cursor: 'pointer', zIndex: 9999, backgroundColor: 'var(--brand-orange)', boxShadow: '0 0 20px rgba(255, 102, 51, 0.5)' }}>
          <h3 className="mb-0">💬</h3>
        </div>
      )}

      {isOpen && (
        <Card className="position-fixed shadow-lg border-0 logistics-card" style={{ bottom: '20px', right: '20px', width: '350px', height: '500px', zIndex: 9999, display: 'flex', flexDirection: 'column', border: '1px solid var(--brand-orange) !important', overflow: 'hidden' }}>
          <Card.Header className="text-white d-flex justify-content-between align-items-center border-bottom" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
            <h6 className="mb-0 fw-bold d-flex align-items-center gap-2"><span className="fs-5">🎧</span> CSKH Trực Tuyến</h6>
            <Button variant="link" className="text-muted p-0 text-decoration-none fs-5" onClick={() => setIsOpen(false)}>✖</Button>
          </Card.Header>
          <Card.Body style={{ overflowY: 'auto', flex: 1, backgroundColor: 'var(--bg-main)' }}>
            <div className="text-center text-muted fw-bold mb-4" style={{ fontSize: '0.8rem' }}>Hệ thống hỗ trợ 24/7</div>
            {messages.map((msg, idx) => {
              const isMe = msg.sender_type === 'user';
              const isBot = msg.sender_type === 'bot';
              return (
                <div key={idx} className={`d-flex mb-3 ${isMe ? 'justify-content-end' : 'justify-content-start'}`}>
                  <div className={`p-3 fw-bold ${isMe ? 'text-white' : 'text-white border'}`} 
                       style={{ 
                         maxWidth: '85%', fontSize: '0.9rem',
                         backgroundColor: isMe ? 'var(--brand-orange)' : 'var(--bg-card)',
                         borderColor: isMe ? 'transparent' : 'var(--border-color)',
                         borderTopLeftRadius: '15px', borderTopRightRadius: '15px',
                         borderBottomLeftRadius: isMe ? '15px' : '4px', borderBottomRightRadius: isMe ? '4px' : '15px'
                       }}>
                    {!isMe && !isBot && <strong className="d-block mb-1" style={{fontSize: '11px', color: '#4ADE80'}}>👑 ADMIN ĐẠT QUANG</strong>}
                    {msg.content}
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </Card.Body>
          <Card.Footer className="p-3 border-top" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
            <Form onSubmit={handleSend}>
              <InputGroup>
                <Form.Control type="text" className="logistics-input fw-bold px-3 py-2" placeholder="Nhập câu hỏi..." value={inputText} onChange={e => setInputText(e.target.value)} style={{ borderRadius: '12px 0 0 12px' }} />
                <Button type="submit" className="btn-orange fw-bold px-3" style={{ borderRadius: '0 12px 12px 0' }}>Gửi</Button>
              </InputGroup>
            </Form>
          </Card.Footer>
        </Card>
      )}
    </>
  );
}