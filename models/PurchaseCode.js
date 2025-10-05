const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const purchaseCodeSchema = new Schema({
    code: { type: String, required: true, unique: true, uppercase: true },
    isUsed: { type: Boolean, default: false },
    usedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    usedDate: Date,
    entriesAwarded: { type: Number, default: 10 }, // Default 10 entries per shirt
    notes: String,
    createdAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, default: () => new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) } // 1 year expiry
});

// Index for faster lookups
purchaseCodeSchema.index({ code: 1 });
purchaseCodeSchema.index({ isUsed: 1 });
purchaseCodeSchema.index({ usedBy: 1 });

const PurchaseCode = mongoose.model("PurchaseCode", purchaseCodeSchema);
module.exports = PurchaseCode;