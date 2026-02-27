import React, { useState, useEffect, useRef } from 'react';
import {
  ComposedModal,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  TextInput,
  FileUploader,
  InlineLoading,
} from '@carbon/react';
import { Bot, Send } from '@carbon/icons-react';
import api from '../services/api.js';

const WELCOME = 'Hi! Upload a receipt image or PDF and I\'ll extract the expense details for you automatically.';

export default function OCRAssistantModal({ open, onClose, onExtracted }) {
  const [messages, setMessages] = useState([{ role: 'assistant', content: WELCOME }]);
  const [uploading, setUploading] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Reset chat when modal reopens
  useEffect(() => {
    if (open) {
      setMessages([{ role: 'assistant', content: WELCOME }]);
      setChatInput('');
    }
  }, [open]);

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const file = files[0];
    setUploading(true);
    setMessages(prev => [...prev, { role: 'user', content: `Uploading: ${file.name}` }]);
    try {
      const formData = new FormData();
      formData.append('receipt', file);
      const res = await api.post('/expenses/ocr', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const data = res.data;

      if (data.requiresManualInput) {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: 'I couldn\'t read this receipt clearly (low confidence). Please enter the details manually.',
        }]);
      } else {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: `I found the following details:\n\n**Vendor:** ${data.vendor || 'Unknown'}\n**Amount:** RM ${Number(data.amount || 0).toFixed(2)}\n**Date:** ${data.date || 'Unknown'}\n\nClick "Use These Details" to create the expense.`,
        }]);
        onExtracted?.(data);
      }
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Sorry, I couldn\'t process that receipt. Please try again or enter the details manually.',
      }]);
    } finally {
      setUploading(false);
    }
  };

  const handleSend = async () => {
    if (!chatInput.trim()) return;
    const userMsg = chatInput;
    setChatInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    try {
      const res = await api.post('/expenses/chat', { message: userMsg, history: messages });
      setMessages(prev => [...prev, { role: 'assistant', content: res.data.response }]);
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Sorry, I\'m having trouble responding right now.',
      }]);
    }
  };

  return (
    <ComposedModal open={open} onClose={onClose} size="sm">
      <ModalHeader>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Bot size={20} />
          <span>AI Receipt Assistant</span>
        </div>
      </ModalHeader>
      <ModalBody>
        {/* Chat messages */}
        <div style={{
          height: '320px',
          overflowY: 'auto',
          border: '1px solid #e0e0e0',
          borderRadius: '4px',
          padding: '1rem',
          background: '#fafafa',
          marginBottom: '1rem',
        }}>
          {messages.map((msg, idx) => (
            <div key={idx} style={{
              marginBottom: '0.75rem',
              display: 'flex',
              justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
            }}>
              <div style={{
                maxWidth: '85%',
                padding: '0.5rem 0.75rem',
                borderRadius: '8px',
                background: msg.role === 'user' ? '#0f62fe' : '#e0e0e0',
                color: msg.role === 'user' ? '#fff' : '#161616',
                fontSize: '0.875rem',
                whiteSpace: 'pre-wrap',
              }}>
                {msg.content}
              </div>
            </div>
          ))}
          {uploading && (
            <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
              <InlineLoading description="Processing receipt..." />
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* File upload */}
        <div style={{ marginBottom: '1rem' }}>
          <FileUploader
            labelTitle=""
            labelDescription="Upload receipt (image or PDF)"
            buttonLabel="Upload Receipt"
            accept={['.jpg', '.jpeg', '.png', '.pdf']}
            size="sm"
            onChange={handleFileUpload}
          />
        </div>

        {/* Chat input */}
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <TextInput
            id="ocr-chat-input"
            labelText=""
            hideLabel
            value={chatInput}
            onChange={e => setChatInput(e.target.value)}
            placeholder="Ask about expenses..."
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            style={{ flex: 1 }}
          />
          <Button size="sm" renderIcon={Send} iconDescription="Send" hasIconOnly onClick={handleSend} />
        </div>
      </ModalBody>
      <ModalFooter>
        <Button kind="secondary" onClick={onClose}>Close</Button>
      </ModalFooter>
    </ComposedModal>
  );
}
