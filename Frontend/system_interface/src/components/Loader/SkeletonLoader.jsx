import React from 'react';

const shimmerStyle = {
  background: 'linear-gradient(90deg, #1a2340 25%, #1f2a4a 50%, #1a2340 75%)',
  backgroundSize: '200% 100%',
  animation: 'shimmer 1.5s infinite',
  borderRadius: 6,
};

const SkeletonLoader = ({ rows = 3, height = 20, width = '100%', style = {} }) => (
  <>
    <style>{`
      @keyframes shimmer {
        0%   { background-position: 200% 0; }
        100% { background-position: -200% 0; }
      }
    `}</style>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, ...style }}>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          style={{
            ...shimmerStyle,
            height,
            width: typeof width === 'function' ? width(i) : width,
            opacity: 1 - i * 0.1,
          }}
        />
      ))}
    </div>
  </>
);

export const SkeletonCard = () => (
  <>
    <style>{`
      @keyframes shimmer {
        0%   { background-position: 200% 0; }
        100% { background-position: -200% 0; }
      }
    `}</style>
    <div
      style={{
        background: '#1a2340',
        border: '1px solid rgba(99,120,200,0.18)',
        borderRadius: 16,
        padding: 20,
      }}
    >
      {/* Title skeleton */}
      <div
        style={{ ...shimmerStyle, height: 20, width: '60%', marginBottom: 16 }}
      />
      {/* Text lines */}
      {[100, 85, 70].map((w, i) => (
        <div
          key={i}
          style={{
            ...shimmerStyle,
            height: 14,
            width: `${w}%`,
            marginBottom: 8,
          }}
        />
      ))}
    </div>
  </>
);

export default SkeletonLoader;
