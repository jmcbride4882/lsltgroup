// ~/lslt-portal/employee-service/routes/employeeRoutes.js

const express = require('express');
const { registerEmployee, loginEmployee } = require('../controllers/employeeController'); // Ensure correct import path
const router = express.Router();

console.log("registerEmployee:", registerEmployee); // Debug log
console.log("loginEmployee:", loginEmployee); // Debug log

// Define routes using the imported functions
router.post('/register', registerEmployee);
router.post('/login', loginEmployee);

module.exports = router;
