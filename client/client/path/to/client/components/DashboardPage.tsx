import React from 'react';
import { useAuthContext } from '../context/AuthContext';

const DashboardPage = () => {
  const authContext = useAuthContext();

  return (
    <div>
      <h1>Welcome, {authContext.user.name}!</h1>
      {/* Add your dashboard content here */}
    </div>
  );
};

export default DashboardPage;
