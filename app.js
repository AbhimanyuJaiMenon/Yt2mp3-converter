const express = require("express");
const fetch = require("node-fetch");
const bodyParser = require("body-parser");
const session = require("express-session");
const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

// View engine and static files
app.set("view engine", "ejs");
app.use(express.static("public"));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());

// Session and Passport
app.use(session({
  secret: process.env.SESSION_SECRET || "fallback-secret",
  resave: false,
  saveUninitialized: false
}));
app.use(passport.initialize());
app.use(passport.session());

// Google OAuth Strategy
passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: "https://yt2mp3-converter.onrender.com/auth/google/callback"
}, (accessToken, refreshToken, profile, done) => {
  return done(null, profile);
}));

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));

// Middleware to check login
function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) return next();
  res.redirect("/login");
}

// Auth Routes
app.get("/auth/google", passport.authenticate("google", { scope: ["profile", "email"] }));
app.get("/auth/google/callback",
  passport.authenticate("google", { failureRedirect: "/login" }),
  (req, res) => res.redirect("/")
);
app.get("/logout", (req, res) => {
  req.logout(() => res.redirect("/login"));
});

// Routes
app.get("/", ensureAuthenticated, (req, res) => {
  res.render("index", { user: req.user, success: undefined });
});

app.get("/login", (req, res) => {
  res.render("login");
});

// Example: YouTube MP3 Conversion Route
app.post("/convert-mp3", ensureAuthenticated, async (req, res) => {
  const rawID = req.body.videoID?.trim();
  const match = rawID.match(/(?:v=|\/)([0-9A-Za-z_-]{11})/);
  const videoID = match ? match[1] : rawID;

  if (!videoID) {
    return res.render("index", {
      user: req.user,
      success: false,
      message: "Please enter a valid YouTube video ID or URL"
    });
  }

  try {
    const response = await fetch(`https://youtube-mp36.p.rapidapi.com/dl?id=${videoID}`, {
      method: "GET",
      headers: {
        "X-RapidAPI-Key": process.env.API_KEY,
        "X-RapidAPI-Host": process.env.API_HOST
      }
    });

    const data = await response.json();
    if (data.status === "ok") {
      res.render("index", {
        user: req.user,
        success: true,
        song_title: data.title,
        song_link: data.link
      });
    } else {
      res.render("index", {
        user: req.user,
        success: false,
        message: "Conversion failed. Invalid YouTube ID."
      });
    }
  } catch (err) {
    console.error(err);
    res.render("index", {
      user: req.user,
      success: false,
      message: "Server error while converting YouTube video."
    });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`✅ Server started on port ${PORT}`);
});
