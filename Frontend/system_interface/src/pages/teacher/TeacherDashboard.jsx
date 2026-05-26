import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Sidebar from '../../components/Sidebar/Sidebar';
import Header from '../../components/Header/Header';
import StatCard from '../../components/common/StatCard';
import { SkeletonCard } from '../../components/Loader/SkeletonLoader';
import { getAllAssignments } from '../../services/assignmentService';
import { getResults } from '../../services/resultService';
import { getNodeInfo } from '../../services/nodeService';
import { getTaskStatus } from '../../services/taskService';
import { formatDate, formatScore, getStatusBadgeClass, formatStatus } from '../../utils/formatters';
import styles from './TeacherDashboard.module.css';

const TeacherDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [stats, setStats] = useState({ questions: 0, results: 0, nodes: 0, pending: 0 });
  const [recentResults, setRecentResults] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [questions, results, nodeInfo, tasks] = await Promise.allSettled([
          getAllAssignments(),
          getResults(),
          getNodeInfo(),
          getTaskStatus(),
        ]);
        const q = questions.status === 'fulfilled' ? questions.value : [];
        const r = results.status === 'fulfilled' ? results.value : [];
        const n = nodeInfo.status === 'fulfilled' ? nodeInfo.value : { nodes: [] };
        const t = tasks.status === 'fulfilled' ? tasks.value : [];

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

  const quickActions = [
    { icon: '📝', label: 'Add Assignment', desc: 'Create a new coding problem', path: '/teacher/add-assignment', color: '#6366f1' },
    { icon: '📊', label: 'View Results', desc: 'See all student submissions', path: '/teacher/results', color: '#10b981' },
    { icon: '🖥️', label: 'Node Monitor', desc: 'Monitor computing nodes', path: '/teacher/nodes', color: '#3b82f6' },
    { icon: '👤', label: 'Add User', desc: 'Add students or teachers', path: '/teacher/add-user', color: '#f59e0b' },
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
                label="Total Assignments"
                value={stats.questions}
                icon="📝"
                color="#6366f1"
                onClick={() => navigate('/teacher/assignments')}
              />
              <StatCard label="Total Submissions" value={stats.results} icon="📊" color="#10b981" />
              <StatCard label="Connected Nodes" value={stats.nodes} icon="🖥️" color="#3b82f6" />
              <StatCard label="Pending Tasks" value={stats.pending} icon="⏳" color="#f59e0b" />
            </div>
          )}

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
