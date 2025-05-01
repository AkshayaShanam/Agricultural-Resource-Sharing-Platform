const express = require("express");
const router = express.Router();
const {
  handleAddResource,
  handleDeleteResource,
  getAvailableResourcesByDistrict,
  getUserResources,
  getResourceById, 
} = require("../controllers/resourceController");
const verifyToken = require("../middleware/verifyToken");

const upload = require("../middleware/upload");

// ✅ Add Resource
router.post("/add", verifyToken, upload.single("image_url"), handleAddResource);

// ✅ Delete Resource by ID
router.delete("/:id", verifyToken, handleDeleteResource);

router.get('/district', verifyToken, getAvailableResourcesByDistrict);

router.get("/my-resources", verifyToken, getUserResources);

router.get('/:id', verifyToken, getResourceById);

module.exports = router;
