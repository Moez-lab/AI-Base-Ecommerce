-- Data Warehouse Schema for Recommendation System
-- Star Schema Design with Fact and Dimension Tables

-- ============================================
-- DIMENSION TABLES
-- ============================================

-- Dimension: Users
CREATE TABLE IF NOT EXISTS dim_users (
    user_id VARCHAR(255) PRIMARY KEY,
    session_id VARCHAR(255),
    first_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    total_sessions INTEGER DEFAULT 1,
    total_interactions INTEGER DEFAULT 0,
    total_purchases INTEGER DEFAULT 0,
    total_spent DECIMAL(10, 2) DEFAULT 0.00,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_dim_users_last_seen ON dim_users(last_seen_at);
CREATE INDEX idx_dim_users_session ON dim_users(session_id);

-- Dimension: Products
CREATE TABLE IF NOT EXISTS dim_products (
    product_id INTEGER PRIMARY KEY,
    product_name VARCHAR(500),
    category VARCHAR(255),
    price DECIMAL(10, 2),
    stock INTEGER,
    total_views INTEGER DEFAULT 0,
    total_clicks INTEGER DEFAULT 0,
    total_purchases INTEGER DEFAULT 0,
    conversion_rate DECIMAL(5, 4) DEFAULT 0.0000,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_dim_products_category ON dim_products(category);
CREATE INDEX idx_dim_products_views ON dim_products(total_views DESC);
CREATE INDEX idx_dim_products_conversion ON dim_products(conversion_rate DESC);

-- Dimension: Time
CREATE TABLE IF NOT EXISTS dim_time (
    time_id SERIAL PRIMARY KEY,
    timestamp TIMESTAMP NOT NULL,
    hour INTEGER,
    day INTEGER,
    week INTEGER,
    month INTEGER,
    year INTEGER,
    day_of_week INTEGER,
    is_weekend BOOLEAN,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_dim_time_timestamp ON dim_time(timestamp);
CREATE INDEX idx_dim_time_date ON dim_time(year, month, day);

-- ============================================
-- FACT TABLES
-- ============================================

-- Fact: User Interactions
CREATE TABLE IF NOT EXISTS fact_user_interactions (
    interaction_id SERIAL PRIMARY KEY,
    event_id VARCHAR(255) UNIQUE NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    session_id VARCHAR(255) NOT NULL,
    product_id INTEGER NOT NULL,
    event_type VARCHAR(50) NOT NULL,
    timestamp TIMESTAMP NOT NULL,
    time_id INTEGER,
    
    -- Event metadata
    source VARCHAR(100),
    position INTEGER,
    query TEXT,
    
    -- Denormalized product info for faster queries
    product_name VARCHAR(500),
    product_price DECIMAL(10, 2),
    category VARCHAR(255),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES dim_users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES dim_products(product_id) ON DELETE CASCADE,
    FOREIGN KEY (time_id) REFERENCES dim_time(time_id) ON DELETE SET NULL
);

CREATE INDEX idx_fact_interactions_user ON fact_user_interactions(user_id);
CREATE INDEX idx_fact_interactions_product ON fact_user_interactions(product_id);
CREATE INDEX idx_fact_interactions_session ON fact_user_interactions(session_id);
CREATE INDEX idx_fact_interactions_timestamp ON fact_user_interactions(timestamp DESC);
CREATE INDEX idx_fact_interactions_event_type ON fact_user_interactions(event_type);
CREATE INDEX idx_fact_interactions_category ON fact_user_interactions(category);

-- Fact: Purchases
CREATE TABLE IF NOT EXISTS fact_purchases (
    purchase_id SERIAL PRIMARY KEY,
    event_id VARCHAR(255) UNIQUE NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    session_id VARCHAR(255) NOT NULL,
    timestamp TIMESTAMP NOT NULL,
    time_id INTEGER,
    
    total_amount DECIMAL(10, 2) NOT NULL,
    payment_method VARCHAR(100),
    num_items INTEGER,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES dim_users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (time_id) REFERENCES dim_time(time_id) ON DELETE SET NULL
);

CREATE INDEX idx_fact_purchases_user ON fact_purchases(user_id);
CREATE INDEX idx_fact_purchases_timestamp ON fact_purchases(timestamp DESC);

-- Fact: Purchase Items (many-to-many with purchases)
CREATE TABLE IF NOT EXISTS fact_purchase_items (
    purchase_item_id SERIAL PRIMARY KEY,
    purchase_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    
    FOREIGN KEY (purchase_id) REFERENCES fact_purchases(purchase_id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES dim_products(product_id) ON DELETE CASCADE
);

CREATE INDEX idx_fact_purchase_items_purchase ON fact_purchase_items(purchase_id);
CREATE INDEX idx_fact_purchase_items_product ON fact_purchase_items(product_id);

-- ============================================
-- MATERIALIZED VIEWS FOR ANALYTICS
-- ============================================

-- Trending Products (last 24 hours)
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_trending_products_24h AS
SELECT 
    p.product_id,
    p.product_name,
    p.category,
    p.price,
    COUNT(DISTINCT i.user_id) as unique_viewers,
    COUNT(*) as total_views,
    SUM(CASE WHEN i.event_type = 'product.click' THEN 1 ELSE 0 END) as total_clicks,
    SUM(CASE WHEN i.event_type = 'product.add_to_cart' THEN 1 ELSE 0 END) as total_add_to_cart,
    CAST(SUM(CASE WHEN i.event_type = 'product.click' THEN 1 ELSE 0 END) AS FLOAT) / 
        NULLIF(COUNT(*), 0) as click_through_rate,
    MAX(i.timestamp) as last_interaction
FROM dim_products p
LEFT JOIN fact_user_interactions i ON p.product_id = i.product_id
WHERE i.timestamp >= NOW() - INTERVAL '24 hours'
GROUP BY p.product_id, p.product_name, p.category, p.price
ORDER BY total_views DESC, unique_viewers DESC
LIMIT 100;

CREATE INDEX idx_mv_trending_24h_views ON mv_trending_products_24h(total_views DESC);

-- User Product Affinity (for collaborative filtering)
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_user_product_affinity AS
SELECT 
    user_id,
    product_id,
    COUNT(*) as interaction_count,
    MAX(timestamp) as last_interaction,
    SUM(CASE WHEN event_type = 'product.view' THEN 1 ELSE 0 END) as views,
    SUM(CASE WHEN event_type = 'product.click' THEN 1 ELSE 0 END) as clicks,
    SUM(CASE WHEN event_type = 'product.add_to_cart' THEN 1 ELSE 0 END) as add_to_cart,
    -- Weighted score: view=1, click=2, add_to_cart=3
    SUM(CASE 
        WHEN event_type = 'product.view' THEN 1
        WHEN event_type = 'product.click' THEN 2
        WHEN event_type = 'product.add_to_cart' THEN 3
        ELSE 0
    END) as affinity_score
FROM fact_user_interactions
GROUP BY user_id, product_id;

CREATE INDEX idx_mv_affinity_user ON mv_user_product_affinity(user_id);
CREATE INDEX idx_mv_affinity_product ON mv_user_product_affinity(product_id);
CREATE INDEX idx_mv_affinity_score ON mv_user_product_affinity(affinity_score DESC);

-- Product Co-occurrence (frequently viewed together)
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_product_cooccurrence AS
SELECT 
    i1.product_id as product_a,
    i2.product_id as product_b,
    COUNT(DISTINCT i1.session_id) as cooccurrence_count,
    COUNT(DISTINCT i1.user_id) as unique_users
FROM fact_user_interactions i1
JOIN fact_user_interactions i2 
    ON i1.session_id = i2.session_id 
    AND i1.product_id < i2.product_id
WHERE i1.timestamp >= NOW() - INTERVAL '30 days'
GROUP BY i1.product_id, i2.product_id
HAVING COUNT(DISTINCT i1.session_id) >= 2
ORDER BY cooccurrence_count DESC;

CREATE INDEX idx_mv_cooccurrence_a ON mv_product_cooccurrence(product_a);
CREATE INDEX idx_mv_cooccurrence_b ON mv_product_cooccurrence(product_b);

-- ============================================
-- FUNCTIONS FOR REFRESHING MATERIALIZED VIEWS
-- ============================================

CREATE OR REPLACE FUNCTION refresh_trending_products()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_trending_products_24h;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION refresh_user_affinity()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_user_product_affinity;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION refresh_cooccurrence()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_product_cooccurrence;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- TRIGGERS FOR UPDATING DIMENSION TABLES
-- ============================================

-- Update dim_users on new interaction
CREATE OR REPLACE FUNCTION update_user_stats()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO dim_users (user_id, session_id, last_seen_at, total_interactions)
    VALUES (NEW.user_id, NEW.session_id, NEW.timestamp, 1)
    ON CONFLICT (user_id) DO UPDATE SET
        last_seen_at = NEW.timestamp,
        total_interactions = dim_users.total_interactions + 1,
        updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_user_stats
AFTER INSERT ON fact_user_interactions
FOR EACH ROW EXECUTE FUNCTION update_user_stats();

-- Update dim_products on new interaction
CREATE OR REPLACE FUNCTION update_product_stats()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE dim_products SET
        total_views = total_views + CASE WHEN NEW.event_type = 'product.view' THEN 1 ELSE 0 END,
        total_clicks = total_clicks + CASE WHEN NEW.event_type = 'product.click' THEN 1 ELSE 0 END,
        updated_at = CURRENT_TIMESTAMP
    WHERE product_id = NEW.product_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_product_stats
AFTER INSERT ON fact_user_interactions
FOR EACH ROW EXECUTE FUNCTION update_product_stats();

-- ============================================
-- INITIAL DATA POPULATION
-- ============================================

COMMENT ON TABLE dim_users IS 'Dimension table for user information and aggregated stats';
COMMENT ON TABLE dim_products IS 'Dimension table for product information and aggregated stats';
COMMENT ON TABLE dim_time IS 'Dimension table for time-based analysis';
COMMENT ON TABLE fact_user_interactions IS 'Fact table for all user-product interactions';
COMMENT ON TABLE fact_purchases IS 'Fact table for purchase transactions';
COMMENT ON TABLE mv_trending_products_24h IS 'Materialized view for trending products in last 24 hours';
COMMENT ON TABLE mv_user_product_affinity IS 'Materialized view for user-product affinity scores';
COMMENT ON TABLE mv_product_cooccurrence IS 'Materialized view for products frequently viewed together';
