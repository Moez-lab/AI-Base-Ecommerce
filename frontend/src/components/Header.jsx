import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, ShoppingBag, User, Heart, Mic, Sparkles } from 'lucide-react';
import { useCart } from '../context/CartContext';

const Header = () => {
    const { cartCount } = useCart();
    const navigate = useNavigate();
    const [searchQuery, setSearchQuery] = useState('');

    const handleSearch = (e) => {
        if (e.key === 'Enter' && searchQuery.trim()) {
            navigate(`/shop?q=${encodeURIComponent(searchQuery)}`);
        }
    };

    return (
        <nav className="navbar">
            <div className="nav-container">
                {/* Logo */}
                <Link to="/" className="logo">
                    <Sparkles className="logo-icon" size={24} />
                    <span className="logo-text">ShopAI</span>
                </Link>

                {/* Search Bar */}
                <div className="search-bar">
                    <Search className="search-icon" size={18} />
                    <input
                        type="text"
                        placeholder="Ask AI or search products..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={handleSearch}
                    />
                    <Mic className="mic-icon" size={18} />
                </div>

                {/* Navigation Links */}
                <div className="nav-links">
                    <Link to="/shop?cat=fashion">Categories</Link>
                    <Link to="/shop?filter=deals">Deals</Link>
                    <Link to="/shop?sort=new">New Arrivals</Link>
                </div>

                {/* Icons */}
                <div className="nav-icons">
                    <button className="icon-btn">
                        <Heart size={20} />
                    </button>
                    <button className="icon-btn">
                        <User size={20} />
                    </button>
                    <Link to="/cart" className="icon-btn cart-btn">
                        <ShoppingBag size={20} />
                        {cartCount > 0 && <span className="badge">{cartCount}</span>}
                    </Link>
                </div>
            </div>
        </nav>
    );
};

export default Header;
