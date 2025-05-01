const db = require('../config/db'); 


exports.searchResources = async (req, res) => {
    try {
      const { keyword } = req.query;
      const userId = req.user.id;
  
      const uploadsBase = `${req.protocol}://${req.get('host')}/uploads`;
  
      const [resources] = await db.promise().query(
        `SELECT 
          r.resource_id,
          r.name AS resource_name,
          r.cost_per_day AS resource_cost,
          CONCAT(?, '/', r.image_url) AS resource_image
        FROM resources r
        LEFT JOIN rentals t ON r.resource_id = t.resource_id AND t.status = 'Accepted'
        WHERE t.resource_id IS NULL
          AND r.owner_id <> ?
          AND r.is_available = 1
          AND r.name LIKE ?
        `,
        [uploadsBase, userId, `%${keyword}%`]
      );
  
      res.json(resources);
    } catch (error) {
      console.error("searchResources error:", error);
      res.status(500).json({ message: "Failed to search resources", error: error.message });
    }
  };
  