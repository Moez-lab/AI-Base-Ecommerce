# 🛒 Smart Shop AI - LLM E-commerce Assistant

Smart Shop AI is an intelligent e-commerce platform that leverages Large Language Models (LLMs) and Vector Search to provide a personalized shopping experience. It features a conversational AI assistant, hybrid search capabilities, and a real-time analytics pipeline powered by Apache Kafka.

## ✨ Features

- **🤖 AI Shopping Assistant**: Powered by **Groq (Llama 3)** and **Pinecone**, the chatbot understands natural language queries and provides product recommendations using Retrieval-Augmented Generation (RAG).
- **🔍 Hybrid Search**: Combines **Vector Similarity Search** (semantic understanding) with **Keyword Search** fallback for precise product discovery.
- **🎯 Recommendation Engine**:
  - **Personalized Recommendations** based on user history.
  - **Frequently Viewed Together** suggestions.
  - **Trending Products** based on real-time activity.
  - **Similar Products** using vector embeddings.
- **📊 Real-time Analytics Pipeline**: Tracks user interactions (Product Views, Clicks, Add to Cart, Session Start) using **Apache Kafka** and processes them into a **PostgreSQL Data Warehouse**.
- **⚡ Modern Tech Stack**: Built with Node.js, Express, React, and Docker.

## 🛠️ Tech Stack

- **Frontend**: React, Vite, Tailwind CSS, Lucide Icons.
- **Backend**: Node.js, Express.js.
- **Database**:
  - **SQLite** (via Prisma): Primary Product Catalog.
  - **PostgreSQL**: Analytics Data Warehouse.
  - **Pinecone**: Vector Database for product embeddings.
  - **Redis**: Session Store & Caching.
- **Infrastructure**: Docker, Docker Compose, Apache Kafka, Zookeeper.
- **AI/ML**: Groq SDK (Llama 3), Transformers.js (Embeddings), Pinecone SDK.

## 📋 Prerequisites

Ensure you have the following installed:
- **Node.js** (v18 or higher)
- **Docker** & **Docker Compose**
- **Git**

You will also need:
- A **Groq API Key** (for LLM inference).
- A **Pinecone API Key** & Index (for vector search).

## 🚀 Installation & Setup

### 1. Clone the Repository
```bash
git clone https://github.com/your-username/llm-web-app.git
cd llm-web-app
```

### 2. Configure Environment Variables
Create a `.env` file in the root directory and add your keys (use `.env.example` as a reference):
```env
PORT=3000
GROQ_API_KEY=your_groq_api_key
PINECONE_API_KEY=your_pinecone_api_key
PINECONE_INDEX=your_index_name
PINECONE_ENV=your_pinecone_environment
DATABASE_URL="file:./dev.db" # For SQLite Product Catalog
# Add Kafka/Redis/Postgres configs as needed
```

### 3. Start Infrastructure
Start the required services (Kafka, Zookeeper, Redis, Postgres) using Docker:
```bash
npm run docker:up
```
*Wait a few moments for all containers to initialize.*

### 4. Install Dependencies
Install backend and frontend dependencies:
```bash
# Backend
npm install

# Frontend
cd frontend
npm install
cd ..
```

### 5. Initialize Databases
Set up the Product Catalog (SQLite) and Analytics Warehouse (Postgres):

**Product Catalog:**
```bash
npx prisma db push
# Optional: Seed data if a seed script exists
# npx prisma db seed 
```

**Analytics Warehouse:**
```bash
npm run warehouse:init
```

### 6. Setup Vector Search
Initialize Pinecone index and sync product embeddings:
```bash
npm run pinecone:setup  # Creates index if not exists
npm run pinecone:sync   # Generates embeddings for products
```

## 🏃 Running the Application

You will need to run three processes (concurrently or in separate terminals):

### 1. Backend Server
```bash
npm run dev
# Server runs at http://localhost:3000
```

### 2. Frontend Application
```bash
cd frontend
npm run dev
# App runs at http://localhost:5173
```

### 3. Event Consumer (Analytics)
Starts the Kafka consumer to process user events:
```bash
npm run consumer:start
```

## 📂 Project Structure

- **`consumers/`**: Kafka consumer scripts for processing events.
- **`frontend/`**: React application source code.
- **`prisma/`**: Prisma schema and SQLite database file.
- **`scripts/`**: Utility scripts for Pinecone setup and data syncing.
- **`utils/`**: Helper functions for Kafka, Recommender, and AI logic.
- **`warehouse/`**: SQL schemas for the analytics data warehouse.
- **`server.js`**: Main Express backend server.
- **`docker-compose.yml`**: Docker configuration for infrastructure services.

## 🔗 API Endpoints

- **`GET /api/products`**: Fetch all products.
- **`POST /api/chat`**: Send a message to the AI assistant.
- **`GET /api/recommendations/trending`**: Get trending products.
- **`GET /api/recommendations/personalized/:userId`**: Get user-specific recommendations.
- **`POST /api/track/view`**: Track a product view event.

## 🤝 Contributing

Contributions are welcome! Please open an issue or submit a pull request.

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request
