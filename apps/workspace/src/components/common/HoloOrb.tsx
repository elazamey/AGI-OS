import React from 'react';

interface HoloOrbProps {
  isStreaming?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export const HoloOrb: React.FC<HoloOrbProps> = ({ isStreaming = false, size = 'md' }) => {
  const sizeClasses = {
    sm: 'w-12 h-12',
    md: 'w-20 h-20',
    lg: 'w-28 h-28',
  };

  return (
    <div className={`relative flex items-center justify-center ${sizeClasses[size]}`}>
      <div className="absolute inset-0 rounded-full bg-cyan-400/10 blur-xl" />
      <div
        className={`absolute inset-0 rounded-full border border-cyan-400/40 border-t-transparent ${
          isStreaming ? 'animate-spin' : 'animate-[spin_8s_linear_infinite]'
        }`}
      />
      <div
        className={`absolute inset-2 rounded-full border border-purple-500/40 border-b-transparent ${
          isStreaming ? 'animate-spin-reverse' : 'animate-[spin_12s_linear_infinite_reverse]'
        }`}
      />
      <div className="w-2/3 h-2/3 rounded-full bg-gradient-to-br from-cyan-300 via-blue-500 to-purple-600 shadow-[0_0_25px_rgba(6,182,212,0.8)] flex items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.8),transparent_60%)]" />
        <span className="w-2 h-2 rounded-full bg-white shadow-[0_0_10px_#fff] animate-ping" />
      </div>
    </div>
  );
};
