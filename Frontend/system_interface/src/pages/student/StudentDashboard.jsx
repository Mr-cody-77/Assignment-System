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
import { getAllTests } from '../../services/testService';
import Timer from '../../components/Timer/Timer';
import { stopLockdown } from '../../services/lockdownService';
import styles from './StudentDashboard.module.css';

const StudentDashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [assignments, setAssignments] = useState([]);
  const [taskCounts, setTaskCounts] = useState({ submitted: 0, pending: 0, running: 0 });
  const [liveTest, setLiveTest] = useState(null);

  const examActive = localStorage.getItem('exam_active') === 'true';
  const examDuration = parseInt(localStorage.getItem('exam_duration') || '60', 10);

  const handleExamEnd = async () => {
    try {
      await stopLockdown();
    } catch (err) {
      console.error('Failed to unlock ports:', err);
    }
    localStorage.removeItem('exam_active');
    localStorage.removeItem('exam_duration');
    localStorage.removeItem('exam_end_time');
    navigate('/student');
  };

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [asgRes, taskRes, testRes] = await Promise.allSettled([
          getAllAssignments(),
          getTaskStatus(),
          getAllTests(),
        ]);
        const asgn = asgRes.status === 'fulfilled' ? asgRes.value : [];
        const tasks = taskRes.status === 'fulfilled'
          ? taskRes.value.filter((t) => t.roll_number === user?.username)
          : [];
        const tests = testRes.status === 'fulfilled' ? testRes.value : [];
        
        if (tests.length > 0) {
          setLiveTest(tests[0]);
        }

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


  return (
    <div className="app-shell">
      <Sidebar role="student" isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="main-content">
        <Header
          title="Dashboard"
          subtitle={`Welcome back, ${user?.username || 'Student'}!`}
          onMenuToggle={() => setSidebarOpen(!sidebarOpen)}
          actions={
            examActive ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Timer durationMinutes={examDuration} onTimeUp={handleExamEnd} />
                <button className="btn btn-danger btn-sm" onClick={handleExamEnd}>
                  End Test
                </button>
              </div>
            ) : null
          }
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
            {examActive ? (
               <div className={styles.actionCard} style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid var(--clr-primary)' }} onClick={() => navigate('/student/tests')} role="button" tabIndex={0}>
                 <div className={styles.actionIcon} style={{ background: 'rgba(99,102,241,0.2)' }}>🚀</div>
                 <div>
                   <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--clr-primary)' }}>Continue Test</div>
                   <div style={{ fontSize: 13, color: 'var(--clr-text-2)' }}>Your test is currently active. Click here to return.</div>
                 </div>
               </div>
            ) : liveTest ? (
               <div className={styles.actionCard} style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid var(--clr-success)' }} onClick={() => navigate('/student/start-exam')} role="button" tabIndex={0}>
                 <div className={styles.actionIcon} style={{ background: 'rgba(16,185,129,0.2)' }}>📝</div>
                 <div>
                   <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--clr-success)' }}>Test Available: {liveTest.title}</div>
                   <div style={{ fontSize: 13, color: 'var(--clr-text-2)', marginTop: 4 }}>
                     <button className="btn btn-success btn-sm">Enter Test</button>
                   </div>
                 </div>
               </div>
            ) : null}

            <div className={styles.actionCard} onClick={() => navigate('/student/tasks')} role="button" tabIndex={0}>
              <div className={styles.actionIcon} style={{ background: 'rgba(16,185,129,0.15)' }}>⏳</div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>Task Status</div>
                <div style={{ fontSize: 13, color: 'var(--clr-text-2)' }}>Track your submitted tasks live</div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default StudentDashboard;
