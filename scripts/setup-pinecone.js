const { Pinecone } = require('@pinecone-database/pinecone');
require('dotenv').config();

/**
 * Setup Pinecone Index
 * Run this script once to create the Pinecone index
 * 
 * Usage: node scripts/setup-pinecone.js
 */

async function setupPinecone() {
    console.log('🚀 Setting up Pinecone index...\n');

    // Validate environment variables
    if (!process.env.PINECONE_API_KEY || process.env.PINECONE_API_KEY === 'your_pinecone_api_key_here') {
        console.error('❌ Error: PINECONE_API_KEY not configured in .env file');
        console.log('\n📝 To fix this:');
        console.log('1. Sign up at https://app.pinecone.io');
        console.log('2. Create an API key');
        console.log('3. Add it to your .env file: PINECONE_API_KEY=your_actual_key');
        process.exit(1);
    }

    const indexName = process.env.PINECONE_INDEX_NAME || 'ecommerce-products';

    try {
        const pinecone = new Pinecone({
            apiKey: process.env.PINECONE_API_KEY
        });

        console.log('📋 Checking existing indexes...');
        const indexes = await pinecone.listIndexes();

        // Check if index already exists
        const existingIndex = indexes.indexes?.find(idx => idx.name === indexName);

        if (existingIndex) {
            console.log(`✅ Index "${indexName}" already exists!`);
            console.log(`   Dimension: ${existingIndex.dimension}`);
            console.log(`   Metric: ${existingIndex.metric}`);
            console.log(`   Status: ${existingIndex.status?.state || 'Ready'}`);
            return;
        }

        console.log(`📦 Creating new index: "${indexName}"...`);

        await pinecone.createIndex({
            name: indexName,
            dimension: 3072, // Gemini gemini-embedding-001 dimension
            metric: 'cosine',
            spec: {
                serverless: {
                    cloud: 'aws',
                    region: 'us-east-1'
                }
            }
        });

        console.log('⏳ Waiting for index to be ready...');

        // Wait for index to be ready
        let ready = false;
        let attempts = 0;
        const maxAttempts = 30;

        while (!ready && attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds

            const updatedIndexes = await pinecone.listIndexes();
            const currentIndex = updatedIndexes.indexes?.find(idx => idx.name === indexName);

            if (currentIndex?.status?.state === 'Ready') {
                ready = true;
            }

            attempts++;
            process.stdout.write('.');
        }

        console.log('\n');

        if (ready) {
            console.log('✅ Index created successfully!');
            console.log(`\n📊 Index Details:`);
            console.log(`   Name: ${indexName}`);
            console.log(`   Dimension: 3072`);
            console.log(`   Metric: cosine`);
            console.log(`   Cloud: AWS (us-east-1)`);
            console.log('\n🎉 Pinecone setup complete!');
            console.log('\n📝 Next steps:');
            console.log('1. Run: npm run pinecone:sync');
            console.log('2. Set USE_PINECONE=true in .env');
        } else {
            console.log('⚠️  Index creation timed out. Please check Pinecone dashboard.');
        }

    } catch (error) {
        console.error('❌ Error setting up Pinecone:', error.message);

        if (error.message.includes('INVALID_ARGUMENT')) {
            console.log('\n💡 Tip: Make sure your Pinecone API key is valid');
        } else if (error.message.includes('quota')) {
            console.log('\n💡 Tip: You may have reached your free tier limit');
        }

        process.exit(1);
    }
}

// Run setup
setupPinecone();
