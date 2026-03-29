'use client';

import React from 'react';
import { useEffect } from 'react';
import LogEmitter from '../utils/logEmitter';

const Layout = () => {
  useEffect(() => {
    // Add event listener for frame processing
    const handleFrameProcessed = (event) => {
      console.log('Frame processed:', event.detail);
      LogEmitter.emit('frameProcessed', event.detail);
    };

    // Add event listener for edit saving
    const handleEditSaved = (event) => {
      console.log('Edit saved:', event.detail);
      LogEmitter.emit('editSaved', event.detail);
    };

    window.addEventListener('frameProcessed', handleFrameProcessed);
    window.addEventListener('editSaved', handleEditSaved);

    // Cleanup function to remove event listeners
    return () => {
      window.removeEventListener('frameProcessed', handleFrameProcessed);
      window.removeEventListener('editSaved', handleEditSaved);
    };
  }, []);

  return (
    <div className="container mx-auto p-4">
      {/* Your dashboard UI */}
    </div>
  );
};

export default Layout;
