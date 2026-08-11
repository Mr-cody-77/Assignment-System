import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getTestById, getAllTests } from '../../services/testService';
import styles from './Sidebar.module.css';

const TEACHER_NAV = [
  { to: '/teacher', icon: 'DB', label: 'Dashboard', exact: true },
  { to: '/teacher/tests', icon: 'TS', label: 'Tests' },
  { to: '/teacher/create-test', icon: 'CT', label: 'Create Test' },
  { to: '/teacher/results', icon: 'RS', label: 'Student Results' },
  { to: '/teacher/flagged', icon: 'FG', label: 'Flagged Submissions' },
  { to: '/teacher/analytics', icon: 'AN', label: 'Analytics' },
  { to: '/teacher/nodes', icon: 'ND', label: 'Node Connections' },
  { to: '/teacher/add-user', icon: 'US', label: 'Add User' },
  { to: '/teacher/code-review', icon: 'CR', label: 'Code Review' },
];

const STUDENT_NAV = [
  { to: '/student', icon: 'DB', label: 'Dashboard', exact: true },
  { to: '/student/tests', icon: 'TS', label: 'Test Questions' },
  { to: '/student/tasks', icon: 'TS', label: 'Task Status' },
  { to: '/student/results', icon: 'RS', label: 'My Results' },
  { to: '/student/nodes', icon: 'ND', label: 'Node Connections' },
];

const Sidebar = ({ role, isOpen, onClose }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const navItems = role === 'teacher' ? TEACHER_NAV : STUDENT_NAV;
  const examActive = localStorage.getItem('exam_active') === 'true';
  const [activeTest, setActiveTest] = useState(null);

  useEffect(() => {
    if (role === 'student' && examActive) {
      const testId = localStorage.getItem('exam_test_id');
      if (testId) {
        getTestById(testId)
          .then((test) => {
            if (test) setActiveTest(test);
          })
          .catch((err) => console.error("Failed to fetch test for sidebar", err));
      } else {
        getAllTests()
          .then((tests) => {
            if (tests && tests.length > 0) setActiveTest(tests[0]);
          })
          .catch((err) => console.error("Failed to fetch test for sidebar", err));
      }
    }
  }, [role, examActive]);

  const getInitials = (name = '') =>
    name.slice(0, 2).toUpperCase() || '??';

  const handleLogout = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (examActive) {
      if (!window.confirm("A test is currently active. Logging out will auto-submit your test and current code. Do you wish to proceed?")) {
        return;
      }
      
      // Tell CodingInterface to submit the current code
      window.dispatchEvent(new Event('exam-force-submit'));
      
      // Wait a moment for code submission to queue
      await new Promise(r => setTimeout(r, 1000));
      
      try {
        const testId = localStorage.getItem('exam_test_id');
        if (testId) {
          const { submitTest } = await import('../../services/testService');
          await submitTest(testId);
        }
      } catch (err) {
        console.error("Failed to auto-submit test during logout:", err);
      }

      localStorage.removeItem('exam_active');
      localStorage.removeItem('exam_duration');
      localStorage.removeItem('exam_end_time');
      localStorage.removeItem('exam_test_id');
    }
    logout();
    navigate('/login');
  };

  return (
    <>
      {isOpen && (
        <div
          className={styles.backdrop}
          onClick={onClose}
          aria-label="Close sidebar"
        />
      )}

      <aside className={`${styles.sidebar} ${isOpen ? styles.open : ''}`}>
        <div className={styles.brand}>
          <div className={styles.brandIcon}>AE</div>
          <div>
            <div className={styles.brandName}>CodeMesh</div>
            <div className={styles.brandSub}>Eval Platform</div>
          </div>
        </div>

        <nav className={styles.nav}>
          <div className={styles.navSection}>
            {role === 'teacher' ? 'Teacher Menu' : 'Student Menu'}
          </div>

          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.exact}
              className={({ isActive }) =>
                `${styles.navItem} ${isActive ? styles.active : ''}`
              }
              onClick={() => {
                if (window.innerWidth < 900) onClose?.();
              }}
            >
              <span className={styles.navIcon}>{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}

          {role === 'student' && examActive && (
            <div style={{ marginTop: '24px' }}>
              <div className={styles.navSection} style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingBottom: '8px' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#ef4444', animation: `${styles.pulseLive} 2s cubic-bezier(0.4, 0, 0.6, 1) infinite` }} />
                Live Test
              </div>
              <button 
                className="btn btn-secondary btn-sm" 
                style={{ width: 'calc(100% - 24px)', margin: '0 auto 16px auto', display: 'block', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)' }}
                onClick={() => {
                  navigate('/student/tests');
                  if (window.innerWidth < 900) onClose?.();
                }}
              >
                Go to Test
              </button>
              {activeTest?.questions && activeTest.questions.length > 0 && (
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', padding: '0 12px' }}>
                  {activeTest.questions.map((q, idx) => (
                    <NavLink
                      key={q.id}
                      to={`/student/tests/question/${q.id}`}
                      className={({ isActive }) => 
                        isActive 
                          ? `${styles.questionBubble} ${styles.questionBubbleActive}` 
                          : styles.questionBubble
                      }
                      onClick={() => {
                        if (window.innerWidth < 900) onClose?.();
                      }}
                    >
                      Q{idx + 1}
                    </NavLink>
                  ))}
                </div>
              )}
            </div>
          )}
        </nav>

        <div className={styles.footer}>
          <div className={styles.userCard}>
            <div className={styles.userAvatar}>{getInitials(user?.username)}</div>
            <div>
              <div className={styles.userName}>{user?.username || 'User'}</div>
              <div className={styles.userRole}>{user?.role || 'unknown'}</div>
            </div>
          </div>
          <button className={`btn btn-ghost ${styles.logoutBtn}`} onClick={handleLogout}>
            Logout
          </button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
