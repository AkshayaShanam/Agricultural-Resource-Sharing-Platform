const db = require("../config/db");

// Get all users
const getAll = (callback) => {
  db.query("SELECT * FROM users", callback);
};

// Create a new user
const create = (data, callback) => {
  const { username, email, password } = data;
  db.query(
    "INSERT INTO users (username, email, password) VALUES (?, ?, ?)",
    [username, email, password],
    callback
  );
};

// ✅ Find user by email (used for login)
const findByEmail = (email, callback) => {
  db.query("SELECT * FROM users WHERE email = ?", [email], (err, results) => {
    if (err) return callback(err);
    callback(null, results[0]);
  });
};

module.exports = {
  getAll,
  create,
  findByEmail
};
