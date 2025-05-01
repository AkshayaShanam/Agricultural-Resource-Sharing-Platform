const express = require('express');
const dotenv = require('dotenv').config({ path: './backend/.env' });
const cors = require('cors');  // To allow cross-origin requests
const bodyParser = require("body-parser");
const path = require('path');

const connection = require('./config/db'); // Import the database connection


// Initialize the express app
const app = express();

// Use CORS middleware
app.use(cors());
app.use(bodyParser.json());
app.use('/uploads',
  express.static(
    path.join(__dirname, '..', 'uploads')  // go up from backend/ to project-root/
  )
);
// Middleware to parse incoming JSON requests
app.use(express.json());

// Get the port from the environment variable (or default to 5000)
const port = process.env.PORT || 5000;

//Routes
app.use("/api/users", require("./routes/userRoutes"));

const profileRoutes = require('./routes/profileRoutes');
app.use('/api/profile', profileRoutes);

const resourceRoutes = require('./routes/resourceRoutes');
app.use('/api/resources', resourceRoutes);

const rentalRoutes = require("./routes/rentalRoutes");
app.use("/api/rentals", rentalRoutes);

const notificationRoutes = require('./routes/notificationRoutes');
app.use('/api/notifications', notificationRoutes);

const searchRoutes = require('./routes/searchRoutes');
app.use('/api/search', searchRoutes);

// Simple route to check if the server is running
app.get('/', (req, res) => {
  res.send('FakeAgri backend is running 🚜');
});

// Start the server on the defined port
app.listen(port, () => {
  console.log(`Server started on http://localhost:${port}`);
});

module.exports = app;