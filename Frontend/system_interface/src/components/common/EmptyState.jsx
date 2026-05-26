import React from 'react';

const EmptyState = ({
  icon = '📭',
  title = 'No data found',
  description = '',
  action = null,
}) => (
  <div
    style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '48px 24px',
      textAlign: 'center',
      border: '1px dashed rgba(99,120,200,0.25)',
      borderRadius: 16,
      background: 'rgba(26,35,64,0.3)',
    }}
  >
    <span style={{ fontSize: 48, marginBottom: 16 }}>{icon}</span>
    <h3
      style={{
        fontSize: 18,
        fontWeight: 600,
        color: 'var(--clr-text)',
        marginBottom: description ? 8 : 0,
      }}
    >
      {title}
    </h3>
    {description && (
      <p
        style={{
          fontSize: 14,
          color: 'var(--clr-text-2)',
          maxWidth: 360,
          lineHeight: 1.6,
          marginBottom: action ? 20 : 0,
        }}
      >
        {description}
      </p>
    )}
    {action && <div>{action}</div>}
  </div>
);

export default EmptyState;
