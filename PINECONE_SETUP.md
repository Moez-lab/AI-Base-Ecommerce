# Pinecone Setup Guide

## 🚀 Quick Start

Follow these steps to enable semantic vector search in your e-commerce chatbot.

---

## Step 1: Get API Keys

### **Pinecone API Key**

1. Go to https://app.pinecone.io
2. Sign up for a free account
3. Click "API Keys" in the left sidebar
4. Copy your API key
5. Add to `.env`: `PINECONE_API_KEY=your_actual_key`

### **OpenAI API Key** (for embeddings)

1. Go to https://platform.openai.com/api-keys
2. Sign up / Log in
3. Click "Create new secret key"
4. Copy the key
5. Add to `.env`: `OPENAI_API_KEY=your_actual_key`

---

## Step 2: Create Pinecone Index

Run the setup script:

```bash
node scripts/setup-pinecone.js
```

This will:
- Create a Pinecone index named `ecommerce-products`
- Configure it for 1536-dimensional embeddings (OpenAI)
- Set up cosine similarity metric

**Expected output:**
```
🚀 Setting up Pinecone index...
📦 Creating new index: "ecommerce-products"...
✅ Index created successfully!
```

---

## Step 3: Sync Products to Pinecone

Run the sync script:

```bash
node scripts/sync-products.js
```

This will:
- Fetch all 20 products from SQLite
- Generate embeddings for each product
- Upload to Pinecone

**Expected output:**
```
🔄 Syncing products to Pinecone...
📦 Fetching products from database...
✅ Found 20 products
   Progress: 100% (20/20)
✅ Success: 20 products
🎉 Products synced to Pinecone successfully!
```

**Time:** ~30-60 seconds (depends on API speed)

---

## Step 4: Enable Pinecone

Update `.env`:

```env
USE_PINECONE=true
```

---

## Step 5: Test It!

Restart your server:

```bash
npm run dev
```

Try these queries in the chat:

### **Semantic Search Examples:**

| Query | What It Finds |
|-------|---------------|
| "laptop" | Gaming Laptop Pro ✅ |
| "computer" | Gaming Laptop Pro (semantic!) ✅ |
| "something for exercise" | Fitness products ✅ |
| "gift for fitness enthusiast" | Dumbbells, yoga mat, etc. ✅ |
| "work from home setup" | Laptop, coffee maker, etc. ✅ |

---

## Troubleshooting

### **Error: PINECONE_API_KEY not configured**

- Make sure you added the actual API key to `.env`
- Don't use the placeholder `your_pinecone_api_key_here`

### **Error: OPENAI_API_KEY not configured**

- Add your OpenAI API key to `.env`
- Make sure it starts with `sk-`

### **Error: Index not found**

- Run `node scripts/setup-pinecone.js` first
- Wait for index to be "Ready" status

### **Slow responses**

- First query after restart is slower (cold start)
- Subsequent queries are faster
- Embedding generation takes ~200-500ms

---

## Cost Estimate

### **Pinecone (Free Tier):**
- 100,000 vectors included
- Your 20 products = 0.02% of limit
- **Cost: $0/month** ✅

### **OpenAI Embeddings:**
- text-embedding-3-small: $0.02 per 1M tokens
- 20 products × ~50 tokens = 1,000 tokens = $0.00002
- 1,000 user queries × ~20 tokens = 20,000 tokens = $0.0004
- **Cost: ~$0.01/month** ✅

**Total: Essentially free for learning!** 🎉

---

## Disable Pinecone (Revert to Keyword Search)

If you want to go back to keyword search:

1. Set `USE_PINECONE=false` in `.env`
2. Restart server

The system will automatically fall back to keyword search.

---

## NPM Scripts

```bash
# Setup Pinecone index (run once)
npm run pinecone:setup

# Sync products to Pinecone
npm run pinecone:sync

# Do both (setup + sync)
npm run pinecone:init
```

---

## What's Next?

Once Pinecone is working:

1. **Add more products** - The more products, the better semantic search works
2. **Test semantic queries** - Try natural language questions
3. **Compare results** - Toggle `USE_PINECONE` to see the difference
4. **Monitor usage** - Check Pinecone dashboard for stats

---

## Architecture

```
User Query: "laptop for gaming"
     ↓
Generate Embedding (OpenAI)
     ↓
Search Pinecone (Vector Similarity)
     ↓
Get Product IDs [3, 1, 5]
     ↓
Fetch from SQLite
     ↓
Build Context for AI
     ↓
Groq AI Response
     ↓
User sees: "I found the Gaming Laptop Pro..."
```

---

**You're all set! Enjoy semantic search! 🚀**
