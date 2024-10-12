const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const employeeModel = require('../models/employeeModel');
const fs = require('fs');
const path = require('path');

// Define the registerEmployee function
const registerEmployee = async (req, res) => {
  const { dni_nie, first_name, last_name, role, password } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  try {
    const newEmployee = await employeeModel.createEmployee(dni_nie, first_name, last_name, role, hashedPassword);
    res.status(201).json(newEmployee);
  } catch (error) {
    res.status(500).json({ error: 'Error creating employee' });
  }
};

// Define the function to update employee name
const updateEmployeeName = async (req, res) => {
  const { id } = req.params;
  const { first_name, last_name } = req.body;

  try {
    const employee = await employeeModel.findEmployeeById(id);
    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    employee.first_name = first_name;
    employee.last_name = last_name;
    await employeeModel.updateEmployeeName(id, first_name, last_name); // Ensure this function exists in your model
    res.status(200).json({ message: 'Employee name updated successfully', employee });
  } catch (error) {
    res.status(500).json({ error: 'Error updating name' });
  }
};

// Create a writable stream for the error log file
const logFilePath = path.join(__dirname, '../logs/login_errors.log');
const errorLogStream = fs.createWriteStream(logFilePath, { flags: 'a' });

const logError = (message) => {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;
  console.error(logMessage); // Log to console
  errorLogStream.write(logMessage); // Log to file
};

// Use logError in the loginEmployee function
const loginEmployee = async (req, res) => {
  const { dni_nie, password } = req.body;
  logError(`Login attempt with DNI/NIE: ${dni_nie}`);

  try {
    const employee = await employeeModel.findEmployeeByDNI(dni_nie);
    if (!employee) {
      logError(`Employee not found for DNI/NIE: ${dni_nie}`);
      return res.status(404).json({ error: 'Employee not found' });
    }

    logError(`Employee found: ${JSON.stringify(employee)}`);

    const isMatch = await bcrypt.compare(password, employee.password);
    logError(`Password comparison result for DNI/NIE ${dni_nie}: ${isMatch}`);

    if (!isMatch) {
      logError(`Password does not match for DNI/NIE: ${dni_nie}`);
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: employee.id, role: employee.role }, process.env.JWT_SECRET, { expiresIn: '1h' });
    logError(`JWT Token generated for DNI/NIE ${dni_nie}: ${token}`);
    res.json({ token, employee });
  } catch (error) {
    logError(`Error during login for DNI/NIE ${dni_nie}: ${error.message}`);
    res.status(500).json({ error: 'Error logging in' });
  }
};

// Export functions
module.exports = { registerEmployee, loginEmployee, updateEmployeeName };
