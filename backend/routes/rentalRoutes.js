const express = require("express");
const router = express.Router();
const rentalController = require("../controllers/rentalController");
const verifyToken = require("../middleware/verifyToken");

// Renter sends request
router.post("/request", verifyToken, rentalController.requestRental);

// Vendor accepts or rejects rental request
router.put("/update/:rental_id", verifyToken, rentalController.updateRentalStatus);

// Mark resource as returned (optional if you're using this)
router.put("/return/:rental_id", verifyToken, rentalController.markAsReturned);

// 🔵 New: mark as taken
router.put("/take/:rental_id", verifyToken, rentalController.markAsTaken);

// Renter's Recently Rented view (all: pending, accepted, rejected)
router.get("/renter", verifyToken, rentalController.getRenterRentals);

// Vendor’s Shared Resources (only accepted ones)
router.get("/shared", verifyToken, rentalController.getAcceptedSharedRentals);

router.get("/:rental_id", verifyToken, rentalController.getRentalById);

module.exports = router;
