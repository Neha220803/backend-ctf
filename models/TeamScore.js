// models/TeamScore.js
const mongoose = require("mongoose");

const TeamScoreSchema = new mongoose.Schema({
  teamid: {
    type: String,
    required: true,
    index: true,
  },
  points: {
    type: Number,
    default: 0,
  },
  completedChallenges: {
    type: [String],
    default: [],
  },
  lastUpdated: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("TeamScore", TeamScoreSchema);
