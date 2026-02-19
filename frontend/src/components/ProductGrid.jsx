import React from 'react';
import { ShoppingCart } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useCart } from '../context/CartContext';

const ProductGrid = ({ title, subtitle, products }) => {
    const { addToCart } = useCart();

    return (
        <section className="product-section">
            <div className="section-header">
                <div>
                    <h2>{title}</h2>
                    {subtitle && <p>{subtitle}</p>}
                </div>
                <a href="/shop" className="view-all">View all →</a>
            </div>

            <div className="products-grid">
                {products.map((product) => (
                    <div key={product.id || product.productId} className="product-card">
                        <Link to={`/product/${product.id || product.productId}`} className="product-link" style={{ textDecoration: 'none', color: 'inherit' }}>
                            <div className="card-badge">{Math.floor(Math.random() * 10) + 90}% Match</div>
                            <div className="img-container">
                                <img
                                    src={product.imageUrl}
                                    alt={product.name}
                                    onError={(e) => e.target.src = 'https://via.placeholder.com/300'}
                                />
                            </div>
                            <div className="card-details">
                                <h3>{product.name}</h3>
                                <p>{product.description ? product.description.substring(0, 50) + '...' : ''}</p>
                                <div className="card-footer">
                                    <span className="price">${Number(product.price).toFixed(2)}</span>
                                    {/* Prevent navigation when clicking 'Add to Cart' */}
                                    <button
                                        className="add-btn"
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            addToCart(product);
                                        }}
                                        title="Add to Cart"
                                    >
                                        <ShoppingCart size={18} />
                                    </button>
                                </div>
                            </div>
                        </Link>
                    </div>
                ))}
            </div>
        </section>
    );
};

export default ProductGrid;
