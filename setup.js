// Setup script to create .env file with correct configuration
const fs = require('fs');
const path = require('path');

const envContent = `# Database
MONGO_USER=basit
MONGO_PASS=123009111
DATABASE_NAME=farmhomedev

# JWT
JWT_SECRET=5h8ek389e784+eje&

# Server
PORT=5000
NODE_ENV=development

# Frontend URL
FRONT_END_URL=http://localhost:3000

# Email Configuration
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=USER MAIL
EMAIL_PASS=USER PASS

# Cloudinary Configuration
CLOUD_NAME=dtujbvq6o
API_KEY=311225729471782
API_SECRET=RDjRhTqDRHvPAXvHnj9TnMqyT9U
`;

const envPath = path.join(__dirname, '.env');

try {
    fs.writeFileSync(envPath, envContent);
    console.log('✅ .env file created successfully!');
    console.log('📝 Please update EMAIL_USER and EMAIL_PASS with your actual email credentials');
    console.log('🚀 You can now run: npm start');
} catch (error) {
    console.error('❌ Error creating .env file:', error.message);
}
