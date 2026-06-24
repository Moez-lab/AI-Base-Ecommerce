const express = require('express');
const cors = require('cors');
const { removeStopwords, eng } = require('stopword');
const Groq = require('groq-sdk');
const { PrismaClient } = require('@prisma/client');
require('dotenv').config();
const path = require('path');
const { getProducer, Topics } = require('./utils/kafka-producer');
const { EventTypes, createProductEvent, createChatEvent, createSessionEvent, generateEventId } = require('./utils/event-schemas');
const {
  getPersonalizedRecommendations,
  getFrequentlyViewedTogether,
  getTrendingProducts,
  getSimilarProducts
} = require('./utils/recommendation-engine');

// Smart AI chat helper
const { streamAIChatResponse } = require('./utils/ai-chat');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Prisma
const prisma = new PrismaClient();

// Initialize Kafka Producer
const kafkaProducer = getProducer();

app.use(express.json());

// Enable CORS for frontend communication
app.use(cors({
  origin: [
    'https://ai-base-ecommerce-frontend-production.up.railway.app',
    'http://localhost:3000',
    'http://localhost:5173'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'x-user-id', 'x-session-id']
}));

app.get('/', (req, res) => {
  res.json({ status: 'active', message: 'ShopAI Backend API is running' });
});

// Get all products
app.get('/api/products', async (req, res) => {
  try {
    const products = await prisma.product.findMany();
    res.json(products);
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});


// Get product by ID - NOT USED (commented out to keep code clean)
// Get product by ID
app.get('/api/products/:id', async (req, res) => {
  try {
    const product = await prisma.product.findUnique({
      where: { id: parseInt(req.params.id) }
    });
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.json(product);
  } catch (error) {
    console.error('Error fetching product:', error);
    res.status(500).json({ error: 'Failed to fetch product' });
  }
});


// Search products (Hybrid: Vector + Keyword Fallback)
app.get('/api/products/search/:query', async (req, res) => {
  const query = req.params.query;
  const usePinecone = process.env.USE_PINECONE === 'true';

  console.log(`🔎 Searching for: "${query}"`);

  try {
    let productIds = [];
    let searchSource = 'keyword';

    // 1. Try Vector Search (if enabled)
    if (usePinecone) {
      try {
        const { searchProducts, isPineconeConfigured } = require('./utils/pinecone');

        if (isPineconeConfigured()) {
          console.log('🔮 Attempting Semantic Search via Pinecone...');
          const vectorResults = await searchProducts(query, 10); // Fetch top 10 similar

          if (vectorResults.length > 0) {
            productIds = vectorResults.map(r => r.productId);
            searchSource = 'vector';
            console.log(`✅ Pinecone found ${productIds.length} matches.`);
          }
        }
      } catch (err) {
        console.warn('⚠️ Semantic search failed (falling back to keyword):', err.message);
        // Continue to keyword search...
      }
    }

    // 2. Fetch Products
    let products = [];

    if (searchSource === 'vector' && productIds.length > 0) {
      // Fetch specific products from DB preserving order
      const fetchedProducts = await prisma.product.findMany({
        where: { id: { in: productIds } }
      });

      // Re-order based on vector score
      const productMap = new Map(fetchedProducts.map(p => [p.id, p]));
      products = productIds
        .map(id => productMap.get(id))
        .filter(p => p !== undefined); // Filter out any missing IDs
    }

    // 3. Fallback to Keyword Search (if vector failed or found nothing)
    if (products.length === 0) {
      console.log('🔤 Performing Keyword Search...');
      const lowerQuery = query.toLowerCase();
      products = await prisma.product.findMany({
        where: {
          OR: [
            { name: { contains: lowerQuery } }, // Case-insensitive handled by DB collation usually, or simple contains for SQLite
            { description: { contains: lowerQuery } },
            { category: { contains: lowerQuery } }
          ]
        }
      });
    }

    res.json({
      source: searchSource,
      results: products
    });

  } catch (error) {
    console.error('❌ Search Endpoint Error:', error);
    res.status(500).json({ error: 'Failed to search products' });
  }
});


// Chat API with streaming (SSE)
app.post('/api/chat', async (req, res) => {
  const userMessage = req.body?.message;

  if (!userMessage) {
    return res.status(400).json({ error: 'No message provided' });
  }

  try {
    const hasKeys = process.env.GROQ_API_KEY || process.env.GEMINI_API_KEY;
    if (!hasKeys) {
      return res.status(503).json({ error: 'AI Assistant is not configured on the server. Please configure GROQ_API_KEY or GEMINI_API_KEY.' });
    }

    let relevantProducts = [];
    let usePinecone = process.env.USE_PINECONE === 'true';

    const lower = userMessage.toLowerCase().trim();
    const isGreeting = /^(hi|hello|hey|hola|greetings|good morning|good afternoon|good evening|yo)\b/i.test(lower);
    const isThankYou = /^(thanks|thank you|awesome|great|cool|ok|okay)\b/i.test(lower);
    const isCapability = /who are you|what can (you|u) do|your name/i.test(lower);
    const isSearchIntent = !isGreeting && !isThankYou && !isCapability;

    // Try Pinecone vector search first (if enabled and configured and user has search intent)
    if (usePinecone && isSearchIntent) {
      try {
        const { searchProducts, isPineconeConfigured } = require('./utils/pinecone');

        if (isPineconeConfigured()) {
          console.log('🔍 Using Pinecone vector search');
          const searchResults = await searchProducts(userMessage, 5);
          const productIds = searchResults.map(r => r.productId);

          if (productIds.length > 0) {
            relevantProducts = await prisma.product.findMany({
              where: { id: { in: productIds } }
            });

            // Sort by Pinecone relevance score
            const scoreMap = new Map(searchResults.map(r => [r.productId, r.score]));
            relevantProducts.sort((a, b) => (scoreMap.get(b.id) || 0) - (scoreMap.get(a.id) || 0));
          }
        } else {
          console.log('⚠️  Pinecone not configured, falling back to keyword search');
          usePinecone = false; // Fall through to keyword search
        }
      } catch (pineconeError) {
        console.error('⚠️  Pinecone error, falling back to keyword search:', pineconeError.message);
        usePinecone = false; // Fall through to keyword search
      }
    }

    // Fallback to keyword search (if Pinecone disabled or failed, and user has search intent)
    if (isSearchIntent && (!usePinecone || relevantProducts.length === 0)) {
      console.log('🔍 Using keyword search');

      // removeStopwords() uses the same English stop-word list as Elasticsearch/Algolia
      const rawTokens = userMessage.toLowerCase().match(/\b\w+\b/g) || [];
      // >= 2 keeps short but important product terms like 'tv', '4k', 'pc'
      // single-char noise ('a', 'i') is already removed by removeStopwords()
      const keywords = removeStopwords(rawTokens, eng).filter(w => w.length >= 2);

      // Detect price intent — sort by price in the DB so the right products reach the AI
      const wantsLowest = /lowest|cheap|budget|affordable|inexpensive|low.?price/i.test(userMessage);
      const wantsHighest = /highest|expensive|premium|best|top.?of|maxx?|max.?price/i.test(userMessage);
      const priceOrder = wantsLowest ? { price: 'asc' }
        : wantsHighest ? { price: 'desc' }
          : undefined;   // no price intent → natural DB order

      // Search for relevant products based on keywords
      if (keywords.length > 0) {
        relevantProducts = await prisma.product.findMany({
          where: {
            OR: keywords.map(keyword => ({
              OR: [
                { name: { contains: keyword } },
                { description: { contains: keyword } },
                { category: { contains: keyword } }
              ]
            }))
          },
          orderBy: priceOrder,  // ← sort by price when user expressed price preference
          take: 5
        });
      }
    }

    // Build context from relevant products
    let productContext = '';
    if (relevantProducts.length > 0) {
      productContext = '\n\nRelevant Products:\n' + relevantProducts.map(p =>
        `- ${p.name} ($${p.price}): ${p.description} [Category: ${p.category}, Stock: ${p.stock}]`
      ).join('\n');
    }

    const topProducts = relevantProducts.slice(0, 3);
    const sessionId = req.headers['x-session-id'] || generateEventId();
    const searchMethod = (usePinecone && relevantProducts.length > 0) ? 'vector' : 'keyword';

    // ── Set SSE headers ──
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    // Send product cards immediately (before tokens arrive)
    res.write(`data: ${JSON.stringify({ type: 'products', products: topProducts, searchMethod })}\n\n`);

        const fullReply = await streamAIChatResponse({
      message: userMessage,
      productContext,
      sessionId,
      relevantProducts,
      onToken: (token) => {
        res.write(`data: ${JSON.stringify({ type: 'token', content: token })}\n\n`);
      },
      onError: (err) => {
        console.error('Error during streaming:', err);
        if (!res.headersSent) {
          res.status(500).json({ error: err.message });
        } else {
          res.write(`data: ${JSON.stringify({ type: 'error', message: err.message })}\n\n`);
          res.end();
        }
      }
    });

    if (fullReply) {
      // Signal end of stream
      res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
      res.end();

      // Track chat event to Kafka (async, non-blocking)
      const chatEvent = createChatEvent({
        userId: req.headers['x-user-id'] || 'anonymous',
        sessionId,
        message: userMessage,
        response: fullReply,
        productsReturned: relevantProducts.map(p => p.id),
        searchMethod
      });
      kafkaProducer.publishEvent(Topics.CHAT_EVENTS, chatEvent).catch(err =>
        console.error('Failed to publish chat event:', err)
      );
    } else {
      res.end();
    }

  } catch (error) {
    console.error("Chat API error:", error);
    if (!res.headersSent) {
      res.status(500).json({ error: "Chat API call failed" });
    } else {
      res.write(`data: ${JSON.stringify({ type: 'error', message: 'Something went wrong' })}\n\n`);
      res.end();
    }
  }
});



// ============================================
// EVENT TRACKING ENDPOINTS
// ============================================

// Track product view
app.post('/api/track/view', async (req, res) => {
  try {
    const { productId, userId, sessionId, source, position, query } = req.body;

    const product = await prisma.product.findUnique({
      where: { id: parseInt(productId) }
    });

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const event = createProductEvent(EventTypes.PRODUCT_VIEW, {
      userId: userId || 'anonymous',
      sessionId: sessionId || generateEventId(),
      product,
      metadata: { source, position, query }
    });

    await kafkaProducer.publishEvent(Topics.USER_INTERACTIONS, event);
    res.json({ success: true, eventId: event.eventId });
  } catch (error) {
    console.error('Error tracking view:', error);
    res.status(500).json({ error: 'Failed to track view' });
  }
});

// Track product click
app.post('/api/track/click', async (req, res) => {
  try {
    const { productId, userId, sessionId, source, position } = req.body;

    const product = await prisma.product.findUnique({
      where: { id: parseInt(productId) }
    });

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const event = createProductEvent(EventTypes.PRODUCT_CLICK, {
      userId: userId || 'anonymous',
      sessionId: sessionId || generateEventId(),
      product,
      metadata: { source, position }
    });

    await kafkaProducer.publishEvent(Topics.USER_INTERACTIONS, event);
    res.json({ success: true, eventId: event.eventId });
  } catch (error) {
    console.error('Error tracking click:', error);
    res.status(500).json({ error: 'Failed to track click' });
  }
});

// Track add to cart
app.post('/api/track/add-to-cart', async (req, res) => {
  try {
    const { productId, userId, sessionId } = req.body;

    const product = await prisma.product.findUnique({
      where: { id: parseInt(productId) }
    });

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const event = createProductEvent(EventTypes.ADD_TO_CART, {
      userId: userId || 'anonymous',
      sessionId: sessionId || generateEventId(),
      product,
      metadata: { source: 'cart' }
    });

    await kafkaProducer.publishEvent(Topics.USER_INTERACTIONS, event);
    res.json({ success: true, eventId: event.eventId });
  } catch (error) {
    console.error('Error tracking add to cart:', error);
    res.status(500).json({ error: 'Failed to track add to cart' });
  }
});

// Create/get user session
app.post('/api/session/start', async (req, res) => {
  try {
    const { userId, userAgent, ipAddress, referrer } = req.body;
    const sessionId = generateEventId();

    const event = createSessionEvent(EventTypes.SESSION_START, {
      userId: userId || `anon_${sessionId}`,
      sessionId,
      userAgent: userAgent || req.headers['user-agent'],
      ipAddress: ipAddress || req.ip,
      referrer: referrer || req.headers['referer']
    });

    await kafkaProducer.publishEvent(Topics.SESSION_EVENTS, event);

    res.json({
      success: true,
      userId: event.userId,
      sessionId: event.sessionId
    });
  } catch (error) {
    console.error('Error creating session:', error);
    res.status(500).json({ error: 'Failed to create session' });
  }
});


// ============================================
// RECOMMENDATION ENDPOINTS
// ============================================

// Get personalized recommendations for a user
app.get('/api/recommendations/personalized/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const limit = parseInt(req.query.limit) || 10;

    const recommendations = await getPersonalizedRecommendations(userId, limit);
    res.json({ recommendations });
  } catch (error) {
    console.error('Error getting personalized recommendations:', error);
    res.status(500).json({ error: 'Failed to get recommendations' });
  }
});

// Get products frequently viewed together
app.get('/api/recommendations/related/:productId', async (req, res) => {
  try {
    const productId = parseInt(req.params.productId);
    const limit = parseInt(req.query.limit) || 5;

    const recommendations = await getFrequentlyViewedTogether(productId, limit);
    res.json({ recommendations });
  } catch (error) {
    console.error('Error getting related products:', error);
    res.status(500).json({ error: 'Failed to get related products' });
  }
});

// Get similar products based on user behavior
app.get('/api/recommendations/similar/:productId', async (req, res) => {
  try {
    const productId = parseInt(req.params.productId);
    const limit = parseInt(req.query.limit) || 5;

    const recommendations = await getSimilarProducts(productId, limit);
    res.json({ recommendations });
  } catch (error) {
    console.error('Error getting similar products:', error);
    res.status(500).json({ error: 'Failed to get similar products' });
  }
});

// Get trending products
app.get('/api/recommendations/trending', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;

    const recommendations = await getTrendingProducts(limit);
    res.json({ recommendations });
  } catch (error) {
    console.error('Error getting trending products:', error);
    res.status(500).json({ error: 'Failed to get trending products' });
  }
});


// Graceful shutdown
process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`✅ Server running at http://localhost:${PORT}`);
    console.log(`📦 Database connected with ${prisma ? 'Prisma' : 'error'}`);
  });
}

module.exports = app;

