const cors = require("cors");
const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const jwt = require("jsonwebtoken");
const User = require("./models/User");
const TeamScore = require("./models/TeamScore");
const cookieParser = require("cookie-parser");
const { challengeFlags, challengePoints } = require("./data/challenge_info");
require("dotenv").config();

// Add this environment variable to your .env file:
// JWT_SECRET=your_jwt_secret_key_here

const app = express();
app.use(
  cors({
    origin: [
      "http://localhost:3000",
      "https://neha220803.github.io/ctf-frontend-react/",
    ],
    credentials: true,
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.options("*", cors());

mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("MongoDB Atlas Connected"))
  .catch((err) => console.log("MongoDB Connection Error:", err));

// Add detailed MongoDB connection monitoring
mongoose.connection.on("connected", async () => {
  console.log("MongoDB connected successfully");

  // Check if there are any TeamScore records
  try {
    const count = await TeamScore.countDocuments();
    const countUsers = await User.countDocuments();
    if (countUsers > 0) {
      console.log(`User collection has ${countUsers} documents`);
    }

    if (count > 0) {
      console.log(`TeamScore collection has ${count} documents`);
    }
  } catch (err) {
    console.error("Error checking TeamScore collection:", err);
  }
});

mongoose.connection.on("error", (err) => {
  console.error("MongoDB connection error:", err);
});

mongoose.connection.on("disconnected", () => {
  console.log("MongoDB disconnected");
});

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());

// Add these specific preflight handlers before your routes
app.options("/api/login", cors());
app.options("/api/signup", cors());
app.options("/api/logout", cors());
app.options("/api/team-score", cors());
app.options("/api/submit-flag", cors());
app.options("/api/leaderboard", cors());

// Generate JWT token - no expiry
const generateToken = (user) => {
  return jwt.sign(
    { id: user.id, email: user.email, teamid: user.teamid },
    process.env.JWT_SECRET
  );
};

// Authentication middleware using JWT
const authenticateToken = (req, res, next) => {
  console.log("Authenticating request");

  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    console.log("No token provided");
    return res
      .status(401)
      .json({ message: "Not authenticated", status: "error" });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      console.log("Token verification failed:", err.message);
      return res
        .status(403)
        .json({ message: "Token invalid", status: "error" });
    }

    console.log(`User authenticated: ${user.email}, Team ID: ${user.teamid}`);
    req.user = user;
    next();
  });
};

app.post("/api/signup", async (req, res) => {
  console.log("Signup attempt:", req.body.email);
  const { email, password } = req.body;
  if (!email || !password) {
    console.log("Signup missing fields");
    return res
      .status(400)
      .json({ message: "Missing required fields", status: "error" });
  }
  try {
    let user = await User.findOne({ email });
    if (user) {
      console.log(`User already exists: ${email}`);
      return res
        .status(400)
        .json({ message: "User already exists", status: "error" });
    }
    const teamid = `team-${Math.random().toString(36).slice(2, 11)}`;
    user = new User({ email, password, teamid });
    await user.save();
    console.log(`User created: ${email}, Team ID: ${teamid}`);
    res.json({ message: "Signup successful", status: "success" });
  } catch (err) {
    console.error(`Signup error for ${email}:`, err);
    res.status(500).json({
      message: "Error signing up",
      status: "error",
      error: err.message,
    });
  }
});

app.post("/api/login", async (req, res) => {
  console.log("Login attempt:", req.body.email);
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });

    if (!user) {
      console.log(`User not found: ${email}`);
      return res
        .status(401)
        .json({ message: "User not found", status: "error" });
    }

    if (user.password !== password) {
      console.log(`Incorrect password for: ${email}`);
      return res
        .status(401)
        .json({ message: "Incorrect password", status: "error" });
    }

    // Generate token without expiry
    const token = generateToken(user);

    console.log(`Login successful: ${user.email}, Team ID: ${user.teamid}`);
    res.json({
      message: "Login successful",
      status: "success",
      teamid: user.teamid,
      token: token,
    });
  } catch (err) {
    console.error(`Login error for ${email}:`, err);
    res.status(500).json({
      message: "Error during login",
      status: "error",
      error: err.message,
    });
  }
});

// Simple logout endpoint - client-side will handle token removal
app.post("/api/logout", (req, res) => {
  console.log("Logout request received");
  res.status(200).json({ message: "Logout successful", status: "success" });
});

// Add the team-score endpoint
app.get("/api/team-score", authenticateToken, async (req, res) => {
  console.log(
    `Team score request for: ${req.user.email}, Team ID: ${req.user.teamid}`
  );
  try {
    const teamid = req.user.teamid;
    const teamScore = await TeamScore.findOne({ teamid });

    if (!teamScore) {
      console.log(`No team score found for team ID: ${teamid}`);
      return res.json({ points: 0, completedChallenges: [] });
    }

    console.log(`Team score found for ${teamid}:`, teamScore);
    res.json(teamScore);
  } catch (err) {
    console.error(`Error fetching team score for ${req.user.teamid}:`, err);
    res
      .status(500)
      .json({ message: "Error fetching team score", error: err.message });
  }
});

app.post("/api/submit-flag", authenticateToken, async (req, res) => {
  console.log(
    `Flag submission from: ${req.user.email}, Team ID: ${req.user.teamid}`
  );
  console.log("Received data:", req.body);
  const { challengeId, flag } = req.body;
  const teamid = req.user.teamid;

  if (!teamid || !challengeId || !flag) {
    console.log("Missing required fields in flag submission");
    return res
      .status(400)
      .json({ message: "Missing required fields", status: "error" });
  }

  const isCorrect = challengeFlags[challengeId] === flag;
  console.log(
    `Flag submission for ${challengeId}: ${isCorrect ? "CORRECT" : "INCORRECT"}`
  );

  if (isCorrect) {
    let teamScore = await TeamScore.findOne({ teamid });
    if (!teamScore) {
      console.log(`Creating new TeamScore for team: ${teamid}`);
      teamScore = new TeamScore({ teamid, points: 0, completedChallenges: [] });
    }
    if (!teamScore.completedChallenges.includes(challengeId)) {
      const pointsToAdd = challengePoints[challengeId] || 0;
      teamScore.points += pointsToAdd;
      teamScore.completedChallenges.push(challengeId);
      teamScore.lastUpdated = new Date();
      console.log(
        `Team ${teamid} awarded ${pointsToAdd} points for challenge: ${challengeId}`
      );
      await teamScore.save();
      console.log(
        `Updated team score: ${teamScore.points} points, ${teamScore.completedChallenges.length} challenges`
      );
    } else {
      console.log(`Team ${teamid} already completed challenge: ${challengeId}`);
    }
    return res.json({ message: "Flag submitted successfully!", status: true });
  } else {
    console.log(
      `Incorrect flag submitted by ${teamid} for challenge: ${challengeId}`
    );
    return res.json({ message: "Incorrect flag", status: false });
  }
});

app.get("/api/leaderboard", async (req, res) => {
  console.log("Leaderboard endpoint called");

  try {
    const leaderboard = await TeamScore.find().sort({
      points: -1,
      lastUpdated: 1,
    });

    console.log(`Retrieved ${leaderboard.length} leaderboard entries`);
    if (leaderboard.length > 0) {
      console.log("First entry:", JSON.stringify(leaderboard[0], null, 2));
    } else {
      console.log("No leaderboard entries found");
    }

    res.json(leaderboard);
  } catch (err) {
    console.error("Error fetching leaderboard:", err);
    res.status(500).json({
      message: "Error fetching leaderboard",
      error: err.message,
    });
  }
});

app.listen(4000, () => {
  console.log("Server started on http://localhost:4000");
});
