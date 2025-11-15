
import React from 'react';

const LoadingSpinner: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center space-y-6 text-center">
      <div className="flex items-center justify-center space-x-2">
        <div className="h-4 w-4 rounded-full bg-pink-500 animate-pulse [animation-delay:-0.3s]"></div>
        <div className="h-4 w-4 rounded-full bg-cyan-400 animate-pulse [animation-delay:-0.15s]"></div>
        <div className="h-4 w-4 rounded-full bg-pink-500 animate-pulse"></div>
      </div>
      <p className="text-lg font-semibold text-gray-200 tracking-widest uppercase">
        Consulting the AI Oracles...
      </p>
    </div>
  );
};

export default LoadingSpinner;
