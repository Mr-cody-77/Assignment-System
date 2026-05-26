import React, { useState, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import Sidebar from '../../components/Sidebar/Sidebar';
import Header from '../../components/Header/Header';
import TaskStatusCard from '../../components/TaskStatusCard/TaskStatusCard';
import EmptyState from '../../components/common/EmptyState';
import usePolling from '../../hooks/usePolling';
import { getTaskStatus } from '../../services/taskService';
import styles from './TaskStatus.module.css';

const FILTERS = ['All', 'Pending', 'Queued', 'Running', 'Completed', 'Failed'];

const ACTIVE_STATES = ['running', 'executing'];
const SUCCESS_STATES = ['completed', 'accepted', 'passed', 'success'];
const FAILED_STATES = ['failed', 'wrong_answer', 'compilation_error', 'runtime_error', 'time_limit_exceeded', 'memory_limit_exceeded'];

const categorizeStatus = (statusStr) => {
  const s = statusStr?.toLowerCase();
  if (s === 'pending') return 'pending';
  if (s === 'queued') return 'queued';
  if (ACTIVE_STATES.includes(s)) return 'running';
  if (SUCCESS_STATES.includes(s)) return 'completed';
  if (FAILED_STATES.includes(s)) return 'failed';
  return 'unknown';
};

const TaskStatus = () => {
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('All');
  const [lastRefresh, setLastRefresh] = useState(null);

  const fetchTasks = useCallback(async () => {
    try {
      const all = await getTaskStatus();
      const mine = all.filter((t) => t.roll_number === user?.username);
      setTasks(mine);
      setLastRefresh(new Date());
    } catch {
      // silently fail on background poll
    } finally {
      setLoading(false);
    }
  }, [user]);

  usePolling(fetchTasks, 5000, true);

  // Filter based on the categorized status rather than exact string match
  const filtered = activeFilter === 'All'
    ? tasks
    : tasks.filter((t) => categorizeStatus(t.status) === activeFilter.toLowerCase());

  // Count using the categorized status
  const counts = {
    pending: tasks.filter((t) => categorizeStatus(t.status) === 'pending').length,
    queued: tasks.filter((t) => categorizeStatus(t.status) === 'queued').length,
    running: tasks.filter((t) => categorizeStatus(t.status) === 'running').length,
    completed: tasks.filter((t) => categorizeStatus(t.status) === 'completed').length,
    failed: tasks.filter((t) => categorizeStatus(t.status) === 'failed').length,
  };
  
  const activeCount = counts.pending + counts.queued + counts.running;

  return (
    <div className="app-shell">
      <Sidebar role="student" isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="main-content">
        <Header
          title="Task Status"
          subtitle={activeCount > 0 ? `${activeCount} active task${activeCount !== 1 ? 's' : ''}` : 'All tasks idle'}
          onMenuToggle={() => setSidebarOpen(!sidebarOpen)}
        />
        <div className="page-body">
          {/* Live bar */}
          <div className={styles.liveBar}>
            <span className={styles.liveDot} />
            <span style={{ color: 'var(--clr-success)', fontWeight: 600 }}>Live</span>
            <span className={styles.refreshTime}>
              {lastRefresh ? `Updated ${lastRefresh.toLocaleTimeString()}` : 'Loading…'}
            </span>
          </div>

          {/* Summary badges */}
          <div className={styles.summaryBadges}>
            {Object.entries(counts).map(([key, val]) => (
              <span
                key={key}
                className={`badge ${
                  key === 'completed' ? 'badge-success' :
                  key === 'failed' ? 'badge-error' :
                  key === 'running' ? 'badge-info' :
                  'badge-warning'
                }`}
                style={{ fontSize: 12, padding: '4px 12px' }}
              >
                {key.charAt(0).toUpperCase() + key.slice(1)}: {val}
              </span>
            ))}
          </div>

          {/* Filter tabs */}
          <div className={styles.filterTabs}>
            {FILTERS.map((f) => (
              <button
                key={f}
                className={`${styles.filterTab} ${activeFilter === f ? styles.active : ''}`}
                onClick={() => setActiveFilter(f)}
              >
                {f}
              </button>
            ))}
          </div>

          {/* Tasks grid */}
          {loading ? (
            <div className={styles.tasksGrid}>
              {[1,2,3].map((i) => (
                <div key={i} style={{ background: 'var(--clr-surface)', borderRadius: 16, padding: 20, height: 200, animation: 'shimmer 1.5s infinite', backgroundImage: 'linear-gradient(90deg, #1a2340 25%, #1f2a4a 50%, #1a2340 75%)', backgroundSize: '200% 100%' }} />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon="⏳"
              title={activeFilter === 'All' ? 'No tasks yet' : `No ${activeFilter.toLowerCase()} tasks`}
              description={activeFilter === 'All' ? 'Submit a coding assignment to see your task status here.' : `No tasks with status "${activeFilter}".`}
            />
          ) : (
            <div className={styles.tasksGrid}>
              {filtered.map((task) => (
                <TaskStatusCard key={task.task_id} task={task} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TaskStatus;