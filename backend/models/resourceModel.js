// models/resourceModel.js
const db = require('../config/db');


exports.addResource = (owner_id, name, image_url, cost_per_day) => {
  const query = `
    INSERT INTO resources (owner_id, name, image_url, cost_per_day)
    VALUES (?, ?, ?, ?)
  `;
  return db.promise().query(query, [owner_id, name, image_url, cost_per_day]);
};


// ✅ Delete resource by ID and owner
exports.deleteResourceById = (resourceId, ownerId) => {
  return new Promise((resolve, reject) => {
    const query = "UPDATE resources SET is_deleted = TRUE WHERE resource_id = ? AND owner_id = ?";
    db.query(query, [resourceId, ownerId], (err, result) => {
      if (err) return reject(err);
      resolve(result);
    });
  });
};

// ✅ Get resource name by ID and owner (needed to update available_resources)
exports.getResourceNameById = (resourceId, ownerId) => {
  return new Promise((resolve, reject) => {
    const query = "SELECT name FROM resources WHERE resource_id = ? AND owner_id = ? AND is_deleted = FALSE";
    db.query(query, [resourceId, ownerId], (err, result) => {
      if (err) return reject(err);
      resolve(result);
    });
  });
};

// ✅ Update available_resources after deletion
exports.updateAvailableResources = (userId, updatedList) => {
  return new Promise((resolve, reject) => {
    const query = "UPDATE users SET available_resources = ? WHERE id = ?";
    db.query(query, [updatedList, userId], (err, result) => {
      if (err) return reject(err);
      resolve(result);
    });
  });
};

exports.getResourcesByUser = (userId) => {
  return new Promise((resolve, reject) => {
    db.query(
      "SELECT * FROM resources WHERE owner_id = ? AND is_deleted = FALSE",
      [userId],
      (err, results) => {
        if (err) return reject(err);
        resolve(results);
      }
    );
  });
};
