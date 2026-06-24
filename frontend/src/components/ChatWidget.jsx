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
        { type: 'bot', text: "Hi! I'm ShopAI, your shopping assistant. How can I help you today?" }
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

    const handleQuickAction = async (actionType, label) => {
        // Add user choice message to conversation
        const newMessages = [...messages, { type: 'user', text: label }];
        setMessages(newMessages);
        setIsLoading(true);

        try {
            const apiUrl = import.meta.env.VITE_API_URL || '';
            
            if (actionType === 'deals') {
                const response = await fetch(`${apiUrl}/api/recommendations/trending`);
                if (!response.ok) throw new Error();
                const data = await response.json();
                const products = data.recommendations || [];

                setMessages(prev => [...prev, {
                    type: 'bot',
                    text: products.length > 0 
                        ? "Check out our hottest trending items right now! 🔥" 
                        : "I couldn't retrieve the latest deals at the moment. Try searching for specific items!",
                    products: products.slice(0, 3)
                }]);
            } else if (actionType === 'picks') {
                const response = await fetch(`${apiUrl}/api/recommendations/personalized/${userId || 'guest'}`);
                if (!response.ok) throw new Error();
                const data = await response.json();
                const products = data.recommendations || [];

                setMessages(prev => [...prev, {
                    type: 'bot',
                    text: products.length > 0 
                        ? "Here are some personalized picks just for you! ✨" 
                        : "Here are some popular products from our catalog you might like! ✨",
                    products: products.length > 0 ? products.slice(0, 3) : []
                }]);

                if (products.length === 0) {
                    const allRes = await fetch(`${apiUrl}/api/products`);
                    if (allRes.ok) {
                        const allProd = await allRes.json();
                        setMessages(prev => {
                            const updated = [...prev];
                            updated[updated.length - 1].products = allProd.slice(0, 3);
                            return updated;
                        });
                    }
                }
            } else if (actionType === 'search') {
                setMessages(prev => [...prev, {
                    type: 'bot',
                    text: "Select a category to browse:",
                    isCategoryMenu: true
                }]);
            } else if (actionType === 'category') {
                const response = await fetch(`${apiUrl}/api/products/search/${encodeURIComponent(label)}`);
                if (!response.ok) throw new Error();
                const data = await response.json();
                const products = data.results || [];

                setMessages(prev => [...prev, {
                    type: 'bot',
                    text: `Here are the top matches in **${label}**:`,
                    products: products.slice(0, 3)
                }]);
            } else if (actionType === 'support') {
                setMessages(prev => [...prev, {
                    type: 'bot',
                    text: `### 📋 ShopAI Help & FAQs\n\n` +
                          `🚚 **Shipping Policy**:\n` +
                          `- Free standard shipping on orders over $50.\n` +
                          `- Orders are processed within 1-2 business days.\n\n` +
                          `↩️ **Returns & Exchanges**:\n` +
                          `- Easy returns within 30 days of purchase.\n` +
                          `- Items must be in original condition.\n\n` +
                          `💬 **Customer Support**:\n` +
                          `- Email: support@shopai.com\n` +
                          `- Hours: Mon-Fri 9 AM - 6 PM EST`
                }]);
            }
        } catch (err) {
            setMessages(prev => [...prev, { type: 'bot', text: "Sorry, I had trouble retrieving that information. Please try typing your search query in the chat!" }]);
        } finally {
            setIsLoading(false);
        }
    };

    const sendMessage = async (text = inputText) => {
        if (!text.trim()) return;

        const newMessages = [...messages, { type: 'user', text }];
        setMessages(newMessages);
        setInputText('');
        setIsLoading(true);

        try {
            const apiUrl = import.meta.env.VITE_API_URL || '';
            const response = await fetch(`${apiUrl}/api/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-user-id': userId,
                    'x-session-id': sessionId
                },
                body: JSON.stringify({ message: text })
            });

            if (!response.ok) throw new Error('Network error');

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            // Add a blank streaming bot message
            const botMsgIndex = newMessages.length;
            setMessages(prev => [...prev, { type: 'bot', text: '', products: [] }]);
            setIsLoading(false);

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop(); // keep incomplete line in buffer

                for (const line of lines) {
                    if (!line.startsWith('data: ')) continue;
                    const json = line.slice(6).trim();
                    if (!json) continue;
                    const event = JSON.parse(json);

                    if (event.type === 'products') {
                        setMessages(prev => prev.map((m, i) =>
                            i === botMsgIndex ? { ...m, products: event.products } : m
                        ));
                    } else if (event.type === 'token') {
                        setMessages(prev => prev.map((m, i) =>
                            i === botMsgIndex ? { ...m, text: m.text + event.content } : m
                        ));
                    } else if (event.type === 'error') {
                        setMessages(prev => prev.map((m, i) =>
                            i === botMsgIndex ? { ...m, text: 'Sorry, something went wrong.' } : m
                        ));
                    }
                    // 'done' event — stream finished, nothing extra needed
                }
            }

        } catch (error) {
            setIsLoading(false);
            setMessages(prev => [...prev, { type: 'bot', text: "Sorry, I encountered an error. Please try again." }]);
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

                                {msg.isCategoryMenu && (
                                    <div className="category-menu">
                                        <button onClick={() => handleQuickAction('category', 'Electronics')} className="suggestion-chip">💻 Electronics</button>
                                        <button onClick={() => handleQuickAction('category', 'Fashion')} className="suggestion-chip">👕 Fashion</button>
                                        <button onClick={() => handleQuickAction('category', 'Home')} className="suggestion-chip">🏡 Home</button>
                                        <button onClick={() => handleQuickAction('category', 'Sports')} className="suggestion-chip">⚽ Sports</button>
                                    </div>
                                )}
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
