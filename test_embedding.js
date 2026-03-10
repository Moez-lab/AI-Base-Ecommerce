const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config({ path: '.env' });

async function testEmbedding() {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    try {
        const model = genAI.getGenerativeModel({ model: 'gemini-embedding-001' });
        const result = await model.embedContent('Hello world');
        console.log('Embedding dimension:', result.embedding.values.length);
    } catch (e) {
        console.error(e);
    }
}

testEmbedding();
