import React from 'react';
import { formatDate, truncateText } from '../../utils/formatters';
import styles from './AssignmentCard.module.css';

const AssignmentCard = ({ assignment, onClick }) => {
  const { id, title, description, test_cases = [], created_at } = assignment;

  return (
    <div className={styles.card} onClick={onClick} role="button" tabIndex={0}>
      <div className={styles.accentBar} />
      <div className={styles.header}>
        <h3 className={styles.title}>{title}</h3>
        <span className={styles.idBadge}>#{id}</span>
      </div>

      <p className={styles.description}>
        {truncateText(description || 'No description provided.', 140)}
      </p>

      <div className={styles.footer}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span className={styles.meta}>📅 {formatDate(created_at)}</span>
          <span className="badge badge-info" style={{ fontSize: 10 }}>
            {test_cases.length} test{test_cases.length !== 1 ? 's' : ''}
          </span>
        </div>
        <button className="btn btn-primary btn-sm" onClick={(e) => { e.stopPropagation(); onClick?.(); }}>
          Solve →
        </button>
      </div>
    </div>
  );
};

export default AssignmentCard;
