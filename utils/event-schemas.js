/**
 * Event schemas for user interactions and product events
 * These schemas define the structure of events published to Kafka
 */

const EventTypes = {
    // User interaction events
    PRODUCT_VIEW: 'product.view',
    PRODUCT_CLICK: 'product.click',
    ADD_TO_CART: 'product.add_to_cart',
    REMOVE_FROM_CART: 'product.remove_from_cart',
    PURCHASE: 'product.purchase',

    // Session events
    SESSION_START: 'session.start',
    SESSION_END: 'session.end',

    // Product events
    PRODUCT_CREATED: 'product.created',
    PRODUCT_UPDATED: 'product.updated',
    PRODUCT_DELETED: 'product.deleted',

    // Chat events
    CHAT_MESSAGE: 'chat.message',
    RECOMMENDATION_SHOWN: 'recommendation.shown',
    RECOMMENDATION_CLICKED: 'recommendation.clicked'
};

/**
 * Base event schema - all events extend this
 */
const baseEventSchema = {
    eventId: 'string',      // Unique event ID (UUID)
    eventType: 'string',    // Event type from EventTypes
    timestamp: 'number',    // Unix timestamp in milliseconds
    userId: 'string',       // User ID (can be anonymous session ID)
    sessionId: 'string'     // Session ID
};

/**
 * Product interaction event schema
 */
const productInteractionSchema = {
    ...baseEventSchema,
    productId: 'number',    // Product ID
    productName: 'string',  // Product name
    productPrice: 'number', // Product price
    category: 'string',     // Product category
    metadata: {             // Additional metadata
        source: 'string',     // Where the interaction happened (search, recommendation, chat, etc.)
        position: 'number',   // Position in list (if applicable)
        query: 'string'       // Search query (if applicable)
    }
};

/**
 * Purchase event schema
 */
const purchaseEventSchema = {
    ...baseEventSchema,
    products: [{
        productId: 'number',
        productName: 'string',
        quantity: 'number',
        price: 'number'
    }],
    totalAmount: 'number',
    paymentMethod: 'string'
};

/**
 * Session event schema
 */
const sessionEventSchema = {
    ...baseEventSchema,
    userAgent: 'string',
    ipAddress: 'string',
    referrer: 'string'
};

/**
 * Chat event schema
 */
const chatEventSchema = {
    ...baseEventSchema,
    message: 'string',
    response: 'string',
    productsReturned: ['number'], // Array of product IDs
    searchMethod: 'string'        // 'vector' or 'keyword'
};

/**
 * Validate event against schema
 * @param {Object} event - Event to validate
 * @param {string} eventType - Event type
 * @returns {boolean} - True if valid
 */
function validateEvent(event, eventType) {
    if (!event || typeof event !== 'object') {
        return false;
    }

    // Check required base fields
    if (!event.eventId || !event.timestamp || !event.userId || !event.sessionId) {
        return false;
    }

    // Type-specific validation
    switch (eventType) {
        case EventTypes.PRODUCT_VIEW:
        case EventTypes.PRODUCT_CLICK:
        case EventTypes.ADD_TO_CART:
        case EventTypes.REMOVE_FROM_CART:
            return event.productId && event.productName && event.category;

        case EventTypes.PURCHASE:
            return Array.isArray(event.products) && event.products.length > 0 && event.totalAmount;

        case EventTypes.SESSION_START:
        case EventTypes.SESSION_END:
            return event.userAgent;

        case EventTypes.CHAT_MESSAGE:
            return event.message && event.response;

        default:
            return true;
    }
}

/**
 * Create a product interaction event
 * @param {string} eventType - Event type
 * @param {Object} params - Event parameters
 * @returns {Object} - Formatted event
 */
function createProductEvent(eventType, { userId, sessionId, product, metadata = {} }) {
    return {
        eventId: generateEventId(),
        eventType,
        timestamp: Date.now(),
        userId,
        sessionId,
        productId: product.id,
        productName: product.name,
        productPrice: product.price,
        category: product.category,
        metadata: {
            source: metadata.source || 'unknown',
            position: metadata.position || null,
            query: metadata.query || null
        }
    };
}

/**
 * Create a purchase event
 * @param {Object} params - Event parameters
 * @returns {Object} - Formatted event
 */
function createPurchaseEvent({ userId, sessionId, products, totalAmount, paymentMethod }) {
    return {
        eventId: generateEventId(),
        eventType: EventTypes.PURCHASE,
        timestamp: Date.now(),
        userId,
        sessionId,
        products: products.map(p => ({
            productId: p.id,
            productName: p.name,
            quantity: p.quantity || 1,
            price: p.price
        })),
        totalAmount,
        paymentMethod: paymentMethod || 'unknown'
    };
}

/**
 * Create a session event
 * @param {string} eventType - SESSION_START or SESSION_END
 * @param {Object} params - Event parameters
 * @returns {Object} - Formatted event
 */
function createSessionEvent(eventType, { userId, sessionId, userAgent, ipAddress, referrer }) {
    return {
        eventId: generateEventId(),
        eventType,
        timestamp: Date.now(),
        userId,
        sessionId,
        userAgent: userAgent || 'unknown',
        ipAddress: ipAddress || 'unknown',
        referrer: referrer || 'direct'
    };
}

/**
 * Create a chat event
 * @param {Object} params - Event parameters
 * @returns {Object} - Formatted event
 */
function createChatEvent({ userId, sessionId, message, response, productsReturned, searchMethod }) {
    return {
        eventId: generateEventId(),
        eventType: EventTypes.CHAT_MESSAGE,
        timestamp: Date.now(),
        userId,
        sessionId,
        message,
        response,
        productsReturned: productsReturned || [],
        searchMethod: searchMethod || 'keyword'
    };
}

/**
 * Generate unique event ID
 * @returns {string} - UUID v4
 */
function generateEventId() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

module.exports = {
    EventTypes,
    validateEvent,
    createProductEvent,
    createPurchaseEvent,
    createSessionEvent,
    createChatEvent,
    generateEventId
};
