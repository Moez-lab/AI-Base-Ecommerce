const { Pinecone } = require('@pinecone-database/pinecone');
require('dotenv').config({ path: 'c:/Users/mueez/OneDrive/Desktop/chatbot/llm-web-app/.env' });

async function deleteIndex() {
    const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
    const indexName = process.env.PINECONE_INDEX_NAME || 'products';

    console.log(`Deleting index: ${indexName}...`);
    try {
        await pinecone.deleteIndex(indexName);
        console.log('✅ Index deleted successfully.');
    } catch (error) {
        if (error.name === 'PineconeNotFoundError') {
            console.log('✅ Index did not exist.');
        } else {
            console.error('❌ Error deleting index:', error);
        }
    }
}

deleteIndex();
