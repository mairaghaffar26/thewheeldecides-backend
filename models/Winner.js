const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const winnerSchema = new Schema({
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    userName: { type: String, required: true },
    spinId: { type: Schema.Types.ObjectId, ref: 'Spin', required: true },
    winDate: { type: Date, default: Date.now },
    prize: { type: String, default: "Mystery Prize" },
    claimed: { type: Boolean, default: false },
    claimDate: Date,
    notes: String
});

const Winner = mongoose.model("Winner", winnerSchema);
module.exports = Winner;
