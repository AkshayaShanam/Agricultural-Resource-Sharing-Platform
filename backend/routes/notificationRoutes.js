const express = require('express'); 
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const verifyToken = require('../middleware/verifyToken');

// Important: this order matters
router.get('/', verifyToken, notificationController.getUserNotifications);
router.get('/user/:user_id', notificationController.getNotifications);

module.exports = router;
