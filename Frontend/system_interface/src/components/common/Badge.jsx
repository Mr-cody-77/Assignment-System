import React from 'react';

const VARIANT_MAP = {
  success: 'badge-success',
  error:   'badge-error',
  warning: 'badge-warning',
  info:    'badge-info',
  neutral: 'badge-neutral',
};

const SIZE_STYLES = {
  sm: { fontSize: 10, padding: '2px 6px' },
  md: { fontSize: 11, padding: '2px 10px' },
  lg: { fontSize: 13, padding: '4px 12px' },
};

const Badge = ({ children, variant = 'neutral', size = 'md' }) => (
  <span
    className={`badge ${VARIANT_MAP[variant] || 'badge-neutral'}`}
    style={SIZE_STYLES[size] || SIZE_STYLES.md}
  >
    {children}
  </span>
);

export default Badge;
