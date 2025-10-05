// Initialize default data for the application
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const User = require('./models/User');
const Store = require('./models/Store');
const GameSettings = require('./models/GameSettings');
const PlatformSettings = require('./models/PlatformSettings');

async function initializeData() {
    try {
        console.log('Initializing default data...');
        
        // Connect to MongoDB
        await mongoose.connect(`mongodb+srv://${process.env.MONGO_USER}:${process.env.MONGO_PASS}@thewheeldecides.6hyslbr.mongodb.net/${process.env.DATABASE_NAME}`, { 
            useNewUrlParser: true 
        });
        
        console.log('✅ Connected to MongoDB');
        
        // Create SuperAdmin user if it doesn't exist
        const existingSuperAdmin = await User.findOne({ role: 'super_admin' });
        if (!existingSuperAdmin) {
            const superAdmin = new User({
                name: 'Super Admin',
                email: 'admin@thewheeldecides.com',
                instagramHandle: '@superadmin',
                country: 'Global',
                password: await bcrypt.hash('SuperAdmin123!', 10),
                role: 'super_admin',
                owner: true // Set as owner superadmin
            });
            await superAdmin.save();
            console.log('✅ SuperAdmin user created');
        } else {
            // Update existing superadmin to be owner if not already
            if (!existingSuperAdmin.owner) {
                existingSuperAdmin.owner = true;
                await existingSuperAdmin.save();
                console.log('✅ Existing SuperAdmin updated to owner');
            }
            console.log('✅ SuperAdmin user already exists');
        }
        
        // Create default game settings if they don't exist
        const existingSettings = await GameSettings.findOne();
        if (!existingSettings) {
            const gameSettings = new GameSettings({
                spinTimer: 300, // 5 minutes
                timerActive: false,
                autoSpin: false,
                entriesPerShirt: 10,
                gameActive: true,
                maintenanceMode: false
            });
            await gameSettings.save();
            console.log('✅ Default game settings created');
        } else {
            console.log('✅ Game settings already exist');
        }
        
        // Create default store items if they don't exist
        const existingItems = await Store.countDocuments();
        if (existingItems === 0) {
            const defaultItems = [
                {
                    name: 'The Wheel Decides T-Shirt',
                    description: 'Premium cotton t-shirt with The Wheel Decides logo',
                    price: 25.99,
                    entriesPerItem: 10,
                    category: 'shirt',
                    stock: 100,
                    image: 'https://via.placeholder.com/300x300?text=T-Shirt'
                },
                {
                    name: 'Hoodie',
                    description: 'Comfortable hoodie for ultimate comfort',
                    price: 45.99,
                    entriesPerItem: 20,
                    category: 'shirt',
                    stock: 50,
                    image: 'https://via.placeholder.com/300x300?text=Hoodie'
                },
                {
                    name: 'Cap',
                    description: 'Stylish cap with embroidered logo',
                    price: 19.99,
                    entriesPerItem: 5,
                    category: 'merchandise',
                    stock: 75,
                    image: 'https://via.placeholder.com/300x300?text=Cap'
                }
            ];
            
            await Store.insertMany(defaultItems);
            console.log('✅ Default store items created');
        } else {
            console.log('✅ Store items already exist');
        }
        
        // Create default Platform Settings
        const existingPlatformSettings = await PlatformSettings.findOne();
        if (!existingPlatformSettings) {
            const platformSettings = new PlatformSettings({
                platformName: 'The Wheel Decides',
                platformDescription: 'Spin to win amazing prizes!',
                contactEmail: 'admin@thewheeldecides.com',
                supportEmail: 'support@thewheeldecides.com',
                defaultEntriesPerUser: 1,
                maxEntriesPerUser: 1000,
                entriesPerShirt: 10,
                entriesPerHoodie: 20,
                entriesPerCap: 5,
                wheelSpinDuration: 5,
                autoSpinEnabled: false,
                maintenanceMode: false,
                defaultPrize: 'Mystery Prize',
                prizeDescription: 'Amazing prizes await!',
                emailNotifications: true,
                smsNotifications: false,
                winnerNotifications: true,
                newUserNotifications: true,
                requireEmailVerification: false,
                allowMultipleAccounts: true,
                maxLoginAttempts: 5,
                sessionTimeout: 24,
                shopifyEnabled: false,
                facebookUrl: '',
                instagramUrl: '',
                twitterUrl: ''
            });
            await platformSettings.save();
            console.log('✅ Default platform settings created');
        } else {
            console.log('✅ Platform settings already exist');
        }
        
        console.log('\n🎉 Data initialization completed successfully!');
        console.log('\nYou can now start the server with: npm start');
        
        process.exit(0);
        
    } catch (error) {
        console.error('❌ Initialization failed:', error.message);
        process.exit(1);
    }
}

initializeData();
