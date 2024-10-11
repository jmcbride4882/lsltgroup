
// ~/lslt-portal/employee-service/models/employeeModel.js

const db = require('../config/db'); // Import the database configuration

// Function to create a new employee in the database
const createEmployee = async (dni_nie, first_name, last_name, role, hashedPassword) => {
  // Define the parameterized query with placeholders
  const text = 'INSERT INTO employees (dni_nie, first_name, last_name, role, password) VALUES($1, $2, $3, $4, $5) RETURNING *';
  const values = [dni_nie, first_name, last_name, role, hashedPassword]; // Array of values corresponding to the placeholders
  console.log("Executing query:", text, "with values:", values); // Debug log
  const res = await db.query(text, values); // Execute the query
  console.log("Query result:", res.rows[0]); // Debug log to check the result
  return res.rows[0]; // Return the created employee record
};

// Function to find an employee in the database by their DNI/NIE
const findEmployeeByDNI = async (dni_nie) => {
  // Define the parameterized query with a placeholder for dni_nie
  const text = 'SELECT * FROM employees WHERE dni_nie = $1';
  console.log("Searching for employee with DNI/NIE:", dni_nie); // Debug log
  const res = await db.query(text, [dni_nie]); // Execute the query
  console.log("Query result:", res.rows[0]); // Debug log to check the result
  return res.rows[0]; // Return the found employee record
};

module.exports = {
  createEmployee,
  findEmployeeByDNI,
};
