import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import Sidebar from '../../components/Sidebar/Sidebar';
import Header from '../../components/Header/Header';
import NodeTable from '../../components/NodeTable/NodeTable';
import StatCard from '../../components/common/StatCard';
import { getNodeInfo } from '../../services/nodeService';
import { useToast } from '../../hooks/useToast';
import styles from './TeacherNodeConnections.module.css';

const TeacherNodeConnections = () => {
  const { user } = useAuth();
  const { addToast } = useToast();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const res = await getNodeInfo();
      setData(res);
    } catch {
      addToast('Failed to fetch node information', 'error');
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, 15000);
    return () => clearInterval(id);
  }, [fetchData]);

  const nodes = data?.nodes || [];
  const totalWorkers = nodes.reduce((s, n) => s + (n.active_workers || 0), 0);
  const totalCompleted = nodes.reduce((s, n) => s + (n.completed_tasks || 0), 0);

  return (
    <div className="app-shell">
      <Sidebar role="teacher" isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="main-content">
        <Header
          title="Node Connections"
          subtitle="Monitor distributed computing infrastructure"
          onMenuToggle={() => setSidebarOpen(!sidebarOpen)}
          actions={
            <button className="btn btn-secondary btn-sm" onClick={() => { setLoading(true); fetchData(); }}>
              ↻ Refresh
            </button>
          }
        />
        <div className="page-body">
          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 32 }}>
            <StatCard label="Total Nodes" value={nodes.length} icon="🖥️" color="#6366f1" />
            <StatCard label="Active Workers" value={totalWorkers} icon="⚙️" color="#10b981" />
            <StatCard label="Tasks Completed" value={totalCompleted} icon="✅" color="#06b6d4" />
          </div>

          {/* DB Server Card */}
          {data?.database_server && (
            <div className={styles.dbCard}>
              <div className={styles.dbIcon}>🗄️</div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 16 }}>
                  {data.database_server.name || 'Database Server'}
                </div>
                <div style={{ fontSize: 13, color: 'var(--clr-text-2)', marginTop: 4 }}>
                  <span style={{ fontFamily: 'var(--font-mono)' }}>
                    {data.database_server.ip}:{data.database_server.port}
                  </span>
                </div>
              </div>
            </div>
          )}

          <NodeTable nodes={nodes} loading={loading} onRefresh={fetchData} />
        </div>
      </div>
    </div>
  );
};

export default TeacherNodeConnections;
