const express = require('express');
const router = express.Router();
const { searchResources } = require('../controllers/searchController');
const verifyToken = require('../middleware/verifyToken'); // if needed

router.get('/resources', verifyToken, searchResources);

module.exports = router;
