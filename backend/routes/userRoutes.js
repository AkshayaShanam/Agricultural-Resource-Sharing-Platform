const express = require("express");
const router = express.Router();
const userController = require("../controllers/userController");
const verifyToken = require("../middleware/verifyToken"); // ✅ import

// Protected: Get all users
router.get("/", verifyToken, userController.getUsers); // 🔐 token required

// Public: Register user
router.post("/", userController.createUser);

// Public: Login
router.post("/login", userController.loginUser);

router.post("/change-password", verifyToken, userController.changePassword);

module.exports = router;
