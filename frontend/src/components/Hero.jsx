import React from 'react';
import { ArrowRight, Sparkles, PlayCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

const Hero = () => {
    return (
        <section className="hero">
            <div className="hero-content">
                <div className="ai-tag">
                    <Sparkles size={16} /> AI-Powered Personal Shopper
                </div>
                <h1>We Know What You Like</h1>
                <p className="hero-desc">Experience the future of shopping. Our AI analyzes your taste to recommend products you'll actually love, saving you time and money.</p>

                <div className="hero-buttons">
                    <Link to="/shop?filter=trending" className="btn-primary">
                        Shop Trending
                    </Link>
                    <button className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <PlayCircle size={20} /> How it works
                    </button>
                </div>
            </div>

            <div className="hero-image-container">
                <div className="hero-bg-shape"></div>
                <img
                    src="https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?q=80&w=1000&auto=format&fit=crop"
                    alt="Fashion Model"
                    className="hero-img"
                />

                <div className="ai-match-card">
                    <img
                        src="https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?q=80&w=200&auto=format&fit=crop"
                        alt="Dress"
                        className="match-thumb"
                    />
                    <div className="match-info">
                        <span className="match-score">AI MATCH: 98%</span>
                        <span className="match-title">Floral Summer Dress</span>
                        <span className="match-price">$129.00</span>
                    </div>
                    <button className="match-arrow">
                        <ArrowRight size={16} />
                    </button>
                </div>
            </div>
        </section>
    );
};

export default Hero;
