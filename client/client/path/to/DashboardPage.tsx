import React from 'react';
import { Card } from '@headlessui/react';
import { ChevronDownIcon } from '@heroicons/react/24/outline';
import NeuralStrategyHub from '../components/NeuralStrategyHub';

const DashboardPage = () => {
  return (
    <div className="container mx-auto p-4">
      {/* Welcome message */}
      <h1 className="text-xl font-bold">Welcome to the Neural Strategy Hub</h1>
      {/* Neural Strategy Hub card */}
      <NeuralStrategyHub />
    </div>
  );
};

export default DashboardPage;
