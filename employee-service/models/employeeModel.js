const db = require('../config/db'); // Import the database configuration

// Function to create a new employee in the database
const createEmployee = async (dni_nie, first_name, last_name, role, hashedPassword) => {
  const text = 'INSERT INTO employees (dni_nie, first_name, last_name, role, password) VALUES($1, $2, $3, $4, $5) RETURNING *';
  const values = [dni_nie, first_name, last_name, role, hashedPassword];
  console.log("Executing query:", text, "with values:", values);
  const res = await db.query(text, values);
  console.log("Query result:", res.rows[0]);
  return res.rows[0];
};

// Function to update employee name in the database
const updateEmployeeName = async (dni_nie, first_name, last_name) => {
  const query = 'UPDATE employees SET first_name = $1, last_name = $2 WHERE dni_nie = $3 RETURNING *';
  const values = [first_name, last_name, dni_nie];
  console.log('Executing query:', query);
  console.log('With values:', values);
  const { rows } = await db.query(query, values);
  return rows[0];
};

// Function to find an employee by DNI/NIE
const findEmployeeByDNI = async (dni_nie) => {
  const query = 'SELECT * FROM employees WHERE dni_nie = $1';
  console.log("Searching for employee with DNI/NIE:", dni_nie);
  const res = await db.query(query, [dni_nie]);
  console.log("Query result:", res.rows[0]);
  return res.rows[0];
};

// Export the functions
module.exports = {
  createEmployee,
  findEmployeeByDNI,
  updateEmployeeName,
};
