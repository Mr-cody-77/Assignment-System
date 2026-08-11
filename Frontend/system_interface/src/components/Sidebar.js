import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { logout, selectUser, selectIsTeacher } from '../store/authSlice';

const STUDENT_NAV = [
  { to: '/student', label: 'Dashboard', icon: '⊞', end: true },
  { to: '/student/assignments', label: 'Assignments', icon: '📚' },
  { to: '/student/history', label: 'My Submissions', icon: '📋' },
];

const TEACHER_NAV = [
  { to: '/teacher', label: 'Dashboard', icon: '⊞', end: true },
  { to: '/teacher/assignments', label: 'Assignments', icon: '📚' },
  { to: '/teacher/submissions', label: 'Submissions', icon: '📋' },
  { to: '/teacher/analytics', label: 'Analytics', icon: '📊' },
  { to: '/teacher/nodes', label: 'Node Monitor', icon: '🖥' },
];

export default function Sidebar() {
  const user = useSelector(selectUser);
  const isTeacher = useSelector(selectIsTeacher);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const nav = isTeacher ? TEACHER_NAV : STUDENT_NAV;

  const handleLogout = async (e) => {
    e.preventDefault();
    const examActive = localStorage.getItem('exam_active') === 'true';
    if (examActive) {
      if (!window.confirm("A test is currently active. Logging out will auto-submit your test and current code. Do you wish to proceed?")) {
        return;
      }
      
      const email = window.prompt("Please enter your preferred email to receive your final score and plagiarism check results:");
      if (email) {
        localStorage.setItem('preferred_email', email);
      }
      
      // Tell CodingInterface to submit the current code
      window.dispatchEvent(new Event('exam-force-submit'));
      
      // Wait a moment for code submission to queue
      await new Promise(r => setTimeout(r, 1000));
      
      try {
        const testId = localStorage.getItem('exam_test_id');
        if (testId) {
          // Dynamic import to avoid circular dependency issues if any
          const { submitTest } = await import('../../services/testService');
          await submitTest(testId);
        }
      } catch (err) {
        console.error("Failed to auto-submit test during logout:", err);
      }
      
      localStorage.removeItem('exam_active');
      localStorage.removeItem('exam_duration');
      localStorage.removeItem('exam_test_id');
    }
    
    dispatch(logout()); 
    navigate('/login'); 
  };

  const initials = user
    ? `${user.first_name?.[0] || ''}${user.last_name?.[0] || ''}`.toUpperCase() || user.username?.[0]?.toUpperCase()
    : '?';

  return (
    <aside className="sidebar">
      {/* Brand */}
      <div className="sidebar-brand">
        <div className="sidebar-brand-logo">⚡</div>
        <div>
          <div className="sidebar-brand-name">CodeLab</div>
          <div className="sidebar-brand-sub">CodeMesh</div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav">
        <div className="nav-section-label">Menu</div>
        {nav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
          >
            <span className="nav-icon">{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* User Footer */}
      <div className="sidebar-footer">
        <div className="user-card">
          <div className="user-avatar">{initials}</div>
          <div style={{flex:1,minWidth:0}}>
            <div className="user-name truncate">{user?.first_name || user?.username}</div>
            <div className="user-role">{user?.role} {user?.roll_number ? `• ${user.roll_number}` : ''}</div>
          </div>
        </div>
        <button
          id="btn-logout"
          className="btn btn-ghost w-full btn-sm"
          style={{marginTop:8}}
          onClick={handleLogout}
        >
          🚪 Sign Out
        </button>
      </div>
    </aside>
  );
}
