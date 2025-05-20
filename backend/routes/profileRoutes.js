const express = require('express');
const router = express.Router();
const profileController = require('../controllers/profileController');
const verifyToken = require('../middleware/verifyToken'); // using verifyToken instead of authenticate

router.get('/', verifyToken, profileController.getProfile);
router.put('/edit', verifyToken, profileController.updateProfile);
router.get('/:id', verifyToken, profileController.getProfileById); // For fetching any user's profile
module.exports = router;
