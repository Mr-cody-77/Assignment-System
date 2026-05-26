import React from 'react';

const SIZES = { sm: 16, md: 24, lg: 40, xl: 60 };

const Loader = ({ size = 'md', text = '', fullPage = false }) => {
  const px = SIZES[size] || SIZES.md;

  const spinner = (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
      <div
        style={{
          width: px,
          height: px,
          border: `${Math.max(2, px / 10)}px solid rgba(99,120,200,0.2)`,
          borderTopColor: '#6366f1',
          borderRadius: '50%',
          animation: 'spin 0.7s linear infinite',
          flexShrink: 0,
        }}
      />
      {text && (
        <p style={{ fontSize: 14, color: 'var(--clr-text-2)', margin: 0 }}>{text}</p>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  if (fullPage) {
    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(10,14,26,0.8)',
          zIndex: 500,
        }}
      >
        {spinner}
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 40,
      }}
    >
      {spinner}
    </div>
  );
};

export default Loader;
