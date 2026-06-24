import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import ProductGrid from '../components/ProductGrid';
import { Search, Filter, ArrowLeft } from 'lucide-react';

const Shop = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const query = searchParams.get('q');
    const category = searchParams.get('cat');
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchSource, setSearchSource] = useState(null); // 'vector' or 'keyword'

    useEffect(() => {
        setLoading(true);
        const apiUrl = import.meta.env.VITE_API_URL || '';
        let url = `${apiUrl}/api/products`;

        if (query) {
            url = `${apiUrl}/api/products/search/${encodeURIComponent(query)}`;
        }

        fetch(url)
            .then(res => res.json())
            .then(data => {
                // Handle different response structures for search vs list
                if (query) {
                    setProducts(data.results || []);
                    setSearchSource(data.source);
                } else {
                    let filtered = data;
                    if (category) {
                        filtered = data.filter(p => p.category.toLowerCase() === category.toLowerCase());
                    }
                    setProducts(filtered);
                    setSearchSource(null);
                }
                setLoading(false);
            })
            .catch(err => {
                console.error('Failed to fetch products', err);
                setLoading(false);
            });
    }, [query, category]);

    return (
        <main className="main-container" style={{ paddingTop: '80px' }}>
            <button onClick={() => navigate(-1)} className="back-btn">
                <ArrowLeft size={20} /> Back
            </button>
            <div className="shop-header">
                {query ? (
                    <div>
                        <h1>Results for "{query}"</h1>
                        {searchSource === 'vector' && (
                            <p className="ai-badge"><Sparkles size={14} /> AI Semantic Search Active</p>
                        )}
                        {searchSource === 'keyword' && (
                            <p className="keyword-badge">Keyword Search</p>
                        )}
                    </div>
                ) : (
                    <h1>{category ? `${category} Products` : 'All Products'}</h1>
                )}

                <p>{products.length} items found</p>
            </div>

            {loading ? (
                <div className="loading-grid">
                    {[1, 2, 3, 4].map(n => (
                        <div key={n} className="skeleton-card"></div>
                    ))}
                </div>
            ) : (
                <ProductGrid products={products} />
            )}

            {!loading && products.length === 0 && (
                <div className="no-results">
                    <Search size={48} className="text-gray-300" />
                    <h3>No products found</h3>
                    <p>Try checking your spelling or using different keywords.</p>
                </div>
            )}
        </main>
    );
};

// Simple Sparkles icon component if not imported
const Sparkles = ({ size = 24 }) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-purple-500 inline-block mr-1"
    >
        <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
    </svg>
);

export default Shop;
