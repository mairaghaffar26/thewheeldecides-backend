const express = require('express')
const mongoose = require('mongoose')
const http = require('http');
const { Server } = require('socket.io');

// Import models at the top level
const GameSettings = require('./models/GameSettings');

// Import routes
const authRoute = require('./routes/auth');
const wheelRoute = require('./routes/wheel');
const storeRoute = require('./routes/store');
const adminRoute = require('./routes/admin');
const dashboardRoute = require('./routes/dashboard');
const purchaseCodeRoute = require('./routes/purchaseCode');
const superadminRoute = require('./routes/superadmin');
const platformSettingsRoute = require('./routes/platformSettings');

// Import middleware
const cors = require('cors');
require('dotenv').config()

const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');

const app = express()
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });
app.set('io', io);

// MongoDB connection
mongoose.connect(`mongodb+srv://${process.env.MONGO_USER}:${process.env.MONGO_PASS}@thewheeldecides.6hyslbr.mongodb.net/${process.env.DATABASE_NAME}`, { useNewUrlParser: true })

const db = mongoose.connection;

db.on('error', console.error.bind(console, 'connection error: '));
db.once('open', ()=>{
    console.log("MongoDB Connection Successful");
});

// Middleware
app.use(express.json());
app.use(cors({
  origin: '*'
}));

// Routes
app.use('/auth', authRoute);
app.use('/wheel', wheelRoute);
app.use('/store', storeRoute);
app.use('/admin', adminRoute);
app.use('/dashboard', dashboardRoute);
app.use('/purchase-codes', purchaseCodeRoute);
app.use('/superadmin', superadminRoute);
app.use('/platform-settings', platformSettingsRoute);

// Swagger configuration
const swaggerOptions = {
  swaggerDefinition: {
    openapi: '3.0.0',
    info: {
      title: 'The Wheel Decides Backend API',
      version: '1.0.0',
      description: 'API documentation for The Wheel Decides Backend - A gamified giveaway platform',
    },
    servers: [
      {
        url: `http://localhost:${process.env.PORT || 5000}`,
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  apis: ['./routes/*.js'],
};
 
const swaggerSpec = swaggerJsdoc(swaggerOptions);

app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Health check endpoint
app.get('/status', (req, res)=> {
    res.status(200).json({
        status: 'Up',
        frontend: process.env.FRONT_END_URL,
        timestamp: new Date().toISOString()
    })
})

// Socket.io for real-time updates
io.on('connection', (socket) => {
    console.log('User connected:', socket.id);
    
    // Join wheel room for real-time wheel updates
    socket.on('join-wheel', () => {
        socket.join('wheel');
    });
    
    // Join admin room for admin updates
    socket.on('join-admin', () => {
        socket.join('admin');
    });
    
    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
});

// Periodic countdown updates
let countdownInterval;

const startCountdownUpdates = () => {
    if (countdownInterval) {
        clearInterval(countdownInterval);
    }
    
    countdownInterval = setInterval(async () => {
        try {
            // Check if MongoDB is connected
            if (mongoose.connection.readyState !== 1) {
                console.log('MongoDB not connected, skipping countdown update');
                return;
            }
            
            const gameSettings = await GameSettings.findOne().maxTimeMS(5000);
            
            if (gameSettings && gameSettings.countdownActive && gameSettings.gameEndTime) {
                const now = new Date();
                const timeRemaining = Math.max(0, gameSettings.gameEndTime.getTime() - now.getTime());
                
                // Broadcast countdown update to all users
                io.to('wheel').emit('countdown-update', {
                    timeRemaining,
                    gameEndTime: gameSettings.gameEndTime,
                    countdownActive: gameSettings.countdownActive
                });
                
                // Check if countdown has expired
                if (timeRemaining <= 0) {
                    // Notify admin that countdown has expired
                    io.to('admin').emit('countdown-expired', {
                        message: 'Game countdown has expired! Time to spin the wheel.',
                        gameEndTime: gameSettings.gameEndTime
                    });
                    
                    // Update countdown status
                    gameSettings.countdownActive = false;
                    await gameSettings.save();
                }
            }
        } catch (error) {
            console.error('Error in countdown update:', error.message);
        }
    }, 1000); // Update every second
};

// Start countdown updates after MongoDB connection
mongoose.connection.on('connected', () => {
    console.log('MongoDB connected, starting countdown updates');
    startCountdownUpdates();
});

mongoose.connection.on('disconnected', () => {
    if (countdownInterval) {
        clearInterval(countdownInterval);
        countdownInterval = null;
    }
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server & WebSocket running on port ${PORT}`));
