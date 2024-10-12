const express = require('express');
const { registerEmployee, loginEmployee, updateEmployeeName } = require('../controllers/employeeController');
const router = express.Router();

// Route for employee registration
router.post('/register', registerEmployee);

// Route for employee login
router.post('/login', loginEmployee);

// Route to update employee name
router.put('/:id/update-name', (req, res, next) => {
  console.log(`Received request to update name for ID: ${req.params.id}`);
  next(); // Call the next middleware/handler
}, updateEmployeeName);  // Only keep this route definition

module.exports = router;
