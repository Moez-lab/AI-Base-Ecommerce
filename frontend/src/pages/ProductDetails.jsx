import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ShoppingBag, ArrowLeft, Star, Share2 } from 'lucide-react';
import { useCart } from '../context/CartContext';

const ProductDetails = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { addToCart } = useCart();
    const [product, setProduct] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        fetch(`/api/products/${id}`)
            .then(res => {
                if (!res.ok) throw new Error('Product not found');
                return res.json();
            })
            .then(data => {
                setProduct(data);
                setLoading(false);
            })
            .catch(err => {
                setError(err.message);
                setLoading(false);
            });
    }, [id]);

    if (loading) return <div className="loading-state">Loading...</div>;
    if (error) return <div className="error-state">Product not found. <button onClick={() => navigate('/shop')}>Go Back</button></div>;

    return (
        <main className="main-container product-details-page">
            <button onClick={() => navigate(-1)} className="back-btn">
                <ArrowLeft size={20} /> Back
            </button>

            <div className="product-details-grid">
                {/* Product Image */}
                <div className="product-image-section">
                    <div className="main-image-container">
                        <img
                            src={product.imageUrl}
                            alt={product.name}
                            onError={(e) => e.target.src = 'https://via.placeholder.com/600'}
                        />
                    </div>
                </div>

                {/* Product Info */}
                <div className="product-info-section">
                    <div className="product-header">
                        <span className="product-category">{product.category}</span>
                        <h1>{product.name}</h1>
                        <div className="product-rating">
                            <Star size={16} fill="#fbbf24" stroke="#fbbf24" />
                            <Star size={16} fill="#fbbf24" stroke="#fbbf24" />
                            <Star size={16} fill="#fbbf24" stroke="#fbbf24" />
                            <Star size={16} fill="#fbbf24" stroke="#fbbf24" />
                            <Star size={16} fill="#fbbf24" stroke="#fbbf24" />
                            <span className="review-count">(128 reviews)</span>
                        </div>
                    </div>

                    <div className="product-price">
                        ${Number(product.price).toFixed(2)}
                    </div>

                    <p className="product-description">
                        {product.description}
                    </p>

                    <div className="product-actions">
                        <button
                            className="add-to-cart-btn"
                            onClick={() => addToCart(product)}
                        >
                            <ShoppingBag size={20} /> Add to Cart
                        </button>
                        <button className="share-btn">
                            <Share2 size={20} />
                        </button>
                    </div>

                    <div className="product-meta">
                        <p><strong>Stock:</strong> {product.stock > 0 ? 'In Stock' : 'Out of Stock'}</p>
                        <p><strong>SKU:</strong> {product.id.toString().padStart(6, '0')}</p>
                    </div>
                </div>
            </div>
        </main>
    );
};

export default ProductDetails;
