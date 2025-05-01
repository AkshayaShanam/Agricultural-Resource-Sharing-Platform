const db = require('../config/db');
const {
  addResource,
  deleteResourceById,
  getResourceNameById,
  updateAvailableResources,
  getResourcesByUser
} = require('../models/resourceModel');

exports.handleAddResource = async (req, res) => {
  try {
    const { name, cost_per_day } = req.body;

    if (!cost_per_day || isNaN(cost_per_day) || Number(cost_per_day) <= 0) {
      return res.status(400).json({ message: "Cost per day must be a positive number and above zero." });
    }
    
    const image_url = req.file ? req.file.filename : null;
    const owner_id = req.user.id;

    if (!image_url) {
      return res.status(400).json({ message: 'Image is required for the resource.' });
    }

    // 🔥 Check vendor's district and address
    const [vendorDetails] = await db.promise().query(
      `SELECT district, address FROM user_profiles WHERE id = ?`,
      [owner_id]
    );

    if (vendorDetails.length === 0) {
      return res.status(400).json({ message: "Vendor not found" });
    }

    const vendor = vendorDetails[0];

    if (!vendor.district || !vendor.address) {
      return res.status(400).json({ message: "Please update your district and address in profile before adding resources." });
    }

    // 🔥 Check if a resource with the same image already exists for this owner
    const [existingResources] = await db.promise().query(
      `SELECT * FROM resources WHERE owner_id = ? AND name = ? AND is_deleted = FALSE`,
      [owner_id, name]
    );

    if (existingResources.length > 0) {
      return res.status(400).json({ message: "You already added this resource." });
    }

    // ✅ No duplicate found, insert the new resource
    const result = await addResource(owner_id, name, image_url, cost_per_day);

    // ✅ Update available_resources in users table
    const updateQuery = `
      UPDATE users
      SET available_resources = available_resources + 1
      WHERE id = ?
    `;
    await db.promise().query(updateQuery, [owner_id]);

    // ✅ Build the full image URL
    const imageUrl = `${req.protocol}://${req.get('host')}/uploads/${image_url}`;

    // ✅ Send success response
    res.status(201).json({
      message: "Resource added successfully!",
      resource_id: result[0].insertId,
      image_url: imageUrl
    });

  } catch (error) {
    console.error("Add Resource Error:", error);
    res.status(500).json({ message: 'Failed to add resource.', error: error.message });
  }
};

exports.handleDeleteResource = async (req, res) => {
  const userId = req.user.id;
  const resourceId = req.params.id;

  try {
    // Step 1: Get the resource name
    const data = await getResourceNameById(resourceId, userId);
    if (data.length === 0) {
      return res.status(404).json({ error: "Resource not found or not owned by user" });
    }

    const resourceName = data[0].name;

    // Step 2: Soft delete the resource
    await deleteResourceById(resourceId, userId);

    // Step 3: Decrease available_resources by 1 when a resource is deleted
    const [userData] = await new Promise((resolve, reject) => {
      db.query("SELECT available_resources FROM users WHERE id = ?", [userId], (err, result) => {
        if (err) return reject(err);
        resolve(result);
      });
    });

    let updatedList = 0;
    if (userData && userData.available_resources != null) {
      updatedList = Math.max(0, userData.available_resources - 1);  // Decrease by 1
    }

    await updateAvailableResources(userId, updatedList);

    res.json({ message: "Resource deleted and available_resources updated!" });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to delete resource", details: error });
  }
};

exports.getAvailableResourcesByDistrict = async (req, res) => {
  try {
    const userId = req.user.id;

    // Fetch user's district
    const [userDistrictData] = await db.promise().query(
      `SELECT district FROM user_profiles WHERE user_id = ?`,
      [userId]
    );

    if (userDistrictData.length === 0) {
      return res.status(400).json({ message: "User profile not found. Please update your district." });
    }

    const userDistrict = userDistrictData[0].district;

    // Now fetch resources from same district
    const uploadsBase = `${req.protocol}://${req.get('host')}/uploads`;

    const [resources] = await db.promise().query(
      `SELECT 
        r.resource_id,
        r.name AS resource_name,
        r.cost_per_day AS resource_cost,
        CONCAT(?, '/', r.image_url) AS resource_image,
        up.district
      FROM resources r
      JOIN user_profiles up ON r.owner_id = up.user_id
      LEFT JOIN rentals t ON r.resource_id = t.resource_id AND t.status = 'Accepted'
      WHERE t.resource_id IS NULL
        AND r.owner_id <> ?
        AND r.is_available = 1
        AND r.is_deleted = FALSE
        AND up.district = ?`,
      [uploadsBase, userId, userDistrict]
    );

    res.json(resources);

  } catch (error) {
    console.error("getAvailableResourcesByDistrict error:", error);
    res.status(500).json({ message: "Failed to fetch district resources.", error: error.message });
  }
};

exports.getUserResources = async (req, res) => {
  try {
    const userId = req.user.id;
    const uploadsBase = `${req.protocol}://${req.get('host')}/uploads`;

    const resources = await getResourcesByUser(userId);

    const formattedResources = resources.map((resource) => ({
      resource_id: resource.resource_id,
      name: resource.name,
      cost_per_day: resource.cost_per_day,
      image_url: `${uploadsBase}/${resource.image_url}`
    }));

    res.json(formattedResources);
  } catch (error) {
    console.error("Error fetching user resources:", error);
    res.status(500).json({ message: "Failed to fetch your resources.", error: error.message });
  }
};

exports.getResourceById = async (req, res) => {
  try {
    const resourceId = req.params.id;
    const uploadsBase = `${req.protocol}://${req.get('host')}/uploads`;

    const [rows] = await db.promise().query(
      `SELECT 
         r.resource_id,
         r.name AS resource_name,
         r.cost_per_day AS resource_cost,
         CONCAT(?, '/', r.image_url) AS resource_image,
         up.full_name AS owner_name,
         up.address AS owner_address,
         up.district AS owner_district,
         up.contact AS owner_contact
       FROM resources r
       JOIN users u ON r.owner_id = u.id
       JOIN user_profiles up ON up.user_id = u.id
       WHERE r.resource_id = ? AND r.is_deleted = FALSE`,
      [uploadsBase, resourceId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "Resource not found" });
    }

    res.json(rows[0]);

  } catch (error) {
    console.error("Error fetching resource by ID:", error);
    res.status(500).json({ message: "Failed to fetch resource", error: error.message });
  }
};