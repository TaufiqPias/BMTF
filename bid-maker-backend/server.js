const express = require("express");
const mysql = require("mysql2");
const session = require("express-session");
const MySQLStore = require("express-mysql-session")(session);
const bcrypt = require("bcrypt");
const path = require("path");
require("dotenv").config();

const app = express();

// Middleware to parse JSON and URL-encoded bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, "public")));

// MySQL Connection
const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

db.connect((err) => {
  if (err) throw err;
  console.log("MySQL Connected");
});

// Session Store
const sessionStore = new MySQLStore({}, db);

// Session Middleware
app.use(
  session({
    secret: process.env.SESSION_SECRET || "your-secret-key",
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, maxAge: null }, // Set secure: true if using HTTPS
  })
);

// Middleware to Check Session
const checkSession = (req, res, next) => {
  if (req.session.userId) {
    db.query(
      "SELECT sessionToken FROM users WHERE id = ?",
      [req.session.userId],
      (err, results) => {
        if (err) throw err;
        if (
          results.length === 0 ||
          results[0].sessionToken !== req.session.sessionToken
        ) {
          req.session.destroy();
          return res.redirect("/error.html");
        }
        next();
      }
    );
  } else {
    res.redirect("/auth.html");
  }
};

// Routes
app.get("/", (req, res) => {
  res.redirect("/auth.html");
});

app.get("/auth.html", (req, res) => {
  if (req.session.userId) {
    return res.redirect("/index.html");
  }
  res.sendFile(path.join(__dirname, "public", "auth.html"));
});

app.get("/index.html", checkSession, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.get("/profile.html", checkSession, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "profile.html"));
});

app.get("/error.html", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "error.html"));
});

// API Routes
app.post("/api/signup", async (req, res) => {
  console.log("Signup request received:", req.body);
  const {
    firstName,
    lastName,
    gender,
    email,
    mobile,
    designation,
    company,
    password,
  } = req.body;

  if (!firstName || !lastName || !gender || !email || !mobile || !password) {
    return res.status(400).json({ error: "All fields are required" });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    db.query(
      "INSERT INTO users (firstName, lastName, gender, email, mobile, designation, company, password) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [
        firstName,
        lastName,
        gender,
        email,
        mobile,
        designation || null,
        company || null,
        hashedPassword,
      ],
      (err, results) => {
        if (err) {
          if (err.code === "ER_DUP_ENTRY") {
            return res
              .status(400)
              .json({ error: "Email or mobile already exists" });
          }
          throw err;
        }

        const userId = results.insertId;
        const sessionToken = Math.random().toString(36).substring(2);
        db.query(
          "UPDATE users SET sessionToken = ? WHERE id = ?",
          [sessionToken, userId],
          (err) => {
            if (err) throw err;

            req.session.userId = userId;
            req.session.sessionToken = sessionToken;
            res.status(200).json({ message: "Signup successful" });
          }
        );
      }
    );
  } catch (err) {
    res.status(500).json({ error: "Failed to sign up" });
  }
});

app.post("/api/login", async (req, res) => {
  const { identifier, password } = req.body;

  db.query(
    "SELECT * FROM users WHERE email = ? OR mobile = ?",
    [identifier, identifier],
    async (err, results) => {
      if (err) throw err;

      if (results.length === 0) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      const user = results[0];
      const match = await bcrypt.compare(password, user.password);
      if (!match) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      // Check trial and subscription status
      const now = new Date();
      let isActive = false;

      // Check subscription first
      if (user.subscription_start && user.subscription_end) {
        const subStart = new Date(user.subscription_start);
        const subEnd = new Date(user.subscription_end);
        if (now >= subStart && now <= subEnd) {
          isActive = true;
        }
      }

      // If no active subscription, check trial
      if (!isActive) {
        const trialStart = new Date(user.trial_start);
        const trialDurationDays = user.trial_duration_days;
        const trialEnd = new Date(trialStart);
        trialEnd.setDate(trialEnd.getDate() + trialDurationDays);
        if (now <= trialEnd) {
          isActive = true;
        }
      }

      if (!isActive) {
        return res.status(403).json({ error: "Trial or subscription expired" });
      }

      const sessionToken = Math.random().toString(36).substring(2);
      db.query(
        "UPDATE users SET sessionToken = ? WHERE id = ?",
        [sessionToken, user.id],
        (err) => {
          if (err) throw err;

          req.session.userId = user.id;
          req.session.sessionToken = sessionToken;
          res.status(200).json({ message: "Login successful" });
        }
      );
    }
  );
});

app.post("/api/logout", (req, res) => {
  if (req.session.userId) {
    db.query(
      "UPDATE users SET sessionToken = NULL WHERE id = ?",
      [req.session.userId],
      (err) => {
        if (err) throw err;
        req.session.destroy((err) => {
          if (err) throw err;
          res.status(200).json({ message: "Logged out" });
        });
      }
    );
  } else {
    res.status(200).json({ message: "Logged out" });
  }
});

app.get("/api/check-session", (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Not logged in" });
  }

  db.query(
    "SELECT sessionToken FROM users WHERE id = ?",
    [req.session.userId],
    (err, results) => {
      if (err) throw err;
      if (
        results.length === 0 ||
        results[0].sessionToken !== req.session.sessionToken
      ) {
        req.session.destroy();
        return res.status(401).json({ error: "Session invalid" });
      }
      res.status(200).json({ message: "Session valid" });
    }
  );
});

app.get("/api/user", (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  db.query(
    "SELECT * FROM users WHERE id = ?",
    [req.session.userId],
    (err, results) => {
      if (err) {
        console.error("Error fetching user data:", err);
        return res.status(500).json({ error: "Database error" });
      }
      if (results.length === 0) {
        return res.status(404).json({ error: "User not found" });
      }

      const user = results[0];
      res.json({
        firstName: user.firstName,
        lastName: user.lastName,
        gender: user.gender,
        email: user.email,
        mobile: user.mobile,
        designation: user.designation || "",
        company: user.company || "",
      });
    }
  );
});

app.post("/api/update-profile", (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  const { firstName, lastName, gender, email, mobile, designation, company } =
    req.body;

  if (!firstName || !lastName || !gender || !email || !mobile) {
    return res.status(400).json({
      error: "First name, last name, gender, email, and mobile are required",
    });
  }

  db.query(
    "UPDATE users SET firstName = ?, lastName = ?, gender = ?, email = ?, mobile = ?, designation = ?, company = ? WHERE id = ?",
    [
      firstName,
      lastName,
      gender,
      email,
      mobile,
      designation || null,
      company || null,
      req.session.userId,
    ],
    (err, results) => {
      if (err) {
        console.error("Error updating user profile:", err);
        if (err.code === "ER_DUP_ENTRY") {
          return res
            .status(400)
            .json({ error: "Email or mobile already exists" });
        }
        return res.status(500).json({ error: "Database error" });
      }
      if (results.affectedRows === 0) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json({ message: "Profile updated successfully" });
    }
  );
});

// Updated: Check trial or subscription status
app.get("/api/check-trial", (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  db.query(
    "SELECT trial_start, trial_duration_days, subscription_start, subscription_end FROM users WHERE id = ?",
    [req.session.userId],
    (err, results) => {
      if (err) {
        console.error("Error checking trial status:", err);
        return res.status(500).json({ error: "Database error" });
      }
      if (results.length === 0) {
        return res.status(404).json({ error: "User not found" });
      }

      const user = results[0];
      const now = new Date();
      let isActive = false;
      let status = "trial";

      // Check subscription first
      if (user.subscription_start && user.subscription_end) {
        const subStart = new Date(user.subscription_start);
        const subEnd = new Date(user.subscription_end);
        if (now >= subStart && now <= subEnd) {
          isActive = true;
          status = "subscription";
        }
      }

      // If no active subscription, check trial
      if (!isActive) {
        const trialStart = new Date(user.trial_start);
        const trialDurationDays = user.trial_duration_days;
        const trialEnd = new Date(trialStart);
        trialEnd.setDate(trialEnd.getDate() + trialDurationDays);
        if (now <= trialEnd) {
          isActive = true;
          status = "trial";
        }
      }

      if (!isActive) {
        return res.status(403).json({ error: "Trial or subscription expired" });
      }

      res.json({ message: "Active", status: status });
    }
  );
});

// New: Fetch subscription or trial details for display
app.get("/api/subscription-details", (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  db.query(
    "SELECT trial_start, trial_duration_days, subscription_start, subscription_end FROM users WHERE id = ?",
    [req.session.userId],
    (err, results) => {
      if (err) {
        console.error("Error fetching subscription details:", err);
        return res.status(500).json({ error: "Database error" });
      }
      if (results.length === 0) {
        return res.status(404).json({ error: "User not found" });
      }

      const user = results[0];
      let startDate, endDate, type;

      // Check if user has an active subscription
      if (user.subscription_start && user.subscription_end) {
        const subStart = new Date(user.subscription_start);
        const subEnd = new Date(user.subscription_end);
        const now = new Date();
        if (now >= subStart && now <= subEnd) {
          startDate = subStart;
          endDate = subEnd;
          type = "subscription";
        }
      }

      // If no active subscription, use trial dates
      if (!startDate || !endDate) {
        const trialStart = new Date(user.trial_start);
        const trialDurationDays = user.trial_duration_days;
        const trialEnd = new Date(trialStart);
        trialEnd.setDate(trialEnd.getDate() + trialDurationDays);
        const now = new Date();
        if (now <= trialEnd) {
          startDate = trialStart;
          endDate = trialEnd;
          type = "trial";
        } else {
          // If both trial and subscription are expired, return expired status
          return res
            .status(403)
            .json({ error: "Trial or subscription expired" });
        }
      }

      // Format dates for display (e.g., "January 15, 2025")
      const options = { month: "long", day: "numeric", year: "numeric" };
      const formattedStart = startDate.toLocaleDateString("en-US", options);
      const formattedEnd = endDate.toLocaleDateString("en-US", options);

      res.json({
        type: type,
        start: formattedStart,
        end: formattedEnd,
      });
    }
  );
});

// Start the server
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
