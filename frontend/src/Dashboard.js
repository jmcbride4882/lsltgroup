import React, { useState } from 'react';
import axios from 'axios';

function Dashboard({ employee, updateEmployee }) {
  const [editMode, setEditMode] = useState(false);
  const [firstName, setFirstName] = useState(employee.first_name);
  const [lastName, setLastName] = useState(employee.last_name);
  const [message, setMessage] = useState('');

  // Function to save name change
  const handleSaveNameChange = async () => {
    try {
      const response = await axios.put('/api/employees/updateName', {
        dni_nie: employee.dni_nie,
        first_name: firstName,
        last_name: lastName,
      });
      updateEmployee(response.data.employee);  // Update employee details
      setMessage('Name updated successfully.');
      setEditMode(false);
    } catch (error) {
      setMessage('Error updating name.');
      console.error(error);
    }
  };

  return (
    <div className="dashboard-container">
      <h1>Welcome to Your Dashboard</h1>
      {editMode ? (
        <div className="name-edit">
          <label>First Name:</label>
          <input
            type="text"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
          />
          <label>Last Name:</label>
          <input
            type="text"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
          />
          <button onClick={handleSaveNameChange}>Save</button>
          <button onClick={() => setEditMode(false)}>Cancel</button>
        </div>
      ) : (
        <>
          <p>
            Employee: {employee.first_name} {employee.last_name}
          </p>
          <button onClick={() => setEditMode(true)}>Edit Name</button>
        </>
      )}

      <p>Role: {employee.role}</p>

      {/* Quick Action Buttons */}
      <div className="dashboard-actions">
        <button onClick={() => alert('Clock In/Out feature coming soon!')}>
          Clock In / Out
        </button>
        <button onClick={() => alert('View Shifts feature coming soon!')}>
          View Shifts
        </button>
        {employee.role === 'Admin' && (
          <button onClick={() => alert('Admin Tools feature coming soon!')}>
            Admin Tools
          </button>
        )}
      </div>

      {/* Display feedback message */}
      {message && <p className="feedback-message">{message}</p>}
    </div>
  );
}

export default Dashboard;
