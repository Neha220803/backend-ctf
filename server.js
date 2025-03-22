const cors = require("cors");
const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const session = require("express-session");
const passport = require("passport");
const LocalStrategy = require("passport-local").Strategy;
const User = require("./models/User");
const TeamScore = require("./models/TeamScore");
const cookieParser = require("cookie-parser");
const MongoStore = require("connect-mongo");
require("dotenv").config();

const app = express();
app.use(
  cors({
    origin: [
      "http://localhost:3000",
      "https://neha220803.github.io/ctf-frontend-react/",
    ],
    credentials: true,
    methods: ["GET", "POST", "OPTIONS"], // Add OPTIONS method
    allowedHeaders: ["Content-Type", "Authorization"], // Add Authorization header
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
app.use(
  session({
    secret: "your-secret-key",
    resave: false,
    saveUninitialized: true,
    store: MongoStore.create({
      mongoUrl: process.env.MONGO_URI,
      touchAfter: 24 * 3600,
      autoRemove: "native",
    }),
    cookie: {
      maxAge: 1000 * 60 * 60 * 24,
      sameSite: "none", // Add this for cross-site cookies
      secure: true,
    },
  })
);
app.use(passport.initialize());
app.use(passport.session());

// Add session monitoring middleware
app.use((req, res, next) => {
  console.log("Session ID:", req.sessionID);
  console.log("Session data:", req.session);
  console.log("Authenticated:", req.isAuthenticated());
  next();
});

passport.use(
  new LocalStrategy(
    { usernameField: "email" },
    async (email, password, done) => {
      console.log(`Attempting login for: ${email}`);
      try {
        const user = await User.findOne({ email });
        if (!user) {
          console.log(`User not found: ${email}`);
          return done(null, false, { message: "User not found" });
        }
        if (user.password !== password) {
          console.log(`Incorrect password for: ${email}`);
          return done(null, false, { message: "Incorrect password" });
        }
        console.log(`Login successful for: ${email}, Team ID: ${user.teamid}`);
        return done(null, user);
      } catch (err) {
        console.error(`Login error for ${email}:`, err);
        return done(err);
      }
    }
  )
);

passport.serializeUser((user, done) => {
  console.log(`Serializing user: ${user.email}, ID: ${user.id}`);
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  console.log(`Deserializing user ID: ${id}`);
  try {
    const user = await User.findById(id);
    if (!user) {
      console.log(`User not found for ID: ${id}`);
      return done(null, false);
    }
    console.log(`Found user: ${user.email}, Team ID: ${user.teamid}`);
    done(null, user);
  } catch (err) {
    console.error(`Deserialize error for ID ${id}:`, err);
    done(err);
  }
});

// Authentication check middleware
const isAuthenticated = (req, res, next) => {
  console.log(`Authentication check - authenticated: ${req.isAuthenticated()}`);
  if (req.isAuthenticated()) {
    console.log(
      `User authenticated: ${req.user.email}, Team ID: ${req.user.teamid}`
    );
    return next();
  }
  console.log("Authentication failed - no valid session");
  res.status(401).json({ message: "Not authenticated", status: "error" });
};

app.post("/signup", async (req, res) => {
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

app.post("/login", (req, res, next) => {
  console.log("Login attempt:", req.body.email);
  passport.authenticate("local", (err, user, info) => {
    if (err) {
      console.error("Login error:", err);
      return res.status(500).json({
        message: "Error during login",
        status: "error",
        error: err.message,
      });
    }
    if (!user) {
      console.log("Login failed:", info?.message || "Unknown reason");
      return res
        .status(401)
        .json({ message: info?.message || "Login failed", status: "error" });
    }
    req.login(user, (loginErr) => {
      if (loginErr) {
        console.error("Session login error:", loginErr);
        return res.status(500).json({
          message: "Error logging in",
          status: "error",
          error: loginErr.message,
        });
      }
      console.log(`Login successful: ${user.email}, Team ID: ${user.teamid}`);
      res.json({
        message: "Login successful",
        status: "success",
        teamid: user.teamid,
      });
    });
  })(req, res, next);
});

app.get("/logout", (req, res) => {
  console.log("Logout attempt for:", req.user?.email);
  req.logout((err) => {
    if (err) {
      console.error("Logout error:", err);
      return res
        .status(500)
        .json({ message: "Error logging out", error: err.message });
    }
    req.session.destroy((destroyErr) => {
      if (destroyErr) {
        console.error("Session destroy error:", destroyErr);
      }
      console.log("Logout successful, session destroyed");
      res.json({ message: "Logout successful", status: "success" });
    });
  });
});

// Add the team-score endpoint
app.get("/team-score", isAuthenticated, async (req, res) => {
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

const challengeFlags = {
  "easy-1": "CTF{crypto_123}",
  "easy-2": "CTF{hidden_text}",
  "easy-3": "CTF{sql_injection}",
  "easy-4": "CTF{buffer_overflow}",
  "easy-5": "CTF{reverse_me}",
  "easy-6": "CTF{file_metadata}",
  "easy-7": "CTF{osint_winner}",
  "medium-1": "CTF{advanced_crypto}",
  "medium-2": "CTF{audio_steg}",
  "medium-3": "CTF{xss_vulnerability}",
  "medium-4": "CTF{buffer_exploitation}",
  "medium-5": "CTF{auth_bypass}",
  "medium-6": "CTF{data_recovery}",
  "medium-7": "CTF{social_trace}",
  "hard-1": "CTF{ultimate_challenge}",
};

const challengePoints = {
  "easy-1": 100,
  "easy-2": 100,
  "easy-3": 100,
  "easy-4": 100,
  "easy-5": 100,
  "easy-6": 100,
  "easy-7": 100,
  "medium-1": 200,
  "medium-2": 200,
  "medium-3": 200,
  "medium-4": 200,
  "medium-5": 200,
  "medium-6": 200,
  "medium-7": 200,
  "hard-1": 400,
};

app.post("/submit-flag", isAuthenticated, async (req, res) => {
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

app.get("/leaderboard", async (req, res) => {
  console.log("Leaderboard endpoint called");
  console.log("Authentication status:", req.isAuthenticated());
  if (req.isAuthenticated()) {
    console.log("User:", req.user.email, "Team ID:", req.user.teamid);
  } else {
    console.log("User is not authenticated");
  }

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
