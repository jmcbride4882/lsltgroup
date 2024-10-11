// src/App.js
import React, { useState } from 'react';
import axios from 'axios';
import './App.css';  // Make sure this file exists in the same directory

function App() {
  const [dniNie, setDniNie] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [employee, setEmployee] = useState(null);

  // Function to handle login submission
  const handleLogin = async (event) => {
    event.preventDefault(); // Prevents the page from reloading on form submission
    setErrorMessage('');    // Reset any previous error message

    try {
      // Call the backend API to authenticate the user
      const response = await axios.post('/api/employees/login', { dni_nie: dniNie, password });
      setIsLoggedIn(true);         // Set the logged-in state to true
      setEmployee(response.data.employee); // Store employee details from response
    } catch (error) {
      setErrorMessage('Invalid credentials. Please try again.');
      console.error('Error during login:', error);
    }
  };

  return (
    <div className="App">
      <header className="App-header">
        {!isLoggedIn ? (
          <div>
            <h1>Employee Portal Login</h1>
            <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div>
                <label htmlFor="dniNie">DNI/NIE:</label>
                <input
                  type="text"
                  id="dniNie"
                  value={dniNie}
                  onChange={(e) => setDniNie(e.target.value)}
                  required
                />
              </div>
              <div>
                <label htmlFor="password">Password:</label>
                <input
                  type="password"
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              {errorMessage && <p style={{ color: 'red' }}>{errorMessage}</p>}
              <button type="submit">Login</button>
            </form>
          </div>
        ) : (
          <div>
            <h1>Welcome to the Employee Portal</h1>
            <p>Employee: {employee.first_name} {employee.last_name}</p>
            <p>Role: {employee.role}</p>
          </div>
        )}
      </header>
    </div>
  );
}

export default App;
