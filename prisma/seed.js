const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const products = [
    // Electronics
    {
        name: 'Premium Wireless Headphones',
        description: 'High-quality over-ear wireless headphones with active noise cancellation, 30-hour battery life, and premium sound quality. Perfect for music lovers and professionals.',
        price: 299.99,
        category: 'Electronics',
        stock: 45,
        imageUrl: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500'
    },
    {
        name: 'Ultra HD 4K Smart TV 55"',
        description: '55-inch 4K Ultra HD Smart TV with HDR, built-in streaming apps, voice control, and stunning picture quality. Transform your living room entertainment.',
        price: 799.99,
        category: 'Electronics',
        stock: 20,
        imageUrl: 'https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?w=500'
    },
    {
        name: 'Gaming Laptop Pro',
        description: 'High-performance gaming laptop with RTX 4070 graphics, Intel i9 processor, 32GB RAM, 1TB SSD. Dominate any game with ultra settings.',
        price: 1899.99,
        category: 'Electronics',
        stock: 15,
        imageUrl: 'https://images.unsplash.com/photo-1603302576837-37561b2e2302?w=500'
    },
    {
        name: 'Smartphone X Pro',
        description: 'Latest flagship smartphone with 6.7" OLED display, 108MP camera, 5G connectivity, and all-day battery life. Capture life in stunning detail.',
        price: 999.99,
        category: 'Electronics',
        stock: 60,
        imageUrl: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=500'
    },
    {
        name: 'Wireless Bluetooth Speaker',
        description: 'Portable waterproof Bluetooth speaker with 360-degree sound, 12-hour battery, and deep bass. Perfect for outdoor adventures.',
        price: 89.99,
        category: 'Electronics',
        stock: 100,
        imageUrl: 'https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=500'
    },

    // Clothing
    {
        name: 'Classic Denim Jacket',
        description: 'Timeless denim jacket made from premium cotton. Features classic button closure, chest pockets, and versatile styling. Available in multiple sizes.',
        price: 79.99,
        category: 'Clothing',
        stock: 75,
        imageUrl: 'https://images.unsplash.com/photo-1576995853123-5a10305d93c0?w=500'
    },
    {
        name: 'Premium Cotton T-Shirt Pack',
        description: 'Pack of 3 high-quality cotton t-shirts in classic colors. Soft, breathable, and perfect for everyday wear. Pre-shrunk and machine washable.',
        price: 39.99,
        category: 'Clothing',
        stock: 150,
        imageUrl: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=500'
    },
    {
        name: 'Running Shoes Elite',
        description: 'Professional running shoes with advanced cushioning, breathable mesh upper, and superior grip. Engineered for performance and comfort.',
        price: 129.99,
        category: 'Clothing',
        stock: 80,
        imageUrl: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=500'
    },
    {
        name: 'Winter Puffer Jacket',
        description: 'Warm insulated puffer jacket with water-resistant exterior, hood, and multiple pockets. Stay cozy in cold weather.',
        price: 149.99,
        category: 'Clothing',
        stock: 40,
        imageUrl: 'https://images.unsplash.com/photo-1539533018447-63fcce2678e3?w=500'
    },
    {
        name: 'Yoga Pants Premium',
        description: 'High-waisted yoga pants with moisture-wicking fabric, four-way stretch, and flattering fit. Perfect for workouts or casual wear.',
        price: 59.99,
        category: 'Clothing',
        stock: 90,
        imageUrl: 'https://images.unsplash.com/photo-1506629082955-511b1aa562c8?w=500'
    },

    // Home & Living
    {
        name: 'Smart Coffee Maker',
        description: 'Programmable coffee maker with built-in grinder, WiFi connectivity, and app control. Wake up to freshly brewed coffee every morning.',
        price: 199.99,
        category: 'Home',
        stock: 35,
        imageUrl: 'https://images.unsplash.com/photo-1517668808822-9ebb02f2a0e6?w=500'
    },
    {
        name: 'Memory Foam Pillow Set',
        description: 'Set of 2 ergonomic memory foam pillows with cooling gel technology. Provides optimal neck support and comfortable sleep.',
        price: 69.99,
        category: 'Home',
        stock: 120,
        imageUrl: 'https://images.unsplash.com/photo-1584100936595-c0654b55a2e2?w=500'
    },
    {
        name: 'Robot Vacuum Cleaner',
        description: 'Smart robot vacuum with mapping technology, app control, and automatic charging. Keeps your floors spotless with minimal effort.',
        price: 349.99,
        category: 'Home',
        stock: 25,
        imageUrl: 'https://images.unsplash.com/photo-1558317374-067fb5f30001?w=500'
    },
    {
        name: 'Air Purifier HEPA',
        description: 'Advanced air purifier with true HEPA filter, removes 99.97% of allergens, dust, and pollutants. Quiet operation and smart sensors.',
        price: 249.99,
        category: 'Home',
        stock: 50,
        imageUrl: 'https://images.unsplash.com/photo-1585771724684-38269d6639fd?w=500'
    },
    {
        name: 'Luxury Bed Sheet Set',
        description: 'Egyptian cotton bed sheet set with 800 thread count. Includes fitted sheet, flat sheet, and pillowcases. Hotel-quality comfort.',
        price: 119.99,
        category: 'Home',
        stock: 65,
        imageUrl: 'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=500'
    },

    // Sports & Fitness
    {
        name: 'Adjustable Dumbbell Set',
        description: 'Space-saving adjustable dumbbells with weight range 5-52.5 lbs per dumbbell. Perfect for home gym workouts.',
        price: 299.99,
        category: 'Sports',
        stock: 30,
        imageUrl: 'https://images.unsplash.com/photo-1571902943202-507ec2618e8f?w=500'
    },
    {
        name: 'Yoga Mat Premium',
        description: 'Extra-thick non-slip yoga mat with carrying strap. Eco-friendly material, perfect cushioning for all yoga styles.',
        price: 49.99,
        category: 'Sports',
        stock: 110,
        imageUrl: 'https://images.unsplash.com/photo-1601925260368-ae2f83cf8b7f?w=500'
    },
    {
        name: 'Fitness Tracker Watch',
        description: 'Advanced fitness tracker with heart rate monitor, sleep tracking, GPS, and 7-day battery life. Track your health goals.',
        price: 179.99,
        category: 'Sports',
        stock: 70,
        imageUrl: 'https://images.unsplash.com/photo-1575311373937-040b8e1fd5b6?w=500'
    },
    {
        name: 'Resistance Bands Set',
        description: 'Set of 5 resistance bands with different strength levels, door anchor, and carrying bag. Full-body workout anywhere.',
        price: 29.99,
        category: 'Sports',
        stock: 200,
        imageUrl: 'https://images.unsplash.com/photo-1598289431512-b97b0917affc?w=500'
    },
    {
        name: 'Protein Shaker Bottle',
        description: 'Leak-proof protein shaker with mixing ball, measurement marks, and BPA-free material. Essential for fitness enthusiasts.',
        price: 14.99,
        category: 'Sports',
        stock: 250,
        imageUrl: 'https://images.unsplash.com/photo-1622484211850-cc2f0e495b7e?w=500'
    }
];

async function main() {
    console.log('🌱 Starting database seed...');

    // Clear existing products
    await prisma.product.deleteMany({});
    console.log('🗑️  Cleared existing products');

    // Create products
    for (const product of products) {
        await prisma.product.create({
            data: product
        });
    }

    console.log(`✅ Seeded ${products.length} products successfully!`);

    // Display summary
    const productCount = await prisma.product.count();
    const categories = await prisma.product.groupBy({
        by: ['category'],
        _count: true
    });

    console.log(`\n📊 Database Summary:`);
    console.log(`   Total Products: ${productCount}`);
    console.log(`   Categories:`);
    categories.forEach(cat => {
        console.log(`     - ${cat.category}: ${cat._count} products`);
    });
}

main()
    .catch((e) => {
        console.error('❌ Error seeding database:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
