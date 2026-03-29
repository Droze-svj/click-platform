import React from 'react';
import LogEmitter from '../utils/logEmitter';

const DashboardPage = () => {
  const handleLogin = async (event) => {
    event.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    if (await login(username, password)) {
      console.log('[AUTH]: User Identity Verified - Session Started');
      // Redirect to dashboard or perform other actions
    } else {
      console.error('[AUTH]: Invalid credentials');
    }
  };

  return (
    <div className="container mx-auto p-4">
      {/* Your dashboard UI */}
      <form onSubmit={handleLogin}>
        <input type="text" id="username" placeholder="Username" required />
        <input type="password" id="password" placeholder="Password" required />
        <button type="submit">Login</button>
      </form>
    </div>
  );
};

export default DashboardPage;
