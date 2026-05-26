import React from 'react';

const BAR_COLORS = {
  default: 'linear-gradient(90deg, #6366f1, #818cf8)',
  success: 'linear-gradient(90deg, #10b981, #34d399)',
  warn:    'linear-gradient(90deg, #f59e0b, #fb923c)',
  danger:  'linear-gradient(90deg, #ef4444, #f87171)',
};

const ProgressBar = ({
  value = 0,
  max = 100,
  label = '',
  showValue = true,
  variant = 'default',
}) => {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  const autoVariant = pct >= 90 ? 'danger' : pct >= 75 ? 'warn' : variant;
  const gradient = BAR_COLORS[autoVariant] || BAR_COLORS.default;

  return (
    <div>
      {(label || showValue) && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginBottom: 4,
            fontSize: 12,
            color: 'var(--clr-text-2)',
          }}
        >
          {label && <span>{label}</span>}
          {showValue && <span style={{ fontWeight: 600 }}>{pct.toFixed(0)}%</span>}
        </div>
      )}
      <div className="progress-bar-wrap">
        <div
          className="progress-bar"
          style={{
            width: `${pct}%`,
            background: gradient,
            transition: 'width 0.4s ease',
          }}
        />
      </div>
    </div>
  );
};

export default ProgressBar;
