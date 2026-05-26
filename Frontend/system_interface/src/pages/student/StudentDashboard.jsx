import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Sidebar from '../../components/Sidebar/Sidebar';
import Header from '../../components/Header/Header';
import StatCard from '../../components/common/StatCard';
import AssignmentCard from '../../components/AssignmentCard/AssignmentCard';
import { SkeletonCard } from '../../components/Loader/SkeletonLoader';
import { getAllAssignments } from '../../services/assignmentService';
import { getTaskStatus } from '../../services/taskService';
import styles from './StudentDashboard.module.css';

const StudentDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [assignments, setAssignments] = useState([]);
  const [taskCounts, setTaskCounts] = useState({ submitted: 0, pending: 0, running: 0 });

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [asgRes, taskRes] = await Promise.allSettled([
          getAllAssignments(),
          getTaskStatus(),
        ]);
        const asgn = asgRes.status === 'fulfilled' ? asgRes.value : [];
        const tasks = taskRes.status === 'fulfilled'
          ? taskRes.value.filter((t) => t.roll_number === user?.username)
          : [];
        setAssignments(Array.isArray(asgn) ? asgn : []);
        setTaskCounts({
          submitted: tasks.filter((t) => ['completed', 'failed'].includes(t.status?.toLowerCase())).length,
          pending: tasks.filter((t) => ['pending', 'queued'].includes(t.status?.toLowerCase())).length,
          running: tasks.filter((t) => t.status?.toLowerCase() === 'running').length,
        });
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, [user]);

  const recentAssignments = assignments.slice(-3).reverse();

  return (
    <div className="app-shell">
      <Sidebar role="student" isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="main-content">
        <Header
          title="Dashboard"
          subtitle={`Welcome back, ${user?.username || 'Student'}!`}
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
              <StatCard label="Available Assignments" value={assignments.length} icon="📝" color="#6366f1" />
              <StatCard label="Submitted" value={taskCounts.submitted} icon="✅" color="#10b981" />
              <StatCard label="Pending Tasks" value={taskCounts.pending} icon="⏳" color="#f59e0b" />
              <StatCard label="Running" value={taskCounts.running} icon="⚡" color="#3b82f6" />
            </div>
          )}

          {/* Quick Actions */}
          <div className={styles.quickActions}>
            <div className={styles.actionCard} onClick={() => navigate('/student/assignments')} role="button" tabIndex={0}>
              <div className={styles.actionIcon} style={{ background: 'rgba(99,102,241,0.15)' }}>📝</div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>Browse Assignments</div>
                <div style={{ fontSize: 13, color: 'var(--clr-text-2)' }}>View and solve coding problems</div>
              </div>
            </div>
            <div className={styles.actionCard} onClick={() => navigate('/student/tasks')} role="button" tabIndex={0}>
              <div className={styles.actionIcon} style={{ background: 'rgba(16,185,129,0.15)' }}>⏳</div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>Task Status</div>
                <div style={{ fontSize: 13, color: 'var(--clr-text-2)' }}>Track your submitted tasks live</div>
              </div>
            </div>
          </div>

          {/* Recent Assignments */}
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Recent Assignments</h2>
            <button className="btn btn-ghost btn-sm" onClick={() => navigate('/student/assignments')}>
              View All →
            </button>
          </div>
          {loading ? (
            <div className={styles.assignmentsGrid}>
              {[1,2,3].map((i) => <SkeletonCard key={i} />)}
            </div>
          ) : recentAssignments.length === 0 ? (
            <p style={{ color: 'var(--clr-text-3)', fontSize: 14 }}>No assignments available yet.</p>
          ) : (
            <div className={styles.assignmentsGrid}>
              {recentAssignments.map((a) => (
                <AssignmentCard
                  key={a.id}
                  assignment={a}
                  onClick={() => navigate(`/student/assignments/${a.id}`)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StudentDashboard;
