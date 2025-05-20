const db = require("../config/db");

// Request to rent a resource
exports.requestRental = async (req, res) => {
  const { resource_id, return_date } = req.body;
  const renter_id = req.user.id;

  // 🔒 Validate return date
  const today = new Date();
  const selectedDate = new Date(return_date);
  today.setHours(0, 0, 0, 0);
  selectedDate.setHours(0, 0, 0, 0);

  if (selectedDate < today) {
      return res.status(400).json({ message: "Return date cannot be in the past." });
  }

  try {
      // ✅ Check if resource already has an accepted rental
      const [acceptedRental] = await db.promise().query(
          `SELECT * FROM rentals WHERE resource_id = ? AND status = 'Accepted'`,
          [resource_id]
      );
      if (acceptedRental.length > 0) {
          return res.status(400).json({
              message: 'This resource has already been accepted by another request.'
          });
      }

      // ✅ Check if the user already has a pending request
      const [existingRequest] = await db.promise().query(
          `SELECT * FROM rentals WHERE resource_id = ? AND renter_id = ? AND status = 'Pending'`,
          [resource_id, renter_id]
      );
      if (existingRequest.length > 0) {
          return res.status(400).json({
              message: 'You have already requested this resource and it is pending.'
          });
      }

      // ✅ Get the owner and resource name
      const [resource] = await db.promise().query(
          "SELECT owner_id, name FROM resources WHERE resource_id = ? AND is_deleted = FALSE",
          [resource_id]
      );
      if (!resource.length) {
          return res.status(404).json({ error: "Resource not found" });
      }

      const owner_id = resource[0].owner_id;
      const resourceName = resource[0].name;

      // 🚨 Block owner from renting their own resource
      if (owner_id === renter_id) {
          return res.status(400).json({ message: "You cannot rent your own resource." });
      }

      const [vendor] = await db.promise().query(
          "SELECT username FROM users WHERE id = ?",
          [owner_id]
      );
      const vendor_name = vendor[0]?.username || "";

      // ✅ Insert the rental request without return_date
      const [rentalInsertResult] = await db.promise().query(
        `INSERT INTO rentals (resource_id, renter_id, owner_id, rental_date, vendor_name, status) 
         VALUES (?, ?, ?, NULL, ?, ?)`,
        [resource_id, renter_id, owner_id, vendor_name, 'Pending']
      );
      
      const rentalId = rentalInsertResult.insertId;

      const formattedReturnDate = new Date(return_date).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });

      // 🛎️ Send notification with proposed return date and rental_id
      const [existingNotification] = await db.promise().query(
          `SELECT * FROM notifications 
           WHERE sender_id = ? AND receiver_id = ? AND rental_id = ?`,
          [renter_id, owner_id, rentalId]
      );

      console.log("Existing Notification Check:", existingNotification);

      if (existingNotification.length === 0) {
          console.log("Inserting new notification for rental_id:", rentalId);
          await db.promise().query(
              `INSERT INTO notifications (sender_id, receiver_id, rental_id, message) 
               VALUES (?, ?, ?, ?)`,
              [renter_id, owner_id, rentalId, `Rental Request Received - ${req.user.username} requested to rent your ${resourceName}. (Return by: ${formattedReturnDate})`]
          );
          console.log("Notification inserted for rental_id:", rentalId);
      } else {
          console.log("Notification already exists for rental_id:", rentalId);
      }

      res.status(201).json({ message: "Rental request sent successfully" });
  } catch (err) {
      console.error("Request Rental Error:", err);
      res.status(500).json({ error: "Failed to request rental", details: err.message });
  }
};

// Mark resource as returned
exports.markAsReturned = async (req, res) => {
  const { rental_id } = req.params;
  const owner_id = req.user.id;
  const today = new Date().toISOString().split('T')[0];

  try {
    // ✅ Check if the rental has been taken (rental_date is set)
    const [rentalRows] = await db.promise().query(
      `SELECT rental_date FROM rentals 
       WHERE rental_id = ? AND owner_id = ? AND status = 'Accepted'`,
      [rental_id, owner_id]
    );

    if (rentalRows.length === 0) {
      return res.status(400).json({ message: "Rental not found or not yours." });
    }

    if (!rentalRows[0].rental_date) {
      return res.status(400).json({ message: "The resource was not taken yet." });
    }

    // ✅ Only update return_date when marked as returned
    const [result] = await db.promise().query(
      `UPDATE rentals
         SET return_date = ?
       WHERE rental_id = ? AND owner_id = ? AND status = 'Accepted'`,
      [today, rental_id, owner_id]
    );

    if (result.affectedRows === 0) {
      return res.status(400).json({ message: 'Rental not found, already returned, or not yours.' });
    }

    // Fetch the updated rental to return
    const [updatedRental] = await db.promise().query(
      `SELECT r.*, COALESCE(res.name, CONCAT('Resource #', r.resource_id, ' (Deleted)')) AS resource_name, res.cost_per_day, u.username AS renter_name 
       FROM rentals r 
       LEFT JOIN resources res ON r.resource_id = res.resource_id
       JOIN users u ON r.renter_id = u.id
       WHERE r.rental_id = ? AND r.owner_id = ?`,
      [rental_id, owner_id]
    );

    res.json({
      message: "Marked as returned successfully.",
      rental: updatedRental[0]
    });
  } catch (err) {
    console.error("markAsReturned error:", err);
    res.status(500).json({ message: "Failed to mark as returned", error: err.message });
  }
};

// 🚀 Vendor updates rental status (Accept/Reject)
exports.updateRentalStatus = async (req, res) => {
  const { rental_id } = req.params;
  const { status } = req.body; // "Accepted" or "Rejected"
  const owner_id = req.user.id; // vendor's token

  if (status !== 'Accepted' && status !== 'Rejected') {
    return res.status(400).json({ message: "Invalid status. Must be Accepted or Rejected." });
  }

  try {
    // 🔥 Validate rental ownership and current status
    const [rentalRows] = await db.promise().query(
      `SELECT r.*, u.username AS renter_name, COALESCE(res.name, CONCAT('Resource #', r.resource_id, ' (Deleted)')) AS resource_name
       FROM rentals r
       JOIN users u ON r.renter_id = u.id
       LEFT JOIN resources res ON r.resource_id = res.resource_id
       WHERE r.rental_id = ?
       `,
      [rental_id]
    );

    if (rentalRows.length === 0) {
      return res.status(404).json({ message: "Rental not found." });
    }

    const rental = rentalRows[0];

    if (rental.owner_id !== owner_id) {
      return res.status(403).json({ message: "You are not authorized to update this rental." });
    }

    // 🛑 If rental is already accepted/rejected, block updating again
    if (rental.status === 'Accepted' || rental.status === 'Rejected') {
      return res.status(400).json({ message: `This rental request has already been ${rental.status}.` });
    }

    // 🛑 Check if another rental for the same resource is already accepted
    if (status === 'Accepted') {
      const [existingAcceptedRental] = await db.promise().query(
        `SELECT * FROM rentals 
         WHERE resource_id = ? AND status = 'Accepted' AND rental_id != ?`,
        [rental.resource_id, rental_id]
      );

      if (existingAcceptedRental.length > 0) {
        return res.status(400).json({
          message: "Another request for this resource has already been accepted. You cannot accept another request until the current rental is completed."
        });
      }
    }
    // ✅ Update the rental status
    const [updateResult] = await db.promise().query(
      "UPDATE rentals SET status = ? WHERE rental_id = ?",
      [status, rental_id]
    );

    if (updateResult.affectedRows === 0) {
      return res.status(400).json({ message: "Failed to update rental status." });
    }

    const resource_id = rental.resource_id;
    const vendor_name = rental.vendor_name;
    const renter_id = rental.renter_id;
    const renter_name = rental.renter_name;

    // 🔔 Send notification to renter with rental_id
    const resourceName = rental.resource_name || `Resource #${resource_id} (Deleted)`;
    const message = status === 'Accepted'
      ? `Your rental request for "${resourceName}" has been ACCEPTED.`
      : `Your rental request for "${resourceName}" has been REJECTED.`;

    await db.promise().query(
      `INSERT INTO notifications (sender_id, receiver_id, rental_id, message)
       VALUES (?, ?, ?, ?)`,
      [owner_id, renter_id, rental_id, message]
    );

    res.json({ message: `Rental request ${status.toLowerCase()} and renter notified.` });
  } catch (err) {
    console.error("Update Rental Status Error:", err);
    res.status(500).json({ error: "Failed to update rental status", details: err.message });
  }
};

// Mark resource as taken
exports.markAsTaken = async (req, res) => {
  const { rental_id } = req.params;
  const owner_id = req.user.id;
  const today = new Date().toISOString().split("T")[0];

  try {
       // 🔥 First, check if already marked (rental_date is already set)
       const [rentalRows] = await db.promise().query(
        `SELECT rental_date, resource_id FROM rentals 
         WHERE rental_id = ? AND owner_id = ? AND status = 'Accepted'`,
        [rental_id, owner_id]
      );
  
      if (rentalRows.length === 0) {
        return res.status(400).json({ message: "Rental not found or not eligible." });
      }
  
      const rental = rentalRows[0];
  
      if (rental.rental_date) {
        // 🛑 Already taken, don't allow again
        return res.status(400).json({ message: "Rental already marked as taken." });
      }
    // ✅ Only update rental_date, no status update here
    const [result] = await db.promise().query(
      `UPDATE rentals
         SET rental_date = ?
       WHERE rental_id = ? AND owner_id = ? AND status = 'Accepted'`,
      [today, rental_id, owner_id]
    );

    if (result.affectedRows === 0) {
      return res.status(400).json({ message: "Rental not found, already taken, or not yours." });
    }

    // ✅ Set resource unavailable
    await db.promise().query(
      `UPDATE resources SET is_available = 0 
       WHERE resource_id = (SELECT resource_id FROM rentals WHERE rental_id = ?) AND is_deleted = FALSE`,
      [rental_id]
    );

    // ✅ Decrease available_resources by 1 (but never negative)
    await db.promise().query(
      `UPDATE users 
       SET available_resources = GREATEST(available_resources - 1, 0)
       WHERE id = ?`,
      [owner_id]
    );

    res.json({
      message: "Marked as taken successfully.",
      rental_date: today,
    });
  } catch (err) {
    console.error("markAsTaken error:", err);
    res.status(500).json({ message: "Failed to mark as taken", error: err.message });
  }
};

// Get all rentals of the renter (Recently Rented)
exports.getRenterRentals = async (req, res) => {
  const renter_id = req.user.id;
  try {
    const [results] = await db.promise().query(
      `SELECT 
         r.rental_id,
         r.resource_id,
         COALESCE(res.name, CONCAT('Resource #', r.resource_id, ' (Deleted)')) AS resource_name,
         res.image_url,
         r.status,
         r.rental_date,
         r.return_date,
         r.vendor_name,
         res.cost_per_day AS price,
         up.contact AS owner_contact
       FROM rentals r
       LEFT JOIN resources res ON r.resource_id = res.resource_id
       JOIN users u ON r.owner_id = u.id
       LEFT JOIN user_profiles up ON u.id = up.user_id
       WHERE r.renter_id = ?
       ORDER BY r.rental_date DESC`,
      [renter_id]
    );
    res.json(results);
  } catch (err) {
    console.error("getRenterRentals error:", err);
    res.status(500).json({ message: "Failed to fetch rentals", error: err.message });
  }
};

// Get all shared rentals by owner (Resources Shared section)
exports.getAcceptedSharedRentals = async (req, res) => {
  const owner_id = req.user.id;
  try {
      const [results] = await db.promise().query(
          `SELECT r.*, 
                  COALESCE(res.name, CONCAT('Resource #', r.resource_id, ' (Deleted)')) AS resource_name, 
                  res.cost_per_day, 
                  u.username AS renter_name 
           FROM rentals r 
           LEFT JOIN resources res ON r.resource_id = res.resource_id 
           JOIN users u ON r.renter_id = u.id
           WHERE r.owner_id = ? AND r.status = 'Accepted'
           ORDER BY r.rental_date DESC`,
          [owner_id]
      );
      res.json(results);
  } catch (err) {
      console.error("getAcceptedSharedRentals error:", err);
      res.status(500).json({ message: "Failed to fetch shared resources", error: err.message });
  }
};

// Get all shared rentals by owner (All statuses for Recently Rented)
exports.getAllSharedRentals = async (req, res) => {
  const owner_id = req.user.id;
  try {
    const [results] = await db.promise().query(
      `SELECT r.*, 
              COALESCE(res.name, CONCAT('Resource #', r.resource_id, ' (Deleted)')) AS resource_name, 
              u.username AS renter_name 
       FROM rentals r 
       LEFT JOIN resources res ON r.resource_id = res.resource_id 
       JOIN users u ON r.renter_id = u.id
       WHERE r.owner_id = ?
       ORDER BY r.rental_date DESC`,
      [owner_id]
    );
    res.json(results);
  } catch (err) {
    console.error("getAllSharedRentals error:", err);
    res.status(500).json({ message: "Failed to fetch shared resources", error: err.message });
  }
};

// New endpoint: Get a single rental by ID
exports.getRentalById = async (req, res) => {
  const { rental_id } = req.params;
  const user_id = req.user.id;
  try {
    const [rental] = await db.promise().query(
      `SELECT rental_id, status, resource_id, renter_id, owner_id
       FROM rentals 
       WHERE rental_id = ? AND (owner_id = ? OR renter_id = ?)`,
      [rental_id, user_id, user_id]
    );
    if (!rental.length) {
      return res.status(404).json({ message: "Rental not found or not authorized" });
    }
    res.json(rental[0]);
  } catch (err) {
    console.error("getRentalById error:", err);
    res.status(500).json({ message: "Failed to fetch rental", error: err.message });
  }
};