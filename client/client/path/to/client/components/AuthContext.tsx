import React from 'react';
import LogEmitter from '../utils/logEmitter';

const AuthContext = ({ children }) => {
  const login = async (username, password) => {
    try {
      // Simulate authentication
      await new Promise((resolve) => setTimeout(resolve, 1000));
      if (username === 'admin' && password === 'password') {
        LogEmitter.getInstance().log('[AUTH]: User Identity Verified - Session Started');
        return true;
      } else {
        throw new Error('Invalid credentials');
      }
    } catch (error) {
      console.error(error);
      return false;
    }
  };

  const logout = () => {
    LogEmitter.getInstance().log('[AUTH]: Session Terminated - Clearing Cache');
    // Simulate clearing cache
    setTimeout(() => {
      localStorage.removeItem('token');
    }, 1000);
  };

  return (
    <AuthContext.Provider value={{ login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
