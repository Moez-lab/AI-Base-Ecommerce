# Enterprise-Grade Recommendation System Setup

This guide will help you set up the complete recommendation system infrastructure for your e-commerce chatbot.

## 📋 Prerequisites

- **Node.js** 18+ installed
- **Docker** and **Docker Compose** installed
- **PostgreSQL client** (psql) for database initialization
- Your existing API keys (Groq, Gemini, Pinecone)

## 🚀 Quick Start

### Step 1: Install Dependencies

```bash
npm install
```

This will install:
- `kafkajs` - Kafka client
- `pg` - PostgreSQL client
- `redis` - Redis client
- All existing dependencies

### Step 2: Configure Environment Variables

Copy the example environment file and add your API keys:

```bash
cp .env.example .env
```

Edit `.env` and add your keys:
```env
# Your existing API keys
GROQ_API_KEY=your_actual_groq_key
GEMINI_API_KEY=your_actual_gemini_key
PINECONE_API_KEY=your_actual_pinecone_key

# Enable event streaming
ENABLE_EVENT_STREAMING=true
```

### Step 3: Start Infrastructure (Docker)

Start Redpanda (Kafka), PostgreSQL, and Redis:

```bash
npm run docker:up
```

This will start:
- **Redpanda** (Kafka) on port 19092
- **Redpanda Console** (Web UI) on port 8080
- **PostgreSQL** on port 5432
- **Redis** on port 6379

**Verify services are running:**
```bash
docker ps
```

You should see 4 containers running.

### Step 4: Initialize Data Warehouse

The PostgreSQL schema is automatically created when the container starts. To verify:

```bash
docker exec -it postgres-warehouse psql -U postgres -d recommendations -c "\dt"
```

You should see tables like `dim_users`, `dim_products`, `fact_user_interactions`, etc.

### Step 5: Start the Application

Open **3 terminal windows**:

**Terminal 1 - Kafka Consumer (Data Ingestion):**
```bash
npm run consumer:start
```

**Terminal 2 - Express Server:**
```bash
npm run dev
```

**Terminal 3 - Monitor Kafka (Optional):**
```bash
npm run docker:logs
```

### Step 6: Verify Setup

1. **Open Redpanda Console**: http://localhost:8080
   - You should see Kafka topics being created

2. **Open Application**: http://localhost:3000
   - Chat with the bot
   - View products
   - Check that events are being published

3. **Check Data Warehouse**:
```bash
docker exec -it postgres-warehouse psql -U postgres -d recommendations
```

Then run:
```sql
SELECT COUNT(*) FROM fact_user_interactions;
SELECT * FROM dim_products LIMIT 5;
SELECT * FROM mv_trending_products_24h LIMIT 10;
```

## 📊 Monitoring & Debugging

### View Kafka Topics

```bash
docker exec -it redpanda rpk topic list
```

### View Kafka Messages

```bash
docker exec -it redpanda rpk topic consume user-interactions --num 10
```

### Check PostgreSQL Data

```bash
docker exec -it postgres-warehouse psql -U postgres -d recommendations -c "
SELECT event_type, COUNT(*) 
FROM fact_user_interactions 
GROUP BY event_type;
"
```

### View Redis Cache

```bash
docker exec -it redis-cache redis-cli
> KEYS *
> GET trending:products:1h
```

## 🛠️ API Endpoints

### Event Tracking

**Track Product View:**
```bash
POST /api/track/view
{
  "productId": 1,
  "userId": "user123",
  "sessionId": "session456",
  "source": "search",
  "position": 1
}
```

**Track Product Click:**
```bash
POST /api/track/click
{
  "productId": 1,
  "userId": "user123",
  "sessionId": "session456"
}
```

**Track Add to Cart:**
```bash
POST /api/track/add-to-cart
{
  "productId": 1,
  "userId": "user123",
  "sessionId": "session456"
}
```

**Create Session:**
```bash
POST /api/session/start
{
  "userId": "user123",
  "userAgent": "Mozilla/5.0...",
  "referrer": "https://google.com"
}
```

## 🔧 Troubleshooting

### Kafka Connection Issues

If Kafka producer fails to connect:

1. Check Redpanda is running:
```bash
docker ps | grep redpanda
```

2. Check Redpanda logs:
```bash
docker logs redpanda
```

3. Verify broker is accessible:
```bash
docker exec -it redpanda rpk cluster info
```

### PostgreSQL Connection Issues

1. Check PostgreSQL is running:
```bash
docker ps | grep postgres
```

2. Test connection:
```bash
docker exec -it postgres-warehouse psql -U postgres -d recommendations -c "SELECT 1;"
```

### Event Streaming Disabled

If you want to run without Kafka (for testing):

Set in `.env`:
```env
ENABLE_EVENT_STREAMING=false
```

Events will be logged but not published to Kafka.

## 📈 Next Steps

### Phase 2: Spark Processing (Coming Next)

Once you have events flowing, we'll add:
- Real-time Spark streaming for trending products
- Batch feature engineering
- User-item interaction matrices

### Phase 3: ML Model Training (PyTorch)

- Neural Collaborative Filtering
- Matrix Factorization
- Model training pipeline

### Phase 4: Model Serving API

- FastAPI model server
- ML-powered recommendations
- A/B testing

## 🧹 Cleanup

### Stop All Services

```bash
npm run docker:down
```

### Remove All Data (Reset)

```bash
docker-compose down -v
```

This removes all volumes (Kafka data, PostgreSQL data, Redis data).

## 📚 Architecture

```
User Browser
    ↓
Express.js Server (Port 3000)
    ↓
Kafka Producer → Redpanda (Port 19092)
    ↓
Kafka Consumer → PostgreSQL (Port 5432)
    ↓
Data Warehouse (Star Schema)
```

## 🎯 Current Status

✅ **Phase 1 Complete:**
- Event streaming infrastructure (Kafka/Redpanda)
- Event schemas and validation
- Kafka producer in Express.js
- Kafka consumer for data ingestion
- PostgreSQL data warehouse with star schema
- Redis caching layer
- Event tracking API endpoints

🔄 **Next: Phase 2 - Spark Processing**

## 💡 Tips

1. **Monitor Redpanda Console**: http://localhost:8080 to see real-time events
2. **Check consumer logs** to verify data is being ingested
3. **Query materialized views** for pre-aggregated analytics
4. **Use Redis** for caching recommendations (Phase 5)

## 📞 Support

For issues or questions, check:
- Docker logs: `docker-compose logs -f`
- Application logs: Check terminal output
- Kafka topics: Redpanda Console at http://localhost:8080
