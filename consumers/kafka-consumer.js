const { Kafka, logLevel } = require('kafkajs');
const { Pool } = require('pg');
const { Topics } = require('../utils/kafka-producer');
require('dotenv').config();

// PostgreSQL connection pool
const pool = new Pool({
    host: process.env.POSTGRES_HOST || 'localhost',
    port: process.env.POSTGRES_PORT || 5432,
    user: process.env.POSTGRES_USER || 'postgres',
    password: process.env.POSTGRES_PASSWORD || 'postgres',
    database: process.env.POSTGRES_DB || 'recommendations',
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});

// Kafka consumer
const kafka = new Kafka({
    clientId: process.env.KAFKA_CLIENT_ID || 'ecommerce-app',
    brokers: [process.env.KAFKA_BROKER || 'localhost:19092'],
    logLevel: logLevel.INFO
});

const consumer = kafka.consumer({
    groupId: process.env.KAFKA_GROUP_ID || 'recommendation-consumers',
    sessionTimeout: 30000,
    heartbeatInterval: 3000
});

/**
 * Insert user interaction into data warehouse
 */
async function insertUserInteraction(event) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Insert into fact_user_interactions
        await client.query(`
      INSERT INTO fact_user_interactions (
        event_id, user_id, session_id, product_id, event_type, timestamp,
        source, position, query, product_name, product_price, category
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      ON CONFLICT (event_id) DO NOTHING
    `, [
            event.eventId,
            event.userId,
            event.sessionId,
            event.productId,
            event.eventType,
            new Date(event.timestamp),
            event.metadata?.source || null,
            event.metadata?.position || null,
            event.metadata?.query || null,
            event.productName,
            event.productPrice,
            event.category
        ]);

        // Upsert product into dim_products
        await client.query(`
      INSERT INTO dim_products (product_id, product_name, category, price)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (product_id) DO UPDATE SET
        product_name = EXCLUDED.product_name,
        category = EXCLUDED.category,
        price = EXCLUDED.price,
        updated_at = CURRENT_TIMESTAMP
    `, [event.productId, event.productName, event.category, event.productPrice]);

        await client.query('COMMIT');
        console.log(`✅ Inserted interaction: ${event.eventType} for product ${event.productId}`);
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Error inserting interaction:', error.message);
    } finally {
        client.release();
    }
}

/**
 * Insert purchase into data warehouse
 */
async function insertPurchase(event) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Insert into fact_purchases
        const purchaseResult = await client.query(`
      INSERT INTO fact_purchases (
        event_id, user_id, session_id, timestamp, total_amount, payment_method, num_items
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (event_id) DO NOTHING
      RETURNING purchase_id
    `, [
            event.eventId,
            event.userId,
            event.sessionId,
            new Date(event.timestamp),
            event.totalAmount,
            event.paymentMethod || 'unknown',
            event.products.length
        ]);

        if (purchaseResult.rows.length > 0) {
            const purchaseId = purchaseResult.rows[0].purchase_id;

            // Insert purchase items
            for (const product of event.products) {
                await client.query(`
          INSERT INTO fact_purchase_items (purchase_id, product_id, quantity, price)
          VALUES ($1, $2, $3, $4)
        `, [purchaseId, product.productId, product.quantity, product.price]);
            }

            // Update user stats
            await client.query(`
        UPDATE dim_users SET
          total_purchases = total_purchases + 1,
          total_spent = total_spent + $1,
          updated_at = CURRENT_TIMESTAMP
        WHERE user_id = $2
      `, [event.totalAmount, event.userId]);
        }

        await client.query('COMMIT');
        console.log(`✅ Inserted purchase: ${event.eventId} - $${event.totalAmount}`);
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Error inserting purchase:', error.message);
    } finally {
        client.release();
    }
}

/**
 * Insert session event into data warehouse
 */
async function insertSession(event) {
    const client = await pool.connect();
    try {
        // Upsert user in dim_users
        await client.query(`
      INSERT INTO dim_users (user_id, session_id, user_agent, first_seen_at, last_seen_at)
      VALUES ($1, $2, $3, $4, $4)
      ON CONFLICT (user_id) DO UPDATE SET
        session_id = EXCLUDED.session_id,
        last_seen_at = EXCLUDED.last_seen_at,
        total_sessions = dim_users.total_sessions + 1,
        updated_at = CURRENT_TIMESTAMP
    `, [event.userId, event.sessionId, event.userAgent, new Date(event.timestamp)]);

        console.log(`✅ Inserted session: ${event.eventType} for user ${event.userId}`);
    } catch (error) {
        console.error('❌ Error inserting session:', error.message);
    } finally {
        client.release();
    }
}

/**
 * Process message from Kafka
 */
async function processMessage(topic, message) {
    try {
        const event = JSON.parse(message.value.toString());

        console.log(`📨 Processing ${event.eventType} from ${topic}`);

        switch (topic) {
            case Topics.USER_INTERACTIONS:
                await insertUserInteraction(event);
                break;

            case Topics.SESSION_EVENTS:
                await insertSession(event);
                break;

            case Topics.PRODUCT_EVENTS:
                // Handle product CRUD events if needed
                console.log(`📦 Product event: ${event.eventType}`);
                break;

            case Topics.CHAT_EVENTS:
                // Could store chat history for analysis
                console.log(`💬 Chat event: ${event.eventType}`);
                break;

            default:
                console.log(`⚠️  Unknown topic: ${topic}`);
        }
    } catch (error) {
        console.error('❌ Error processing message:', error.message);
    }
}

/**
 * Start Kafka consumer
 */
async function startConsumer() {
    try {
        await consumer.connect();
        console.log('✅ Kafka consumer connected');

        // Subscribe to all topics
        await consumer.subscribe({
            topics: Object.values(Topics),
            fromBeginning: false
        });

        console.log('✅ Subscribed to topics:', Object.values(Topics).join(', '));

        // Run consumer
        await consumer.run({
            eachMessage: async ({ topic, partition, message }) => {
                await processMessage(topic, message);
            },
        });

        console.log('✅ Kafka consumer running...');
    } catch (error) {
        console.error('❌ Failed to start Kafka consumer:', error.message);
        process.exit(1);
    }
}

/**
 * Graceful shutdown
 */
async function shutdown() {
    console.log('\n🛑 Shutting down Kafka consumer...');
    try {
        await consumer.disconnect();
        await pool.end();
        console.log('✅ Kafka consumer disconnected');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error during shutdown:', error.message);
        process.exit(1);
    }
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Start consumer
startConsumer().catch(console.error);
