import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Bot, Sparkles, ShoppingCart } from 'lucide-react';
import { Link } from 'react-router-dom';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import parse from 'html-react-parser';
import { useCart } from '../context/CartContext';

const ChatWidget = ({ userId, sessionId }) => {
    const { addToCart } = useCart();
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState([
        { type: 'bot', text: "Hi! I'm your shopping assistant. Looking for something specific today?" }
    ]);
    const [inputText, setInputText] = useState('');
    const [isTooltipVisible, setIsTooltipVisible] = useState(true);
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const toggleChat = () => {
        setIsOpen(!isOpen);
        if (!isOpen) {
            setIsTooltipVisible(false);
        }
    };

    const closeTooltip = (e) => {
        e.stopPropagation();
        setIsTooltipVisible(false);
    };

    const sendMessage = async (text = inputText) => {
        if (!text.trim()) return;

        // Add user message
        const newMessages = [...messages, { type: 'user', text }];
        setMessages(newMessages);
        setInputText('');
        setIsLoading(true);

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-user-id': userId,
                    'x-session-id': sessionId
                },
                body: JSON.stringify({ message: text })
            });
            const data = await response.json();

            setMessages(prev => [
                ...prev,
                { type: 'bot', text: data.response, products: data.products }
            ]);

        } catch (error) {
            setMessages(prev => [...prev, { type: 'bot', text: "Sorry, I encountered an error. Please try again." }]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyPress = (e) => {
        if (e.key === 'Enter') sendMessage();
    };

    return (
        <div className="chat-widget">
            {/* Chat Window */}
            <div className={`chat-window ${isOpen ? '' : 'hidden'}`}>
                <div className="chat-header">
                    <div className="chat-header-info">
                        <span className="bot-avatar">
                            <Bot size={20} color="#2563eb" />
                        </span>
                        <div>
                            <h4>ShopAI Assistant</h4>
                            <span className="status">Online</span>
                        </div>
                    </div>
                    <button className="close-chat" onClick={toggleChat}>
                        <X size={20} />
                    </button>
                </div>

                <div className="chat-messages">
                    {messages.map((msg, idx) => (
                        <div key={idx} className={`message ${msg.type}-message`}>
                            <div className="message-content">
                                <div className="markdown-content">
                                    {msg.type === 'bot' ? parse(DOMPurify.sanitize(marked.parse(msg.text || ''))) : msg.text}
                                </div>
                                {msg.products && msg.products.length > 0 && (
                                    <div className="chat-products-container">
                                        {msg.products.map(product => (
                                            <div key={product.id || product.productId} className="chat-product-card">
                                                <Link to={`/product/${product.id || product.productId}`} className="product-link" style={{ textDecoration: 'none', color: 'inherit', display: 'flex', gap: '12px', alignItems: 'center' }}>
                                                    <img
                                                        src={product.imageUrl}
                                                        alt={product.name}
                                                        className="chat-product-img"
                                                        onError={(e) => e.target.src = 'https://via.placeholder.com/100'}
                                                    />
                                                    <div className="chat-product-details">
                                                        <h5>{product.name}</h5>
                                                        <span className="price">${Number(product.price).toFixed(2)}</span>
                                                        <button
                                                            className="chat-add-btn"
                                                            onClick={(e) => {
                                                                e.preventDefault();
                                                                e.stopPropagation();
                                                                addToCart(product);
                                                            }}
                                                        >
                                                            <ShoppingCart size={14} /> Add
                                                        </button>
                                                    </div>
                                                </Link>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                    {isLoading && (
                        <div className="message bot-message">
                            <div className="message-content">
                                <span className="spinner"></span>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />

                    {messages.length === 1 && (
                        <div className="suggestions">
                            <button className="suggestion-chip" onClick={() => sendMessage('Best laptops?')}>
                                <Sparkles size={12} /> Best Laptops
                            </button>
                            <button className="suggestion-chip" onClick={() => sendMessage('Summer fashion')}>
                                <Sparkles size={12} /> Summer Fashion
                            </button>
                        </div>
                    )}
                </div>

                <div className="chat-input-area">
                    <div className="input-wrapper">
                        <input
                            value={inputText}
                            onChange={(e) => setInputText(e.target.value)}
                            onKeyDown={handleKeyPress}
                            placeholder="Ask anything..."
                        />
                        <button id="sendButton" onClick={() => sendMessage()} disabled={!inputText.trim()}>
                            <Send size={16} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Launcher */}
            <div className="chat-launcher" onClick={toggleChat}>
                {isTooltipVisible && !isOpen && (
                    <div className="launcher-tooltip">
                        <span className="tooltip-icon">
                            <Bot size={24} color="#2563eb" />
                        </span>
                        <div className="tooltip-text">
                            <strong>Hi! I'm your shopping assistant.</strong><br />
                            Looking for something specific today?
                        </div>
                        <button className="tooltip-close" onClick={closeTooltip}>
                            <X size={14} />
                        </button>
                    </div>
                )}
                <div className="launcher-btn">
                    <MessageCircle size={32} color="white" />
                </div>
            </div>
        </div>
    );
};

export default ChatWidget;
