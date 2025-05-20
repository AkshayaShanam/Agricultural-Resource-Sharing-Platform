const db = require('../config/db');

// GET user profile by token
exports.getProfile = (req, res) => {
  const userId = req.user.id;

  const query = `
    SELECT u.email, u.username, u.available_resources,
           p.full_name, p.contact, p.address, p.district
    FROM users u
    LEFT JOIN user_profiles p ON u.id = p.user_id
    WHERE u.id = ?
  `;

  db.query(query, [userId], (err, results) => {
    if (err) return res.status(500).json({ error: "Database error", details: err });
    res.json(results[0]);
  });
};

// GET user profile by user_id
exports.getProfileById = (req, res) => {
  const userId = req.params.id;

  const query = `
    SELECT p.full_name, p.contact, p.address, p.district
    FROM user_profiles p
    WHERE p.user_id = ?
  `;

  db.query(query, [userId], (err, results) => {
    if (err) return res.status(500).json({ error: "Database error", details: err });
    if (results.length === 0) {
      return res.status(404).json({ message: "Profile not found" });
    }
    res.json(results[0]);
  });
};

// UPDATE profile

exports.updateProfile = (req, res) => {
  const userId = req.user.id;
  const { username, full_name, contact, address, district } = req.body;

    // 1️⃣ Contact validation
    if (contact) {
      const contactRegex = /^[0-9]{10}$/; // Only 10 digits allowed
      if (!contactRegex.test(contact)) {
        return res.status(400).json({ error: "Contact number must be exactly 10 digits." });
      }
    }

  // Build a list of update promises
  const updates = [];

  // 1️⃣ Update users.username if provided
  if (username) {
    updates.push(
      new Promise((resolve, reject) => {
        db.query(
          "UPDATE users SET username = ? WHERE id = ?",
          [username, userId],
          (err) => (err ? reject(err) : resolve())
        );
      })
    );
  }

  // 2️⃣ Prepare profile fields (user_profiles) dynamically
  const fields = [];
  const values = [];

  if (full_name) {
    fields.push("full_name = ?");
    values.push(full_name);
  }
  if (contact) {
    fields.push("contact = ?");
    values.push(contact);
  }
  if (address) {
    fields.push("address = ?");
    values.push(address);
  }

  if (district) {
    fields.push("district = ?");
    values.push(district);
  }

  if (fields.length) {
    updates.push(
      new Promise((resolve, reject) => {
        const sql = `UPDATE user_profiles SET ${fields.join(
          ", "
        )} WHERE user_id = ?`;
        values.push(userId);
        db.query(sql, values, (err) => (err ? reject(err) : resolve()));
      })
    );
  }

  // If nothing at all was provided
  if (updates.length === 0) {
    return res
      .status(400)
      .json({ message: "No fields provided to update." });
  }

  // Execute all updates in parallel
  Promise.all(updates)
    .then(() => {
      res.json({ message: "Profile updated successfully." });
    })
    .catch((err) => {
      res
        .status(500)
        .json({ error: "Update failed", details: err });
    });
};

