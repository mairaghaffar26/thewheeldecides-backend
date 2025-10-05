const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const wheelEntrySchema = new Schema({
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    userName: { type: String, required: true },
    entryType: { 
        type: String, 
        enum: ["registration", "shirt_purchase"], 
        default: "registration" 
    },
    shirtQuantity: { type: Number, default: 0 }, // Number of shirts that generated this entry
    createdAt: { type: Date, default: Date.now }
});

const WheelEntry = mongoose.model("WheelEntry", wheelEntrySchema);
module.exports = WheelEntry;
