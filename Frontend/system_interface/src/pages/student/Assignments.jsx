import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Sidebar from '../../components/Sidebar/Sidebar';
import Header from '../../components/Header/Header';
import AssignmentCard from '../../components/AssignmentCard/AssignmentCard';
import { SkeletonCard } from '../../components/Loader/SkeletonLoader';
import EmptyState from '../../components/common/EmptyState';
import SearchBar from '../../components/SearchBar/SearchBar';
import usePolling from '../../hooks/usePolling';
import { getAllAssignments } from '../../services/assignmentService';
import { filterData } from '../../utils/helpers';
import styles from './Assignments.module.css';

const Assignments = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortOrder, setSortOrder] = useState('newest');
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchAssignments = useCallback(async () => {
    try {
      const data = await getAllAssignments();
      setAssignments(Array.isArray(data) ? data : []);
      setLastUpdated(new Date());
    } catch {
      // silently fail on polling errors
    } finally {
      setLoading(false);
    }
  }, []);

  usePolling(fetchAssignments, 10000, true);

  const filtered = filterData(assignments, search, ['title', 'description']);
  const sorted = [...filtered].sort((a, b) => {
    if (sortOrder === 'newest') return new Date(b.created_at) - new Date(a.created_at);
    return new Date(a.created_at) - new Date(b.created_at);
  });

  return (
    <div className="app-shell">
      <Sidebar role="student" isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="main-content">
        <Header
          title="Assignments"
          subtitle={`${assignments.length} problem${assignments.length !== 1 ? 's' : ''} available`}
          onMenuToggle={() => setSidebarOpen(!sidebarOpen)}
        />
        <div className="page-body">
          {/* Toolbar */}
          <div className={styles.toolbar}>
            <div className={styles.toolbarLeft}>
              <SearchBar value={search} onChange={setSearch} placeholder="Search assignments…" />
              <select
                className="form-select"
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
                style={{ maxWidth: 160 }}
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
              </select>
            </div>
            <div className={styles.toolbarRight}>
              <div className={styles.liveIndicator}>
                <span className={styles.liveDot} />
                Live
              </div>
              {lastUpdated && (
                <span className={styles.lastUpdated}>
                  Updated {lastUpdated.toLocaleTimeString()}
                </span>
              )}
            </div>
          </div>

          {/* Grid */}
          {loading ? (
            <div className={styles.assignmentsGrid}>
              {[1,2,3].map((i) => <SkeletonCard key={i} />)}
            </div>
          ) : sorted.length === 0 ? (
            <EmptyState
              icon="📝"
              title={search ? 'No matching assignments' : 'No assignments yet'}
              description={search ? 'Try a different search term.' : 'Your teacher hasn\'t posted any assignments yet.'}
            />
          ) : (
            <div className={styles.assignmentsGrid}>
              {sorted.map((a) => (
                /* --- MODIFIED WRAPPER TO SHOW COMPLETED BADGE --- */
                <div 
                  key={a.id} 
                  style={{ 
                    position: 'relative', 
                    opacity: a.is_solved ? 0.75 : 1, // Slightly dim solved assignments
                    transition: 'opacity 0.2s'
                  }}
                >
                  {a.is_solved && (
                    <div style={{
                      position: 'absolute',
                      top: '16px',
                      right: '16px',
                      zIndex: 10,
                      background: 'rgba(16, 185, 129, 0.9)',
                      color: 'white',
                      padding: '6px 12px',
                      borderRadius: '8px',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      pointerEvents: 'none', // Lets clicks pass through to the card
                      boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                    }}>
                      ✅ Completed
                    </div>
                  )}
                  <AssignmentCard
                    assignment={a}
                    onClick={() => navigate(`/student/assignments/${a.id}`)}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Assignments;