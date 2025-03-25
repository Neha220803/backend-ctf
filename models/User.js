// models/User.js
const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const userSchema = new Schema({
  email: {
    type: String,
    required: true,
    unique: true,
  },
  password: {
    type: String,
    required: true,
  },
  teamid: {
    type: String,
    required: true,
    unique: true,
  },
  // Add the new fields
  mobile1: {
    type: String,
    required: true,
  },
  mobile2: {
    type: String,
    required: true,
  },
  aadhar1: {
    type: String,
    required: true,
  },
  aadhar2: {
    type: String,
    required: true,
  },
  // Optional: add creation timestamp
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("User", userSchema);
