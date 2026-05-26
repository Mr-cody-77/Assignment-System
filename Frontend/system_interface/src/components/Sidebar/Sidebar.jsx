import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import styles from './Sidebar.module.css';

const TEACHER_NAV = [
  { to: '/teacher', icon: 'DB', label: 'Dashboard', exact: true },
  { to: '/teacher/assignments', icon: 'AL', label: 'Assignments' },
  { to: '/teacher/add-assignment', icon: 'AS', label: 'Add Assignment' },
  { to: '/teacher/results', icon: 'RS', label: 'Student Results' },
  { to: '/teacher/analytics', icon: 'AN', label: 'Analytics' },
  { to: '/teacher/nodes', icon: 'ND', label: 'Node Connections' },
  { to: '/teacher/add-user', icon: 'US', label: 'Add User' },
];

const STUDENT_NAV = [
  { to: '/student', icon: 'DB', label: 'Dashboard', exact: true },
  { to: '/student/assignments', icon: 'AS', label: 'Assignments' },
  { to: '/student/tasks', icon: 'TS', label: 'Task Status' },
  { to: '/student/results', icon: 'RS', label: 'My Results' },
  { to: '/student/nodes', icon: 'ND', label: 'Node Connections' },
];

const Sidebar = ({ role, isOpen, onClose }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const navItems = role === 'teacher' ? TEACHER_NAV : STUDENT_NAV;

  const getInitials = (name = '') =>
    name.slice(0, 2).toUpperCase() || '??';

  const handleLogout = () => {
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
            <div className={styles.brandName}>Assignment System</div>
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
