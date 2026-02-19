const { Kafka, logLevel } = require('kafkajs');
const { validateEvent } = require('./event-schemas');
require('dotenv').config();

class KafkaProducer {
    constructor() {
        this.kafka = null;
        this.producer = null;
        this.isConnected = false;
        this.isEnabled = process.env.ENABLE_EVENT_STREAMING === 'true';

        if (this.isEnabled) {
            this.initializeProducer();
        }
    }

    /**
     * Initialize Kafka producer
     */
    async initializeProducer() {
        try {
            this.kafka = new Kafka({
                clientId: process.env.KAFKA_CLIENT_ID || 'ecommerce-app',
                brokers: [process.env.KAFKA_BROKER || 'localhost:19092'],
                logLevel: logLevel.ERROR,
                retry: {
                    initialRetryTime: 100,
                    retries: 8
                }
            });

            this.producer = this.kafka.producer({
                allowAutoTopicCreation: true,
                transactionTimeout: 30000
            });

            await this.producer.connect();
            this.isConnected = true;
            console.log('✅ Kafka producer connected');
        } catch (error) {
            console.error('❌ Failed to initialize Kafka producer:', error.message);
            this.isConnected = false;
        }
    }

    /**
     * Publish event to Kafka topic
     * @param {string} topic - Kafka topic name
     * @param {Object} event - Event object
     * @returns {Promise<boolean>} - Success status
     */
    async publishEvent(topic, event) {
        // If Kafka is disabled, just log and return
        if (!this.isEnabled) {
            console.log(`📝 [Event Streaming Disabled] Would publish to ${topic}:`, event.eventType);
            return true;
        }

        // If not connected, try to reconnect
        if (!this.isConnected) {
            console.warn('⚠️  Kafka producer not connected, attempting to reconnect...');
            await this.initializeProducer();

            if (!this.isConnected) {
                console.error('❌ Failed to reconnect to Kafka, event not published');
                return false;
            }
        }

        try {
            // Validate event
            if (!validateEvent(event, event.eventType)) {
                console.error('❌ Invalid event schema:', event);
                return false;
            }

            // Publish to Kafka
            await this.producer.send({
                topic,
                messages: [
                    {
                        key: event.userId, // Partition by user ID for ordering
                        value: JSON.stringify(event),
                        timestamp: event.timestamp.toString()
                    }
                ]
            });

            console.log(`✅ Published event to ${topic}:`, event.eventType);
            return true;
        } catch (error) {
            console.error(`❌ Failed to publish event to ${topic}:`, error.message);
            return false;
        }
    }

    /**
     * Publish batch of events
     * @param {string} topic - Kafka topic name
     * @param {Array} events - Array of event objects
     * @returns {Promise<boolean>} - Success status
     */
    async publishBatch(topic, events) {
        if (!this.isEnabled || !this.isConnected) {
            console.log(`📝 [Batch] Would publish ${events.length} events to ${topic}`);
            return true;
        }

        try {
            const messages = events.map(event => ({
                key: event.userId,
                value: JSON.stringify(event),
                timestamp: event.timestamp.toString()
            }));

            await this.producer.send({
                topic,
                messages
            });

            console.log(`✅ Published ${events.length} events to ${topic}`);
            return true;
        } catch (error) {
            console.error(`❌ Failed to publish batch to ${topic}:`, error.message);
            return false;
        }
    }

    /**
     * Disconnect producer
     */
    async disconnect() {
        if (this.producer && this.isConnected) {
            await this.producer.disconnect();
            this.isConnected = false;
            console.log('✅ Kafka producer disconnected');
        }
    }
}

// Singleton instance
let producerInstance = null;

/**
 * Get Kafka producer instance
 * @returns {KafkaProducer}
 */
function getProducer() {
    if (!producerInstance) {
        producerInstance = new KafkaProducer();
    }
    return producerInstance;
}

/**
 * Kafka topic names
 */
const Topics = {
    USER_INTERACTIONS: 'user-interactions',
    PRODUCT_EVENTS: 'product-events',
    SESSION_EVENTS: 'session-events',
    CHAT_EVENTS: 'chat-events'
};

module.exports = {
    getProducer,
    Topics,
    KafkaProducer
};
