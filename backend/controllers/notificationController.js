const db = require('../config/db');

// ✅ Not used but keeping (by user_id param)
const getNotifications = (req, res) => {
    const userId = req.params.user_id;
    const query = 'SELECT * FROM notifications WHERE receiver_id = ?';
  
    db.query(query, [userId], (err, results) => {
      if (err) {
        console.error('Error fetching notifications:', err);
        return res.status(500).json({ error: 'Error fetching notifications' });
      }
      if (results.length === 0) {
        return res.status(404).json({ message: 'No notifications found for this user.' });
      }
      res.json(results);
    });
};

// ✅ Correct version for notifications with rental_id
const getUserNotifications = async (req, res) => {
    const userId = req.user.id;
    try {
      const [notifications] = await db.promise().query(
        `SELECT DISTINCT n.*, r.rental_id 
         FROM notifications n
         LEFT JOIN rentals r 
         ON n.rental_id = r.rental_id
         WHERE n.receiver_id = ?
         ORDER BY n.created_at DESC`,
        [userId]
      );
      res.json(notifications);
    } catch (error) {
      console.error("Error fetching user notifications:", error);
      res.status(500).json({ error: "Failed to fetch notifications" });
    }
};

module.exports = {
  getNotifications,
  getUserNotifications,
};
