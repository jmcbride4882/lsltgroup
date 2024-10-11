const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');

const app = express();

// Middleware configuration
app.use(bodyParser.json());
app.use(cors());

// Import API routes
const employeeRoutes = require('./routes/employeeRoutes');
app.use('/api/employees', employeeRoutes); // Serve API routes under /api/employees

// Serve static files from the React frontend build
app.use(express.static(path.join(__dirname, 'public')));

// Serve the React frontend `index.html` file for any route not starting with /api
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start the server
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Employee Service running on port ${PORT}`);
});
