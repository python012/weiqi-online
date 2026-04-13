// 聊天组件
import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage } from '../types';
import './Chat.css';

interface ChatProps {
  messages: ChatMessage[];
  onSendMessage: (content: string) => void;
  disabled?: boolean;
  currentPlayerId?: string;
}

const Chat: React.FC<ChatProps> = ({ messages, onSendMessage, disabled = false, currentPlayerId }) => {
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

  // 判断是否为当前用户发送的消息
  const isCurrentUser = (msg: ChatMessage) => {
    return currentPlayerId && msg.senderId === currentPlayerId;
  };

  return (
    <div className="chat-container">
      <div className="chat-messages">
        {messages.map((msg) => (
          <div key={msg.id} className={`chat-message ${msg.senderId === 'system' ? 'system-message' : ''}`}>
            {msg.senderId === 'system' ? (
              // 系统消息：[系统] + 内容 + 时间戳
              <div className="system-msg-inner">
                <span className="system-tag">[系统]</span>
                <span className="system-content">{msg.content}</span>
                <span className="chat-time">{formatTime(msg.timestamp)}</span>
              </div>
            ) : (
              // 用户消息：[我] 或 [昵称] + 内容 + 时间戳
              <>
                <span className="chat-nickname">
                  {isCurrentUser(msg) ? '[我]' : `[${msg.senderNickname}]`}
                </span>
                <span className="chat-content">{msg.content}</span>
                <span className="chat-time">{formatTime(msg.timestamp)}</span>
              </>
            )}
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
