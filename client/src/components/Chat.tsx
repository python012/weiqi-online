// 聊天组件
import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage } from '../types';
import './Chat.css';

interface ChatProps {
  messages: ChatMessage[];
  onSendMessage: (content: string) => void;
  disabled?: boolean;
}

const Chat: React.FC<ChatProps> = ({ messages, onSendMessage, disabled = false }) => {
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    const content = inputValue.trim();
    if (content) {
      onSendMessage(content);
      setInputValue('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="chat-container">
      <div className="chat-messages">
        {messages.map((msg) => (
          <div key={msg.id} className="chat-message">
            <span className="chat-nickname">{msg.senderNickname}:</span>
            <span className="chat-content">{msg.content}</span>
            <span className="chat-time">{formatTime(msg.timestamp)}</span>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      <div className="chat-input-area">
        <input
          type="text"
          className="chat-input"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder={disabled ? '聊天已关闭' : '输入消息...'}
          disabled={disabled}
        />
        <button 
          className="chat-send-btn" 
          onClick={handleSend}
          disabled={disabled || !inputValue.trim()}
        >
          发送
        </button>
      </div>
    </div>
  );
};

export default Chat;
