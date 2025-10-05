const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const purchaseSchema = new Schema({
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    items: [{
        storeItemId: { type: Schema.Types.ObjectId, ref: 'Store', required: true },
        itemName: { type: String, required: true },
        quantity: { type: Number, required: true },
        price: { type: Number, required: true },
        entriesEarned: { type: Number, required: true }
    }],
    totalAmount: { type: Number, required: true },
    totalEntriesEarned: { type: Number, required: true },
    status: { 
        type: String, 
        enum: ["pending", "completed", "cancelled"], 
        default: "pending" 
    },
    purchaseDate: { type: Date, default: Date.now },
    paymentMethod: { type: String, default: "cash" },
    notes: String
});

const Purchase = mongoose.model("Purchase", purchaseSchema);
module.exports = Purchase;
