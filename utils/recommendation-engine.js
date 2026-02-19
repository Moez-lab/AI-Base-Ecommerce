const { Pool } = require('pg');
const { createClient } = require('redis');
require('dotenv').config();

// PostgreSQL connection pool
const pool = new Pool({
    host: process.env.POSTGRES_HOST || 'localhost',
    port: process.env.POSTGRES_PORT || 5432,
    user: process.env.POSTGRES_USER || 'postgres',
    password: process.env.POSTGRES_PASSWORD || 'postgres',
    database: process.env.POSTGRES_DB || 'recommendations',
    max: 20,
});

// Redis client for caching
let redisClient = null;

async function getRedisClient() {
    if (!redisClient) {
        redisClient = createClient({
            socket: {
                host: process.env.REDIS_HOST || 'localhost',
                port: process.env.REDIS_PORT || 6379
            }
        });

        redisClient.on('error', (err) => console.error('Redis error:', err));
        await redisClient.connect();
    }
    return redisClient;
}

/**
 * Get personalized recommendations for a user
 * Uses collaborative filtering based on user interaction history
 * 
 * @param {string} userId - User ID
 * @param {number} limit - Number of recommendations to return
 * @returns {Promise<Array>} - Array of recommended product IDs with scores
 */
async function getPersonalizedRecommendations(userId, limit = 10) {
    try {
        // Check cache first
        const redis = await getRedisClient();
        const cacheKey = `recommendations:user:${userId}`;
        const cached = await redis.get(cacheKey);

        if (cached) {
            console.log(`✅ Cache hit for user ${userId}`);
            return JSON.parse(cached);
        }

        // Get user's interaction history
        const userHistory = await pool.query(`
      SELECT product_id, 
             SUM(CASE 
               WHEN event_type = 'product.view' THEN 1
               WHEN event_type = 'product.click' THEN 2
               WHEN event_type = 'product.add_to_cart' THEN 3
               ELSE 0
             END) as affinity_score
      FROM fact_user_interactions
      WHERE user_id = $1
      GROUP BY product_id
      ORDER BY affinity_score DESC
    `, [userId]);

        if (userHistory.rows.length === 0) {
            // New user - return trending products
            return await getTrendingProducts(limit);
        }

        // Find similar users (collaborative filtering)
        const similarUsers = await pool.query(`
      SELECT DISTINCT i2.user_id,
             COUNT(*) as common_products,
             SUM(CASE 
               WHEN i2.event_type = 'product.view' THEN 1
               WHEN i2.event_type = 'product.click' THEN 2
               WHEN i2.event_type = 'product.add_to_cart' THEN 3
               ELSE 0
             END) as similarity_score
      FROM fact_user_interactions i1
      JOIN fact_user_interactions i2 ON i1.product_id = i2.product_id
      WHERE i1.user_id = $1 
        AND i2.user_id != $1
      GROUP BY i2.user_id
      HAVING COUNT(*) >= 2
      ORDER BY similarity_score DESC, common_products DESC
      LIMIT 10
    `, [userId]);

        if (similarUsers.rows.length === 0) {
            // No similar users - return trending in user's preferred categories
            return await getCategoryBasedRecommendations(userId, limit);
        }

        // Get products that similar users liked but current user hasn't seen
        const viewedProducts = userHistory.rows.map(r => r.product_id);
        const similarUserIds = similarUsers.rows.map(r => r.user_id);

        const recommendations = await pool.query(`
      SELECT i.product_id,
             p.product_name,
             p.category,
             p.price,
             COUNT(DISTINCT i.user_id) as user_count,
             SUM(CASE 
               WHEN i.event_type = 'product.view' THEN 1
               WHEN i.event_type = 'product.click' THEN 2
               WHEN i.event_type = 'product.add_to_cart' THEN 3
               ELSE 0
             END) as recommendation_score
      FROM fact_user_interactions i
      JOIN dim_products p ON i.product_id = p.product_id
      WHERE i.user_id = ANY($1)
        AND i.product_id != ALL($2)
      GROUP BY i.product_id, p.product_name, p.category, p.price
      ORDER BY recommendation_score DESC, user_count DESC
      LIMIT $3
    `, [similarUserIds, viewedProducts, limit]);

        const result = recommendations.rows;

        // Cache for 1 hour
        await redis.setEx(cacheKey, 3600, JSON.stringify(result));

        return result;
    } catch (error) {
        console.error('Error getting personalized recommendations:', error);
        return await getTrendingProducts(limit);
    }
}

/**
 * Get products frequently viewed together (item-based collaborative filtering)
 * 
 * @param {number} productId - Product ID
 * @param {number} limit - Number of recommendations
 * @returns {Promise<Array>} - Array of related products
 */
async function getFrequentlyViewedTogether(productId, limit = 5) {
    try {
        const redis = await getRedisClient();
        const cacheKey = `recommendations:product:${productId}`;
        const cached = await redis.get(cacheKey);

        if (cached) {
            return JSON.parse(cached);
        }

        // Use materialized view for co-occurrence
        const result = await pool.query(`
      SELECT 
        CASE 
          WHEN product_a = $1 THEN product_b
          ELSE product_a
        END as product_id,
        p.product_name,
        p.category,
        p.price,
        cooccurrence_count,
        unique_users
      FROM mv_product_cooccurrence c
      JOIN dim_products p ON (
        CASE 
          WHEN c.product_a = $1 THEN c.product_b
          ELSE c.product_a
        END = p.product_id
      )
      WHERE product_a = $1 OR product_b = $1
      ORDER BY cooccurrence_count DESC, unique_users DESC
      LIMIT $2
    `, [productId, limit]);

        const recommendations = result.rows;

        // Cache for 6 hours
        await redis.setEx(cacheKey, 21600, JSON.stringify(recommendations));

        return recommendations;
    } catch (error) {
        console.error('Error getting frequently viewed together:', error);
        return [];
    }
}

/**
 * Get trending products
 * 
 * @param {number} limit - Number of products
 * @returns {Promise<Array>} - Array of trending products
 */
async function getTrendingProducts(limit = 10) {
    try {
        const redis = await getRedisClient();
        const cacheKey = 'recommendations:trending';
        const cached = await redis.get(cacheKey);

        if (cached) {
            return JSON.parse(cached);
        }

        const result = await pool.query(`
      SELECT product_id, product_name, category, price, 
             total_views, unique_viewers, total_clicks
      FROM mv_trending_products_24h
      LIMIT $1
    `, [limit]);

        const trending = result.rows;

        // Cache for 15 minutes
        await redis.setEx(cacheKey, 900, JSON.stringify(trending));

        return trending;
    } catch (error) {
        console.error('Error getting trending products:', error);
        return [];
    }
}

/**
 * Get category-based recommendations for users
 * 
 * @param {string} userId - User ID
 * @param {number} limit - Number of recommendations
 * @returns {Promise<Array>} - Array of products
 */
async function getCategoryBasedRecommendations(userId, limit = 10) {
    try {
        // Get user's preferred categories
        const categories = await pool.query(`
      SELECT category, COUNT(*) as interaction_count
      FROM fact_user_interactions
      WHERE user_id = $1
      GROUP BY category
      ORDER BY interaction_count DESC
      LIMIT 3
    `, [userId]);

        if (categories.rows.length === 0) {
            return await getTrendingProducts(limit);
        }

        const preferredCategories = categories.rows.map(r => r.category);

        // Get trending products in preferred categories
        const result = await pool.query(`
      SELECT DISTINCT p.product_id, p.product_name, p.category, p.price,
             p.total_views, p.total_clicks
      FROM dim_products p
      WHERE p.category = ANY($1)
        AND p.product_id NOT IN (
          SELECT product_id FROM fact_user_interactions WHERE user_id = $2
        )
      ORDER BY p.total_views DESC, p.total_clicks DESC
      LIMIT $3
    `, [preferredCategories, userId, limit]);

        return result.rows;
    } catch (error) {
        console.error('Error getting category-based recommendations:', error);
        return [];
    }
}

/**
 * Get similar products based on user behavior patterns
 * 
 * @param {number} productId - Product ID
 * @param {number} limit - Number of similar products
 * @returns {Promise<Array>} - Array of similar products
 */
async function getSimilarProducts(productId, limit = 5) {
    try {
        // Get users who interacted with this product
        const usersWhoLiked = await pool.query(`
      SELECT DISTINCT user_id
      FROM fact_user_interactions
      WHERE product_id = $1
    `, [productId]);

        if (usersWhoLiked.rows.length === 0) {
            return [];
        }

        const userIds = usersWhoLiked.rows.map(r => r.user_id);

        // Find products these users also liked
        const result = await pool.query(`
      SELECT i.product_id,
             p.product_name,
             p.category,
             p.price,
             COUNT(DISTINCT i.user_id) as common_users,
             SUM(CASE 
               WHEN i.event_type = 'product.view' THEN 1
               WHEN i.event_type = 'product.click' THEN 2
               WHEN i.event_type = 'product.add_to_cart' THEN 3
               ELSE 0
             END) as similarity_score
      FROM fact_user_interactions i
      JOIN dim_products p ON i.product_id = p.product_id
      WHERE i.user_id = ANY($1)
        AND i.product_id != $2
      GROUP BY i.product_id, p.product_name, p.category, p.price
      ORDER BY similarity_score DESC, common_users DESC
      LIMIT $3
    `, [userIds, productId, limit]);

        return result.rows;
    } catch (error) {
        console.error('Error getting similar products:', error);
        return [];
    }
}

/**
 * Refresh materialized views (should be run periodically)
 */
async function refreshMaterializedViews() {
    try {
        console.log('🔄 Refreshing materialized views...');

        await pool.query('REFRESH MATERIALIZED VIEW CONCURRENTLY mv_trending_products_24h');
        await pool.query('REFRESH MATERIALIZED VIEW CONCURRENTLY mv_user_product_affinity');
        await pool.query('REFRESH MATERIALIZED VIEW CONCURRENTLY mv_product_cooccurrence');

        console.log('✅ Materialized views refreshed');
    } catch (error) {
        console.error('❌ Error refreshing materialized views:', error.message);
    }
}

module.exports = {
    getPersonalizedRecommendations,
    getFrequentlyViewedTogether,
    getTrendingProducts,
    getCategoryBasedRecommendations,
    getSimilarProducts,
    refreshMaterializedViews
};
