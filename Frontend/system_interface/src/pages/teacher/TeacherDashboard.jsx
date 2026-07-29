import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Sidebar from '../../components/Sidebar/Sidebar';
import Header from '../../components/Header/Header';
import StatCard from '../../components/common/StatCard';
import { SkeletonCard } from '../../components/Loader/SkeletonLoader';
import { getAllTests } from '../../services/testService';
import { getResults } from '../../services/resultService';
import { getNodeInfo } from '../../services/nodeService';
import { getTaskStatus } from '../../services/taskService';
import { getSchedule, setSchedule } from '../../services/scheduleService';
import { formatDate, formatScore, getStatusBadgeClass, formatStatus } from '../../utils/formatters';
import styles from './TeacherDashboard.module.css';

const TeacherDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [stats, setStats] = useState({ questions: 0, results: 0, nodes: 0, pending: 0 });
  const [recentResults, setRecentResults] = useState([]);
  const [loading, setLoading] = useState(true);

  // Lockdown Schedule State
  const [schedule, setScheduleData] = useState({ startTime: '', endTime: '', isActive: true });
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [scheduleMessage, setScheduleMessage] = useState('');

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [tests, results, nodeInfo, tasks, sched] = await Promise.allSettled([
          getAllTests(),
          getResults(),
          getNodeInfo(),
          getTaskStatus(),
          getSchedule(),
        ]);
        const q = tests.status === 'fulfilled' ? tests.value : [];
        const r = results.status === 'fulfilled' ? results.value : [];
        const n = nodeInfo.status === 'fulfilled' ? nodeInfo.value : { nodes: [] };
        const t = tasks.status === 'fulfilled' ? tasks.value : [];
        if (sched.status === 'fulfilled' && sched.value) {
          // Format for datetime-local input
          const s = sched.value;
          const formatLocal = (isoString) => {
            const d = new Date(isoString);
            // Convert to YYYY-MM-DDThh:mm
            return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
          };
          setScheduleData({
            startTime: formatLocal(s.start_time),
            endTime: formatLocal(s.end_time),
            isActive: s.is_active
          });
        }

        const pendingCount = t.filter((task) =>
          ['pending', 'queued'].includes(task.status?.toLowerCase())
        ).length;

        setStats({
          questions: q.length,
          results: r.length,
          nodes: n.nodes?.length || 0,
          pending: pendingCount,
        });
        setRecentResults(r.slice(-5).reverse());
      } catch {
        // Individual failures handled by allSettled
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, []);

  const handleScheduleSubmit = async (e) => {
    e.preventDefault();
    setScheduleLoading(true);
    setScheduleMessage('');
    try {
      // Inputs are in local time, converting to ISO string (UTC) for backend
      const startIso = new Date(schedule.startTime).toISOString();
      const endIso = new Date(schedule.endTime).toISOString();
      await setSchedule(startIso, endIso);
      setScheduleMessage('Schedule updated successfully!');
    } catch (error) {
      setScheduleMessage('Failed to update schedule.');
    } finally {
      setScheduleLoading(false);
    }
  };

  const quickActions = [
    { icon: '📝', label: 'Create Test', desc: 'Create a new test', path: '/teacher/create-test', color: '#6366f1' },
    { icon: '📊', label: 'View Results', desc: 'See all student submissions', path: '/teacher/results', color: '#10b981' },
    { icon: '🖥️', label: 'Node Monitor', desc: 'Monitor computing nodes', path: '/teacher/nodes', color: '#3b82f6' },
    { icon: '👤', label: 'Add User', desc: 'Add students or teachers', path: '/teacher/add-user', color: '#f59e0b' },
    { icon: '🔍', label: 'Code Review', desc: 'Review student code', path: '/teacher/code-review', color: '#8b5cf6' },
  ];

  return (
    <div className="app-shell">
      <Sidebar role="teacher" isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="main-content">
        <Header
          title="Dashboard"
          subtitle={`Welcome back, ${user?.username || 'Teacher'}!`}
          onMenuToggle={() => setSidebarOpen(!sidebarOpen)}
        />
        <div className="page-body">
          {/* Stats */}
          {loading ? (
            <div className={styles.statsGrid}>
              {[1,2,3,4].map((i) => <SkeletonCard key={i} />)}
            </div>
          ) : (
            <div className={styles.statsGrid}>
              <StatCard
                label="Total Tests"
                value={stats.questions}
                icon="📝"
                color="#6366f1"
                onClick={() => navigate('/teacher/tests')}
              />
              <StatCard label="Total Submissions" value={stats.results} icon="📊" color="#10b981" />
              <StatCard label="Connected Nodes" value={stats.nodes} icon="🖥️" color="#3b82f6" />
              <StatCard label="Pending Tasks" value={stats.pending} icon="⏳" color="#f59e0b" />
            </div>
          )}

          {/* Lockdown Scheduler */}
          <h2 className={styles.sectionTitle}>Lockdown Scheduler (IST)</h2>
          <div className={styles.scheduleCard} style={{ background: 'var(--clr-surface)', padding: 20, borderRadius: 12, marginBottom: 24, border: '1px solid var(--clr-border)' }}>
            <form onSubmit={handleScheduleSubmit} style={{ display: 'flex', gap: 20, alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <label style={{ fontSize: 13, color: 'var(--clr-text-2)', fontWeight: 500 }}>Start Time</label>
                <input 
                  type="datetime-local" 
                  value={schedule.startTime}
                  onChange={(e) => setScheduleData({...schedule, startTime: e.target.value})}
                  required
                  style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid var(--clr-border)', background: 'var(--clr-bg)', color: 'var(--clr-text-1)' }}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <label style={{ fontSize: 13, color: 'var(--clr-text-2)', fontWeight: 500 }}>End Time</label>
                <input 
                  type="datetime-local" 
                  value={schedule.endTime}
                  onChange={(e) => setScheduleData({...schedule, endTime: e.target.value})}
                  required
                  style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid var(--clr-border)', background: 'var(--clr-bg)', color: 'var(--clr-text-1)' }}
                />
              </div>
              <button 
                type="submit" 
                disabled={scheduleLoading}
                style={{ padding: '10px 20px', borderRadius: 8, background: 'var(--clr-primary)', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 600, height: 40 }}
              >
                {scheduleLoading ? 'Saving...' : 'Save Schedule'}
              </button>
              {scheduleMessage && (
                <span style={{ fontSize: 14, color: scheduleMessage.includes('success') ? '#10b981' : '#ef4444' }}>
                  {scheduleMessage}
                </span>
              )}
            </form>
          </div>

          {/* Quick Actions */}
          <h2 className={styles.sectionTitle}>Quick Actions</h2>
          <div className={styles.quickActions}>
            {quickActions.map((a) => (
              <div
                key={a.path}
                className={styles.actionCard}
                onClick={() => navigate(a.path)}
                role="button"
                tabIndex={0}
              >
                <div
                  className={styles.actionIcon}
                  style={{ background: `${a.color}22`, border: `1px solid ${a.color}44` }}
                >
                  {a.icon}
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 2 }}>{a.label}</div>
                  <div style={{ fontSize: 13, color: 'var(--clr-text-2)' }}>{a.desc}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Recent Results */}
          <h2 className={styles.sectionTitle}>Recent Submissions</h2>
          {recentResults.length === 0 ? (
            <p style={{ color: 'var(--clr-text-3)', fontSize: 14 }}>No submissions yet.</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Roll Number</th>
                    <th>Question</th>
                    <th>Status</th>
                    <th>Score</th>
                    <th>Submitted</th>
                  </tr>
                </thead>
                <tbody>
                  {recentResults.map((r) => (
                    <tr key={r.id}>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{r.roll_number}</td>
                      <td>#{r.question_id}</td>
                      <td>
                        <span className={getStatusBadgeClass(r.status)}>
                          {formatStatus(r.status)}
                        </span>
                      </td>
                      <td>{formatScore(r.score)}</td>
                      <td style={{ fontSize: 12, color: 'var(--clr-text-2)' }}>{formatDate(r.submitted_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}


        </div>
      </div>
    </div>
  );
};

export default TeacherDashboard;
