import React from 'react';

const StatCard = ({ label, value, icon, color = '#6366f1', trend = null, onClick = null }) => {
  const iconBg = `${color}22`;

  return (
    <div
      className="stat-card"
      style={{ '--stat-accent': color, cursor: onClick ? 'pointer' : 'default' }}
      onClick={onClick}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div className="stat-label">{label}</div>
          <div className="stat-value" style={{ color }}>{value ?? '—'}</div>
        </div>
        {icon && (
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: iconBg,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 22,
              flexShrink: 0,
            }}
          >
            {icon}
          </div>
        )}
      </div>
      {trend !== null && (
        <div
          className="stat-sub"
          style={{ color: trend >= 0 ? 'var(--clr-success)' : 'var(--clr-error)', marginTop: 8 }}
        >
          {trend >= 0 ? '▲' : '▼'} {Math.abs(trend)}%{' '}
          <span style={{ color: 'var(--clr-text-3)' }}>vs last period</span>
        </div>
      )}
    </div>
  );
};

export default StatCard;
