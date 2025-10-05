# The Wheel Decides - Backend API

A secure backend API for "The Wheel Decides" - A gamified giveaway platform with wheel spinning mechanics, user management, and store integration.

## Features

### Authentication & Roles
- **JWT Authentication** with access tokens (24h expiry)
- **Role-based access control**: SuperAdmin and User roles
- **SuperAdmin users** created via database (not environment variables)
- **User registration** with default User role
- **Password reset** functionality

### Wheel Spin Mechanism
- **Dynamic wheel entries** based on user registration and purchases
- **Real-time wheel spinning** with Socket.io integration
- **Winner declaration** with automatic notifications
- **Spin history** and statistics tracking
- **Timer-based spinning** (configurable by SuperAdmin)

### Store Integration
- **Shirt purchases** that increase wheel entries
- **Configurable entries per item** (default: 10 entries per shirt)
- **Purchase history** tracking
- **Inventory management** for SuperAdmin

### SuperAdmin Dashboard
- **Game settings management** (timer, auto-spin, maintenance mode)
- **User management** (block/unblock, entry management)
- **Manual winner declaration**
- **Real-time statistics** and monitoring
- **Game reset** functionality

### Real-time Features
- **Socket.io integration** for live updates
- **Real-time wheel spinning** notifications
- **Live winner announcements**
- **Settings updates** broadcast

## Tech Stack

- **Node.js** with Express.js
- **MongoDB** with Mongoose ODM
- **JWT** for authentication
- **Socket.io** for real-time communication
- **Swagger/OpenAPI** for documentation
- **bcryptjs** for password hashing
- **Nodemailer** for email notifications

## Project Structure

```
backend/
├── models/                 # Database models
│   ├── User.js            # User model with roles
│   ├── WheelEntry.js      # Wheel entry tracking
│   ├── Spin.js           # Spin records
│   ├── Winner.js         # Winner records
│   ├── Store.js          # Store items
│   ├── Purchase.js       # Purchase records
│   └── GameSettings.js   # Game configuration
├── middleware/            # Authentication middleware
│   ├── auth.js           # JWT authentication
│   ├── superadmin.js     # SuperAdmin role check
│   └── user.js           # User role check
├── routes/               # API routes
│   ├── auth.js          # Authentication routes
│   ├── wheel.js         # Wheel management
│   ├── store.js         # Store operations
│   ├── admin.js         # SuperAdmin dashboard
│   └── dashboard.js     # User dashboard
├── utils/               # Utility functions
│   ├── responseHelper.js # Standardized responses
│   ├── jwtHelper.js     # JWT utilities
│   └── emailHelper.js   # Email functions
├── server.js            # Main server file
├── package.json         # Dependencies
└── README.md           # Documentation
```

## Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   ```bash
   npm run setup
   ```
   
   This will create a `.env` file with the correct configuration. You only need to update the email credentials:
   - `EMAIL_USER`: Your email address
   - `EMAIL_PASS`: Your email password or app password

4. **Initialize data (creates SuperAdmin user)**
   ```bash
   npm run init-data
   ```
   This creates a SuperAdmin user with credentials:
   - Email: `admin@thewheeldecides.com`
   - Password: `SuperAdmin123!`

5. **Start the server**
   ```bash
   npm start
   # or for development
   npm run dev
   ```

## API Documentation

Once the server is running, visit `http://localhost:5000/api/docs` for interactive Swagger documentation.

## API Endpoints

### Authentication
- `POST /auth/signup` - User registration
- `POST /auth/signin` - User login (works for both users and SuperAdmins)
- `GET /auth/me` - Get current user profile
- `PATCH /auth/change-password` - Change password
- `POST /auth/forgot-password` - Request password reset

### Wheel Management
- `GET /wheel/entries` - Get all wheel entries
- `POST /wheel/spin` - Trigger manual spin (SuperAdmin)
- `GET /wheel/latest-winner` - Get latest winner
- `GET /wheel/check-winner` - Check if current user is winner
- `GET /wheel/spin-history` - Get spin history (SuperAdmin)
- `GET /wheel/stats` - Get wheel statistics

### Store
- `GET /store/items` - Get all store items
- `POST /store/purchase` - Purchase items
- `GET /store/purchases` - Get user's purchase history
- `POST /store/admin/items` - Create store item (SuperAdmin)
- `PUT /store/admin/items/:id` - Update store item (SuperAdmin)
- `DELETE /store/admin/items/:id` - Delete store item (SuperAdmin)
- `GET /store/admin/purchases` - Get all purchases (SuperAdmin)

### Admin Dashboard
- `GET /admin/dashboard` - Get admin dashboard data
- `GET /admin/settings` - Get game settings
- `PUT /admin/settings` - Update game settings
- `GET /admin/users` - Get all users
- `PATCH /admin/users/:id/block` - Block/unblock user
- `PATCH /admin/users/:id/entries` - Update user entries
- `POST /admin/declare-winner` - Manually declare winner
- `POST /admin/reset-game` - Reset game data

### Dashboard
- `GET /dashboard` - Get user dashboard data
- `GET /dashboard/leaderboard` - Get leaderboard
- `GET /dashboard/winners` - Get recent winners

## Authentication

All protected routes require a Bearer token in the Authorization header:
```
Authorization: Bearer <access_token>
```

## Response Format

All API responses follow a consistent format:

### Success Response
```json
{
  "success": true,
  "message": "Operation successful",
  "data": { ... },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### Error Response
```json
{
  "success": false,
  "message": "Error message",
  "error": "Detailed error information",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## Real-time Events

The API uses Socket.io for real-time communication:

### Client Events
- `join-wheel` - Join wheel room for updates
- `join-admin` - Join admin room for admin updates

### Server Events
- `spin-completed` - Emitted when a spin is completed
- `winner-declared` - Emitted when a winner is declared
- `settings-updated` - Emitted when game settings are updated

## Database Models

### User
- Basic user information with role-based access
- Entry tracking for wheel spins
- Purchase history and statistics

### WheelEntry
- Tracks individual wheel entries
- Links to users and entry types (registration/purchase)

### Spin
- Records of wheel spins
- Winner information and statistics
- Manual vs timer-triggered spins

### Winner
- Winner records with prize information
- Claim status and win dates

### Store
- Store items with pricing and entry values
- Inventory management

### Purchase
- Purchase records with item details
- Entry calculations and payment tracking

### GameSettings
- Configurable game parameters
- Timer settings and maintenance mode

## Security Features

- **JWT-based authentication** with access and refresh tokens
- **Password hashing** using bcryptjs
- **Role-based access control** for different user types
- **Input validation** and sanitization
- **CORS configuration** for cross-origin requests
- **Environment variable protection** for sensitive data

## Development

### Adding New Features
1. Create models in `models/` directory
2. Add middleware in `middleware/` directory if needed
3. Create routes in `routes/` directory
4. Update Swagger documentation
5. Test endpoints thoroughly

### Error Handling
- Use the response helper functions for consistent error responses
- Log errors appropriately for debugging
- Return appropriate HTTP status codes

## Deployment

1. Set up MongoDB Atlas or local MongoDB instance
2. Configure environment variables for production
3. Update CORS settings for production domain
4. Set up email service for notifications
5. Deploy to your preferred hosting platform

## Contributing

1. Follow the existing code structure and patterns
2. Add proper Swagger documentation for new endpoints
3. Include error handling and validation
4. Test all functionality thoroughly
5. Update README if adding new features

## License

This project is licensed under the ISC License.
