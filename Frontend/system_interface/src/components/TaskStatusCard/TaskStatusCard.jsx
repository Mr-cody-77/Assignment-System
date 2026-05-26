import React, { useState } from 'react';
import ProgressBar from '../common/ProgressBar';
import { formatDate, formatStatus, getStatusBadgeClass } from '../../utils/formatters';
import styles from './TaskStatusCard.module.css';

// Grouping backend statuses into UI states
const ACTIVE_STATES = ['running', 'executing'];
const SUCCESS_STATES = ['completed', 'accepted', 'passed', 'success'];
const FAILED_STATES = ['failed', 'wrong_answer', 'compilation_error', 'runtime_error', 'time_limit_exceeded', 'memory_limit_exceeded'];

const getProgress = (statusStr) => {
  const s = statusStr?.toLowerCase();
  if (s === 'pending') return 5;
  if (s === 'queued') return 20;
  if (ACTIVE_STATES.includes(s)) return 65;
  if (SUCCESS_STATES.includes(s) || FAILED_STATES.includes(s)) return 100;
  return 0;
};

const TaskStatusCard = ({ task }) => {
  const [expanded, setExpanded] = useState(false);
  const {
    task_id, question_id, roll_number, status,
    assigned_node, created_at, updated_at, result,
  } = task;

  const currentStatus = status?.toLowerCase();
  const progress = getProgress(currentStatus);
  
  const isRunning = ACTIVE_STATES.includes(currentStatus);
  const isCompleted = SUCCESS_STATES.includes(currentStatus);
  const isFailed = FAILED_STATES.includes(currentStatus);

  const cardClass = [
    styles.card,
    isRunning ? styles.running : '',
    isCompleted ? styles.completed : '',
    isFailed ? styles.failed : '',
  ].filter(Boolean).join(' ');

  const shortId = task_id ? `${task_id.slice(0, 8)}…` : '—';

  return (
    <div className={cardClass}>
      <div className={styles.header}>
        <span className={styles.taskId}>ID: {shortId}</span>
        <span className={getStatusBadgeClass(status)}>
          {isRunning && <span style={{ marginRight: 4 }}>⟳</span>}
          {formatStatus(status)}
        </span>
      </div>

      <div className={styles.statusArea}>
        <ProgressBar
          value={progress}
          max={100}
          showValue={false}
          variant={isFailed ? 'danger' : isCompleted ? 'success' : 'default'}
        />
      </div>

      <div className={styles.meta}>
        <div>
          <div className={styles.metaLabel}>Question</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}>#{question_id || '—'}</div>
        </div>
        <div>
          <div className={styles.metaLabel}>Roll Number</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}>{roll_number || '—'}</div>
        </div>
        <div>
          <div className={styles.metaLabel}>Assigned Node</div>
          <div style={{ fontSize: 13 }}>
            {assigned_node
              ? `Node ${assigned_node.node_id} (${assigned_node.ip}:${assigned_node.port})`
              : 'Unassigned'}
          </div>
        </div>
        <div>
          <div className={styles.metaLabel}>Updated</div>
          <div style={{ fontSize: 12, color: 'var(--clr-text-2)' }}>{formatDate(updated_at)}</div>
        </div>
      </div>

      <div style={{ marginTop: 12, fontSize: 12, color: 'var(--clr-text-3)' }}>
        Created: {formatDate(created_at)}
      </div>

      {result && (
        <>
          <button
            className={styles.expandBtn}
            onClick={() => setExpanded((e) => !e)}
          >
            {expanded ? '▲ Hide Result' : '▼ View Result'}
          </button>
          {expanded && (
            <div className={styles.resultDetails}>
              <pre
                style={{
                  margin: 0,
                  fontSize: 12,
                  fontFamily: 'var(--font-mono)',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all',
                  color: 'var(--clr-text)',
                  background: 'var(--clr-bg)',
                  borderRadius: 6,
                  padding: '8px 12px',
                }}
              >
                {typeof result === 'object' ? JSON.stringify(result, null, 2) : String(result)}
              </pre>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default TaskStatusCard;