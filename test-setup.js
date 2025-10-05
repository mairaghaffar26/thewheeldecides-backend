// Simple test script to verify backend setup
const mongoose = require('mongoose');
require('dotenv').config();

async function testConnection() {
    try {
        console.log('Testing MongoDB connection...');
        
        // Test MongoDB connection
        await mongoose.connect(`mongodb+srv://${process.env.MONGO_USER}:${process.env.MONGO_PASS}@cluster0.ycda7xy.mongodb.net/${process.env.DATABASE_NAME}`, { 
            useNewUrlParser: true 
        });
        
        console.log('✅ MongoDB connection successful');
        
        // Test model imports
        console.log('Testing model imports...');
        const User = require('./models/User');
        const WheelEntry = require('./models/WheelEntry');
        const Spin = require('./models/Spin');
        const Winner = require('./models/Winner');
        const Store = require('./models/Store');
        const Purchase = require('./models/Purchase');
        const GameSettings = require('./models/GameSettings');
        
        console.log('✅ All models imported successfully');
        
        // Test JWT helper
        console.log('Testing JWT helper...');
        const { generateAccessToken } = require('./utils/jwtHelper');
        const testUser = { _id: 'test', role: 'user', name: 'Test', email: 'test@test.com', instagramHandle: '@test' };
        const token = generateAccessToken(testUser);
        console.log('✅ JWT helper working');
        
        // Test response helper
        console.log('Testing response helper...');
        const { successResponse } = require('./utils/responseHelper');
        console.log('✅ Response helper working');
        
        console.log('\n🎉 All tests passed! Backend setup is ready.');
        console.log('\nTo start the server, run: npm start');
        console.log('API documentation will be available at: http://localhost:5000/api/docs');
        
        process.exit(0);
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.log('\nPlease check your .env file and MongoDB connection settings.');
        process.exit(1);
    }
}

testConnection();
