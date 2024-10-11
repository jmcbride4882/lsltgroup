require('dotenv').config();


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

// Route to update employee name
app.put('/api/employees/:id', async (req, res) => {
  const { id } = req.params;
  const { first_name, last_name } = req.body;

  try {
    const employee = await Employee.findById(id);  // Adjust based on your database setup
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    // Update the employee's name
    employee.first_name = first_name;
    employee.last_name = last_name;

    await employee.save();  // Save the changes in the database

    res.json({ employee });  // Return the updated employee object
  } catch (error) {
    console.error('Error updating employee:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = app;

// Start the server
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Employee Service running on port ${PORT}`);
});
