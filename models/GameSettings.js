const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const gameSettingsSchema = new Schema({
    spinTimer: { type: Number, default: 300 }, // Timer in seconds (5 minutes default)
    timerActive: { type: Boolean, default: false },
    autoSpin: { type: Boolean, default: false },
    currentSpinId: { type: Schema.Types.ObjectId, ref: 'Spin' },
    lastSpinDate: Date,
    nextSpinDate: Date,
    entriesPerShirt: { type: Number, default: 10 },
    maxEntriesPerUser: { type: Number, default: 1000 },
    gameActive: { type: Boolean, default: true },
    maintenanceMode: { type: Boolean, default: false },
    // Prize settings
    currentPrize: { type: String, default: 'iPhone 15 Pro Max' },
    prizeDescription: { type: String, default: 'Latest iPhone with 256GB storage' },
    // Countdown timer settings
    spinCountdownDays: { type: Number, default: 0 },
    spinCountdownHours: { type: Number, default: 0 },
    spinCountdownMinutes: { type: Number, default: 0 },
    // Game session timing
    gameStartTime: Date, // When the current game session started
    gameEndTime: Date, // When the current game session should end
    countdownActive: { type: Boolean, default: false }, // Whether countdown is currently running
    // Shopify integration
    shopifyStoreUrl: { type: String, default: '' },
    shopifyEnabled: { type: Boolean, default: false },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    updatedAt: { type: Date, default: Date.now }
});

const GameSettings = mongoose.model("GameSettings", gameSettingsSchema);
module.exports = GameSettings;
