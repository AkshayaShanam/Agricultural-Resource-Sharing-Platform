const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const User = require("../models/userModel");
const db = require("../config/db");  // ✅ Add this


const SECRET_KEY = "fakeagri_secret_key"; // Ideally use env vars

// Email validation
const validateEmail = (email) => {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
};

// Password validation
const validatePassword = (password) => {
  const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?#&])[A-Za-z\d@$!%*?#&]{8,}$/;
  return regex.test(password);
};

// Get all users
exports.getUsers = (req, res) => {
  User.getAll((err, results) => {
    if (err) return res.status(500).json({ error: err });
    res.json(results);
  });
};

// Create a new user (Register)
exports.createUser = async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // Validation
    if (!username || !email || !password) {
      return res.status(400).json({ error: "All fields are required." });
    }

    // Reject spaces in username, email, or password
    if (/\s/.test(username) || /\s/.test(email) || /\s/.test(password)) {
      return res.status(400).json({ error: "Fields must not contain spaces." });
    }

    if (!validateEmail(email)) {
      return res.status(400).json({ error: "Invalid email format." });
    }

    if (!validatePassword(password)) {
      return res.status(400).json({
        error:
          "Password must be at least 8 characters long, include uppercase, lowercase, number, and special character.",
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    const userData = { username, email, password: hashedPassword };

    User.create(userData, (err, result) => {
      if (err) return res.status(500).json({ error: err });

      const userId = result.insertId;

      // Automatically create a row in user_profiles
      const blankProfile = {
        user_id: userId,
        full_name: "",
        contact: "",
        address: ""
      };

      const UserProfile = require("../models/profileModel");
      UserProfile.createProfile(blankProfile, (profileErr) => {
        if (profileErr) {
          console.error("Error creating profile row:", profileErr);
          return res.status(500).json({ error: "User created, but profile setup failed." });
        }

        res.status(201).json({ message: "User and profile created", id: userId });
      });
    });
  } catch (error) {
    res.status(500).json({ error: "Something went wrong!" });
  }
};

// Login user and return JWT token
exports.loginUser = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required." });
  }

  try {
    User.findByEmail(email, async (err, user) => {
      if (err) return res.status(500).json({ error: "Server error." });
      if (!user) return res.status(401).json({ error: "Invalid credentials." });

      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) return res.status(401).json({ error: "Invalid Password." });

      const token = jwt.sign(
        { id: user.id, email: user.email, username: user.username },
        process.env.JWT_SECRET,
        { expiresIn: "1d" }
      );

      res.json({
        message: "Login successful",
        user: {
          id: user.id,
          username: user.username,
          email: user.email
        },
        token
      });
    });
  } catch (error) {
    res.status(500).json({ error: "Login failed. Please try again later." });
  }
};

exports.changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: "All fields are required." });
  }

  try {
    const userId = req.user.id;

    // Get user from DB
    const [rows] = await db.promise().query("SELECT password FROM users WHERE id = ?", [userId]);

    if (rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const user = rows[0];

    // Compare current password
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: "Current password is incorrect." });
    }

    // Hash new password
    const hashedNewPassword = await bcrypt.hash(newPassword, 10);

    // Update password in DB
    await db.promise().query("UPDATE users SET password = ? WHERE id = ?", [hashedNewPassword, userId]);

    res.json({ message: "Password changed successfully!" });

  } catch (error) {
    console.error("Change Password Error:", error);
    res.status(500).json({ error: "Failed to change password." });
  }
};
