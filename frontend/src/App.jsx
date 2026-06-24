import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import { CartProvider } from './context/CartContext';
import Header from './components/Header';
import Hero from './components/Hero';
import ProductGrid from './components/ProductGrid';
import ChatWidget from './components/ChatWidget';
import Footer from './components/Footer';
import ProductDetails from './pages/ProductDetails';

// Pages
const Home = () => {
    const [products, setProducts] = useState([]);
    const navigate = useNavigate();

    useEffect(() => {
        const apiUrl = import.meta.env.VITE_API_URL || '';
        fetch(`${apiUrl}/api/products`)
            .then(res => res.json())
            .then(data => setProducts(data))
            .catch(err => console.error('Failed to fetch products', err));
    }, []);

    return (
        <main className="main-container">
            <Hero />

            {/* Categories */}
            <section className="categories">
                {['All', 'Fashion', 'Electronics', 'Home', 'Beauty', 'Sports'].map((cat) => (
                    <button 
                        key={cat} 
                        className={`cat-pill ${cat === 'All' ? 'active' : ''}`}
                        onClick={() => {
                            if (cat === 'All') {
                                navigate('/shop');
                            } else {
                                navigate(`/shop?cat=${cat.toLowerCase()}`);
                            }
                        }}
                    >
                        {cat}
                    </button>
                ))}
            </section>

            {/* AI Picks */}
            <ProductGrid
                title="AI Picks for You"
                subtitle="Based on your browsing history and style preferences."
                products={products.slice(0, 4)}
            />

            {/* Lifestyle Section */}
            <section className="lifestyle-section">
                <h2>Shop by Lifestyle</h2>
                <div className="lifestyle-grid">
                    <div className="lifestyle-card">
                        <img src="https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?q=80&w=800&auto=format&fit=crop" alt="Modern Home" />
                        <div className="lifestyle-overlay">
                            <span className="tag">Curated Collection</span>
                            <h3>Modern Home</h3>
                            <a href="#">Explore →</a>
                        </div>
                    </div>
                    <div className="lifestyle-card">
                        <img src="https://images.unsplash.com/photo-1517836357463-d25dfeac3438?q=80&w=800&auto=format&fit=crop" alt="Active Lifestyle" />
                        <div className="lifestyle-overlay">
                            <h3>Active Lifestyle</h3>
                            <p>View Products</p>
                        </div>
                    </div>
                </div>
            </section>
        </main>
    );
};

import Shop from './pages/Shop';

// Placeholder Cart Page
const Cart = () => (
    <main className="main-container" style={{ paddingTop: '40px' }}>
        <h2>Your Cart</h2>
        <p>Cart items will go here...</p>
    </main>
);

function App() {
    const [userId, setUserId] = useState(localStorage.getItem('userId'));
    const [sessionId, setSessionId] = useState(sessionStorage.getItem('sessionId'));

    // Initialize Session
    useEffect(() => {
        async function initSession() {
            if (!userId || !sessionId) {
                const mockUser = 'user_' + Date.now();
                const mockSession = 'session_' + Date.now();
                setUserId(mockUser);
                setSessionId(mockSession);
                localStorage.setItem('userId', mockUser);
                sessionStorage.setItem('sessionId', mockSession);
            }
        }
        initSession();
    }, [userId, sessionId]);

    return (
        <div className="app-container">
            <CartProvider>
                <Router>
                    <Toaster position="top-center" richColors />
                    <Header />

                    <Routes>
                        <Route path="/" element={<Home />} />
                        <Route path="/shop" element={<Shop />} />
                        <Route path="/product/:id" element={<ProductDetails />} />
                        <Route path="/cart" element={<Cart />} />
                    </Routes>

                    <Footer />
                    <ChatWidget userId={userId} sessionId={sessionId} />
                </Router>
            </CartProvider>
        </div>
    );
}

export default App;
