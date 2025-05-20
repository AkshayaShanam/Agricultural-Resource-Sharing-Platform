const db = require("../config/db");

exports.createProfile = (data, callback) => {
  const { user_id, full_name, contact, address,district } = data;
  const sql = `
    INSERT INTO user_profiles 
      (user_id, full_name, contact, address, district)
    VALUES (?, ?, ?, ?, ?)
  `;
  db.query(sql, [user_id, full_name, contact, address, district], callback);
};
