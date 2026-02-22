const express = require('express');
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

// LangChain imports
const { ChatGroq } = require("@langchain/groq");
const { ChatPromptTemplate, MessagesPlaceholder } = require("@langchain/core/prompts");
const { RunnableWithMessageHistory } = require("@langchain/core/runnables");
const { InMemoryChatMessageHistory } = require("@langchain/core/chat_history");

// In-memory chat history storage (mapped by sessionId)
const chatHistories = {};

const getMessageHistory = (sessionId) => {
  if (chatHistories[sessionId] === undefined) {
    chatHistories[sessionId] = new InMemoryChatMessageHistory();
  }
  return chatHistories[sessionId];
};

const app = express();
const PORT = 3000;

// Initialize LangChain ChatGroq
const chatModel = new ChatGroq({
  apiKey: process.env.GROQ_API_KEY,
  model: "llama-3.3-70b-versatile",
  temperature: 0.7,
});

// Initialize Prisma
const prisma = new PrismaClient();

// Initialize Kafka Producer
const kafkaProducer = getProducer();

app.use(express.json());

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


// Chat API with Product Knowledge (RAG with Pinecone or Keyword Search)
app.post('/api/chat', async (req, res) => {
  const userMessage = req.body?.message;

  if (!userMessage) {
    return res.status(400).json({ error: 'No message provided' });
  }

  try {
    let relevantProducts = [];
    const usePinecone = process.env.USE_PINECONE === 'true';

    // Try Pinecone vector search first (if enabled and configured)
    if (usePinecone) {
      try {
        const { searchProducts, isPineconeConfigured } = require('./utils/pinecone');

        if (isPineconeConfigured()) {
          console.log('🔍 Using Pinecone vector search');

          // Search using vector similarity
          const searchResults = await searchProducts(userMessage, 5);

          // Fetch full product details from database
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
        // Fall through to keyword search
      }
    }

    // Fallback to keyword search (if Pinecone disabled or failed)
    if (!usePinecone || relevantProducts.length === 0) {
      console.log('🔍 Using keyword search');

      // Extract potential product-related keywords
      const keywords = userMessage.toLowerCase().match(/\b\w+\b/g) || [];

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
          take: 5 // Limit to top 5 products
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

    const SYSTEM_PROMPT = `You are an AI shopping assistant for an e-commerce website.
Your role is to help customers find products, answer questions about products, and provide recommendations.

Guidelines:
- Be friendly, helpful, and concise
- If product information is available in the context, use it to answer questions
- Provide specific product names, prices, and details when relevant
- If asked about products not in the context, politely say you don't have that information
- Suggest related products when appropriate
- Format prices with dollar signs
{productContext}`;

    // Define the LangChain prompt template
    const prompt = ChatPromptTemplate.fromMessages([
      ["system", SYSTEM_PROMPT],
      new MessagesPlaceholder("history"),
      ["human", "{input}"]
    ]);

    // Create the runnable chain
    const chain = prompt.pipe(chatModel);

    // Wrap the chain with message history
    const chainWithHistory = new RunnableWithMessageHistory({
      runnable: chain,
      getMessageHistory: getMessageHistory,
      inputMessagesKey: "input",
      historyMessagesKey: "history",
    });

    const sessionId = req.headers['x-session-id'] || generateEventId();
    
    // Execute the chain with the session history
    const response = await chainWithHistory.invoke(
      {
        input: userMessage,
        productContext: productContext // Passing contextual variables
      },
      { configurable: { sessionId } }
    );

    const reply = response.content || "No response";

    // Track chat event to Kafka (async, non-blocking)
    const chatEvent = createChatEvent({
      userId: req.headers['x-user-id'] || 'anonymous',
      sessionId: sessionId,
      message: userMessage,
      response: reply,
      productsReturned: relevantProducts.map(p => p.id),
      searchMethod: usePinecone && relevantProducts.length > 0 ? 'vector' : 'keyword'
    });
    kafkaProducer.publishEvent(Topics.CHAT_EVENTS, chatEvent).catch(err =>
      console.error('Failed to publish chat event:', err)
    );

    // Return both the AI response and relevant products
    res.json({
      response: reply,
      products: relevantProducts.slice(0, 3), // Send top 3 products to display
      searchMethod: usePinecone && relevantProducts.length > 0 ? 'vector' : 'keyword'
    });

  } catch (error) {
    console.error("Chat API error:", error);
    res.status(500).json({ error: "Chat API call failed" });
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

app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
  console.log(`📦 Database connected with ${prisma ? 'Prisma' : 'error'}`);
});