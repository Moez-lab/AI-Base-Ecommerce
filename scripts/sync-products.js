const { PrismaClient } = require('@prisma/client');
const { upsertProductToPinecone, isPineconeConfigured } = require('../utils/pinecone');
require('dotenv').config();

/**
 * Sync all products from SQLite to Pinecone
 * 
 * This script:
 * 1. Fetches all products from SQLite database
 * 2. Generates embeddings for each product
 * 3. Upserts them to Pinecone vector database
 * 
 * Usage: node scripts/sync-products.js
 */

async function syncProducts() {
    console.log('🔄 Syncing products to Pinecone...\n');

    // Check if Pinecone is configured
    if (!isPineconeConfigured()) {
        console.error('❌ Pinecone or OpenAI API keys not configured!');
        console.log('\n📝 Setup required:');
        console.log('1. Add PINECONE_API_KEY to .env');
        console.log('2. Add OPENAI_API_KEY to .env');
        console.log('3. Run: node scripts/setup-pinecone.js (if not done)');
        process.exit(1);
    }

    const prisma = new PrismaClient();

    try {
        // Fetch all products
        console.log('📦 Fetching products from database...');
        const products = await prisma.product.findMany();

        if (products.length === 0) {
            console.log('⚠️  No products found in database!');
            console.log('💡 Run: node prisma/seed.js to add sample products');
            process.exit(0);
        }

        console.log(`✅ Found ${products.length} products\n`);
        console.log('🔄 Generating embeddings and upserting to Pinecone...');
        console.log('   (This may take a minute)\n');

        let successCount = 0;
        let errorCount = 0;

        // Upsert each product
        for (let i = 0; i < products.length; i++) {
            const product = products[i];

            try {
                await upsertProductToPinecone(product);
                successCount++;

                // Progress indicator
                const progress = Math.round(((i + 1) / products.length) * 100);
                process.stdout.write(`\r   Progress: ${progress}% (${i + 1}/${products.length})`);

                // Rate limiting: wait 100ms between requests to avoid API limits
                await new Promise(resolve => setTimeout(resolve, 100));

            } catch (error) {
                errorCount++;
                console.error(`\n   ❌ Failed to sync product ${product.id}: ${error.message}`);
            }
        }

        console.log('\n');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📊 Sync Summary:');
        console.log(`   ✅ Success: ${successCount} products`);
        if (errorCount > 0) {
            console.log(`   ❌ Errors: ${errorCount} products`);
        }
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        if (successCount > 0) {
            console.log('🎉 Products synced to Pinecone successfully!');
            console.log('\n📝 Next step:');
            console.log('   Set USE_PINECONE=true in .env to enable vector search');
        }

    } catch (error) {
        console.error('❌ Error syncing products:', error.message);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

// Run sync
syncProducts();
