import React, { useState } from 'react';
import axios from 'axios';

function Dashboard({ employee, updateEmployee }) {
  const [editingName, setEditingName] = useState(false);
  const [firstName, setFirstName] = useState(employee.first_name);
  const [lastName, setLastName] = useState(employee.last_name);
  const [message, setMessage] = useState('');

  // Function to handle name change submission
  const handleNameChange = async (e) => {
    e.preventDefault();
    setMessage('');  // Clear previous messages

    try {
      const response = await axios.put(`/api/employees/${employee.id}`, {
        first_name: firstName,
        last_name: lastName,
      });

      if (response.status === 200) {
        updateEmployee(response.data.employee);  // Update employee in parent component
        setEditingName(false);
        setMessage('Name successfully updated!');
      } else {
        setMessage('Error updating name. Please try again.');
      }
    } catch (error) {
      console.error('Error updating name:', error);
      setMessage('Error updating name. Please try again.');
    }
  };

  return (
    <div className="dashboard-container">
      <h1>Welcome to Your Dashboard</h1>
      {editingName ? (
        <form onSubmit={handleNameChange}>
          <div className="form-group">
            <label htmlFor="first_name">First Name:</label>
            <input
              type="text"
              id="first_name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="last_name">Last Name:</label>
            <input
              type="text"
              id="last_name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              required
            />
          </div>
          <button type="submit">Save Changes</button>
        </form>
      ) : (
        <>
          <p>Employee: {employee.first_name} {employee.last_name}</p>
          <p>Role: {employee.role}</p>
          <button onClick={() => setEditingName(true)}>Edit Name</button>
        </>
      )}
      {message && <p>{message}</p>}
      
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

      {/* Placeholder for Announcements */}
      <div className="dashboard-announcements">
        <h2>Announcements</h2>
        <p>No new announcements at the moment.</p>
      </div>
    </div>
  );
}

export default Dashboard;
