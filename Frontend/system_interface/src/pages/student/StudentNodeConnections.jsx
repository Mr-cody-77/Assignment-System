import React, { useState, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import Sidebar from '../../components/Sidebar/Sidebar';
import Header from '../../components/Header/Header';
import NodeTable from '../../components/NodeTable/NodeTable';
import StatCard from '../../components/common/StatCard';
import usePolling from '../../hooks/usePolling';
import { getNodeInfo } from '../../services/nodeService';
import styles from './StudentNodeConnections.module.css';

const StudentNodeConnections = () => {
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const res = await getNodeInfo();
      setData(res);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  usePolling(fetchData, 15000, true);

  const nodes = data?.nodes || [];
  const totalTasks = nodes.reduce((s, n) => s + (n.inflight_tasks || 0), 0);

  return (
    <div className="app-shell">
      <Sidebar role="student" isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="main-content">
        <Header
          title="Node Connections"
          subtitle="View connected computing nodes"
          onMenuToggle={() => setSidebarOpen(!sidebarOpen)}
        />
        <div className="page-body">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 32 }}>
            <StatCard label="Connected Nodes" value={nodes.length} icon="🖥️" color="#6366f1" />
            <StatCard label="Inflight Tasks" value={totalTasks} icon="⚙️" color="#3b82f6" />
          </div>

          {data?.database_server && (
            <div className={styles.dbCard}>
              <div className={styles.dbIcon}>🗄️</div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 16 }}>Centralized Database</div>
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

export default StudentNodeConnections;
