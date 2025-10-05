const mongoose = require('mongoose');
const PurchaseCode = require('../models/PurchaseCode');
const crypto = require('crypto');

// Connect to MongoDB
const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost/wheeldeckides');
        console.log('✅ Connected to MongoDB');
    } catch (error) {
        console.error('❌ MongoDB connection error:', error);
        process.exit(1);
    }
};

// Generate unique alphanumeric code
const generateCode = (length = 8) => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
};

// Ensure code is unique in database
const generateUniqueCode = async () => {
    let code;
    let isUnique = false;
    
    while (!isUnique) {
        code = generateCode();
        const existing = await PurchaseCode.findOne({ code });
        if (!existing) {
            isUnique = true;
        }
    }
    
    return code;
};

// Generate and insert purchase codes
const generatePurchaseCodes = async (count = 200) => {
    try {
        console.log(`🎫 Generating ${count} unique purchase codes...`);
        
        // Clear existing codes (optional - uncomment if you want to reset)
        // await PurchaseCode.deleteMany({});
        // console.log('🗑️ Cleared existing codes');
        
        const codes = [];
        const existingCount = await PurchaseCode.countDocuments();
        
        console.log(`📊 Existing codes in database: ${existingCount}`);
        
        // Generate only the codes we need
        const codesToGenerate = Math.max(0, count - existingCount);
        
        if (codesToGenerate === 0) {
            console.log('✅ Already have enough codes in database!');
            return;
        }
        
        console.log(`🔄 Generating ${codesToGenerate} new codes...`);
        
        for (let i = 0; i < codesToGenerate; i++) {
            const code = await generateUniqueCode();
            codes.push({
                code,
                isUsed: false,
                entriesAwarded: 10 // Default 10 entries per shirt
            });
            
            if (i % 20 === 0) {
                console.log(`📝 Generated ${i + 1}/${codesToGenerate} codes...`);
            }
        }
        
        // Insert codes in batches
        if (codes.length > 0) {
            await PurchaseCode.insertMany(codes);
            console.log(`✅ Successfully inserted ${codes.length} purchase codes!`);
        }
        
        // Display summary
        const totalCodes = await PurchaseCode.countDocuments();
        const usedCodes = await PurchaseCode.countDocuments({ isUsed: true });
        const availableCodes = totalCodes - usedCodes;
        
        console.log('\n📊 SUMMARY:');
        console.log(`Total Codes: ${totalCodes}`);
        console.log(`Used Codes: ${usedCodes}`);
        console.log(`Available Codes: ${availableCodes}`);
        
        // Show first 10 codes as example
        const sampleCodes = await PurchaseCode.find({ isUsed: false }).limit(10).select('code');
        console.log('\n🔑 Sample Available Codes:');
        sampleCodes.forEach((codeDoc, index) => {
            console.log(`${index + 1}. ${codeDoc.code}`);
        });
        
    } catch (error) {
        console.error('❌ Error generating purchase codes:', error);
    }
};

// Run if called directly
if (require.main === module) {
    (async () => {
        await connectDB();
        await generatePurchaseCodes(200);
        process.exit(0);
    })();
}

module.exports = { generatePurchaseCodes, generateUniqueCode };