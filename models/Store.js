const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const storeSchema = new Schema({
    name: { type: String, required: true },
    description: { type: String, required: true },
    price: { type: Number, required: true },
    entriesPerItem: { type: Number, required: true }, // How many wheel entries each item gives
    image: { type: String },
    category: { type: String, enum: ["shirt", "merchandise", "other"], default: "shirt" },
    active: { type: Boolean, default: true },
    stock: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

// Update the updatedAt field before saving
storeSchema.pre('save', function(next) {
    this.updatedAt = new Date();
    next();
});

const Store = mongoose.model("Store", storeSchema);
module.exports = Store;
