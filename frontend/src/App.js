import React, { useState } from 'react';
import axios from 'axios';
import './App.css';
import logo from './Logo.png';
import Dashboard from './Dashboard';  // Import the new Dashboard component

function App() {
  const [dniNie, setDniNie] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [employee, setEmployee] = useState(null);

  const handleLogin = async (event) => {
    event.preventDefault();
    setErrorMessage('');

    try {
      const response = await axios.post('/api/employees/login', { dni_nie: dniNie, password });
      setIsLoggedIn(true);
      setEmployee(response.data.employee);
    } catch (error) {
      setErrorMessage('Invalid credentials. Please try again.');
    }
  };

  // Function to update employee after name change
  const updateEmployee = (updatedEmployee) => {
    setEmployee(updatedEmployee);
  };

  return (
    <div className="App">
      <header className="App-header">
        {!isLoggedIn ? (
          <div className="container">
            <img src={logo} alt="Company Logo" className="company-logo" />
            <h1>Employee Portal Login</h1>
            <form onSubmit={handleLogin}>
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
              {errorMessage && <p className="error-message">{errorMessage}</p>}
              <button type="submit">Login</button>
            </form>
          </div>
        ) : (
          <Dashboard employee={employee} updateEmployee={updateEmployee} />
        )}
      </header>

      {/* Footer section */}
      <footer className="footer">
        <p>Copyright &copy; Lakeside La Torre (Murcia) Group S.L.</p>
        <p>Developed and Built by John McBride</p>
      </footer>
    </div>
  );
}

export default App;
