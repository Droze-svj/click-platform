import React from 'react';
import { Card } from '@headlessui/react';
import { ChevronDownIcon } from '@heroicons/react/24/outline';

const NeuralStrategyHub = () => {
  return (
    <Card className="bg-gray-800 text-white shadow-md rounded-lg p-6 border border-gray-700">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">AI Content Strategy</h2>
        <ChevronDownIcon className="w-5 h-5" />
      </div>
      <p className="mt-2 text-gray-600">Hey there! This is a placeholder for the AI content strategy.</p>
    </Card>
  );
};

export default NeuralStrategyHub;
