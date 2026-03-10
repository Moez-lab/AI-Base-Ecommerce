const { Pinecone } = require('@pinecone-database/pinecone');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

// Initialize clients
let pinecone = null;
let genAI = null;
let index = null;

async function initializePinecone() {
    if (!process.env.PINECONE_API_KEY || process.env.PINECONE_API_KEY === 'your_pinecone_api_key_here') {
        throw new Error('PINECONE_API_KEY not configured in .env');
    }

    if (!process.env.GEMINI_API_KEY) {
        throw new Error('GEMINI_API_KEY not configured in .env');
    }

    pinecone = new Pinecone({
        apiKey: process.env.PINECONE_API_KEY
    });

    // Initialize Gemini for embeddings
    genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

    index = pinecone.index(process.env.PINECONE_INDEX_NAME || 'products');

    console.log('✅ Pinecone initialized with Gemini embeddings');
}

/**
 * Generate embedding for text using Gemini API
 * @param {string} text - Text to embed
 * @returns {Promise<number[]>} - Embedding vector (768 dimensions for text-embedding-004)
 */
async function generateEmbedding(text) {
    if (!genAI) {
        await initializePinecone();
    }

    try {
        const model = genAI.getGenerativeModel({ model: 'gemini-embedding-001' });
        const result = await model.embedContent(text);
        const embedding = result.embedding.values;

        return embedding;
    } catch (error) {
        console.error('Error generating embedding:', error.message);
        throw error;
    }
}

/**
 * Upsert a product to Pinecone
 * @param {Object} product - Product object from database
 */
async function upsertProductToPinecone(product) {
    if (!index) {
        await initializePinecone();
    }

    try {
        // Create searchable text from product
        const text = `${product.name} ${product.description} ${product.category}`;

        // Generate embedding
        const embedding = await generateEmbedding(text);

        // Upsert to Pinecone
        await index.upsert([{
            id: `product-${product.id}`,
            values: embedding,
            metadata: {
                productId: product.id,
                name: product.name,
                price: product.price,
                category: product.category,
                stock: product.stock,
                description: product.description.substring(0, 200) // Limit metadata size
            }
        }]);

        console.log(`✅ Upserted product ${product.id}: ${product.name}`);
    } catch (error) {
        console.error(`❌ Error upserting product ${product.id}:`, error.message);
        throw error;
    }
}

/**
 * Search for products using vector similarity
 * @param {string} query - User search query
 * @param {number} topK - Number of results to return
 * @returns {Promise<Array>} - Array of product IDs with scores
 */

async function searchProducts(query, topK = 5) {
    if (!index) {
        await initializePinecone();
    }

    try {
        // Generate embedding for query
        const queryEmbedding = await generateEmbedding(query);

        // Search Pinecone
        const results = await index.query({
            vector: queryEmbedding,
            topK: topK,
            includeMetadata: true
        });

        // Return product IDs and scores
        return results.matches.map(match => ({
            productId: match.metadata.productId,
            score: match.score,
            metadata: match.metadata
        }));
    } catch (error) {
        console.error('Error searching products:', error.message);
        throw error;
    }
}

/**
 * Delete a product from Pinecone
 * @param {number} productId - Product ID to delete
 */
async function deleteProductFromPinecone(productId) {
    if (!index) {
        await initializePinecone();
    }

    try {
        await index.deleteOne(`product-${productId}`);
        console.log(`✅ Deleted product ${productId} from Pinecone`);
    } catch (error) {
        console.error(`❌ Error deleting product ${productId}:`, error.message);
        throw error;
    }
}

/**
 * Check if Pinecone is configured and ready
 * @returns {boolean}
 */
function isPineconeConfigured() {
    return process.env.PINECONE_API_KEY &&
        process.env.PINECONE_API_KEY !== 'your_pinecone_api_key_here' &&
        process.env.GEMINI_API_KEY;
}

module.exports = {
    initializePinecone,
    generateEmbedding,
    upsertProductToPinecone,
    searchProducts,
    deleteProductFromPinecone,
    isPineconeConfigured
};
