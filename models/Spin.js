const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const spinSchema = new Schema({
    spinId: { type: String, required: true, unique: true },
    triggeredBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    spinType: { 
        type: String, 
        enum: ["manual", "timer"], 
        required: true 
    },
    totalEntries: { type: Number, required: true },
    participants: [{ 
        userId: { type: Schema.Types.ObjectId, ref: 'User' },
        userName: String,
        entryCount: Number
    }],
    winner: {
        userId: { type: Schema.Types.ObjectId, ref: 'User' },
        userName: String,
        entryCount: Number
    },
    status: { 
        type: String, 
        enum: ["pending", "completed", "cancelled"], 
        default: "pending" 
    },
    spinTime: { type: Date, default: Date.now },
    completedAt: Date,
    notes: String
});

const Spin = mongoose.model("Spin", spinSchema);
module.exports = Spin;
