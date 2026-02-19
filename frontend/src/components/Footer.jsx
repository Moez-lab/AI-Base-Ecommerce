import React from 'react';
import { Instagram, Twitter, Globe } from 'lucide-react';

const Footer = () => {
    return (
        <footer className="footer">
            <div className="footer-content">
                <div className="footer-col">
                    <h3>✨ ShopAI</h3>
                    <p>Redefining the shopping experience with artificial intelligence. Personalized, efficient, and tailored just for you.</p>
                    <div className="socials">
                        <span title="Website"><Globe size={20} /></span>
                        <span title="Instagram"><Instagram size={20} /></span>
                        <span title="Twitter"><Twitter size={20} /></span>
                    </div>
                </div>
                <div className="footer-col">
                    <h4>Shop</h4>
                    <a href="#">New Arrivals</a>
                    <a href="#">Best Sellers</a>
                    <a href="#">Gift Cards</a>
                    <a href="#">Sale</a>
                </div>
                <div className="footer-col">
                    <h4>Support</h4>
                    <a href="#">Help Center</a>
                    <a href="#">Returns</a>
                    <a href="#">Shipping Info</a>
                </div>
            </div>
            <div className="footer-bottom">
                <p>© 2026 ShopAI Inc. All rights reserved.</p>
            </div>
        </footer>
    );
};

export default Footer;
