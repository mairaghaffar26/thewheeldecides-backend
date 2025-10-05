const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const userSchema = new Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    instagramHandle: { type: String, required: true },
    country: { type: String, required: true },
    password: { type: String, required: true },
    role: { type: String, enum: ["super_admin", "user"], default: "user" },
    owner: { type: Boolean, default: false }, // Only for super_admin role - indicates if they can manage other superadmins
    avatar: { type: String, default: "https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_960_720.png" },
    blocked: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
    resetPasswordToken: String,
    resetPasswordExpires: Date,
    // Password change verification for admin
    passwordChangeToken: String,
    passwordChangeTokenExpiry: Date,
    passwordChangedAt: Date, // Track when password was last changed for session invalidation
    // Store-related fields
    totalShirtsPurchased: { type: Number, default: 0 },
    totalEntries: { type: Number, default: 1 }, // Default 1 entry for registration
    isWinner: { type: Boolean, default: false },
    lastWinDate: Date,
    congratsShown: { type: Boolean, default: false },
    // Purchase code tracking
    codesUsed: [{ 
        code: String, 
        usedDate: Date, 
        entriesAwarded: Number 
    }],
    totalCodesUsed: { type: Number, default: 0 },
    totalBonusEntries: { type: Number, default: 0 } // Entries from codes
});

// Update the updatedAt field before saving
userSchema.pre('save', function(next) {
    this.updatedAt = new Date();
    next();
});

const User = mongoose.model("User", userSchema);
module.exports = User;
