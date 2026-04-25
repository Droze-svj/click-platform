import React, { useState, useEffect } from 'react';

const LogEmitter = {
  emit: (event: string, message: string) => {
    console.log(`Event ${event}: ${message}`);
  }
};

const DirectorLog: React.FC = () => {
  const [logData, setLogData] = useState<string[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    // Simulate lazy loading of log data
    setTimeout(() => {
      LogEmitter.emit('LOG', 'System Status: 8GB Apex Optimized');
      LogEmitter.emit('LOG', 'Last update: 2023-10-05T14:30:00Z');
      LogEmitter.emit('LOG', 'CPU Usage: 15%');
      LogEmitter.emit('LOG', 'Memory Usage: 75%');

      setIsLoaded(true);
    }, 1000); // Simulate a delay of 1 second
  }, []);

  return (
    <div className="click-terminal">
      {isLoaded ? (
        logData.map((line, index) => (
          <div key={index} className="click-log-line">{line}</div>
        ))
      ) : (
        <div>Loading...</div>
      )}
    </div>
  );
};

export default DirectorLog;
