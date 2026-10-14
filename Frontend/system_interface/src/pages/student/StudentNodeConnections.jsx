import React, { useState, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../hooks/useToast';
import Sidebar from '../../components/Sidebar/Sidebar';
import Header from '../../components/Header/Header';
import NodeTable from '../../components/NodeTable/NodeTable';
import StatCard from '../../components/common/StatCard';
import usePolling from '../../hooks/usePolling';
import { getNodeInfo } from '../../services/nodeService';
import styles from './StudentNodeConnections.module.css';

const StudentNodeConnections = () => {
  const { user } = useAuth();
  const { addToast } = useToast();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorCount, setErrorCount] = useState(0);

  const fetchData = useCallback(async () => {
    try {
      const res = await getNodeInfo();
      setData(res);
      setErrorCount(0);
    } catch (err) {
      setErrorCount((prev) => {
        const next = prev + 1;
        if (next === 3) {
          addToast('Connection to computing nodes degraded or offline', 'warning');
        }
        return next;
      });
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  usePolling(fetchData, 15000, true);

  const nodes = data?.nodes || [];
  const totalWorkers = nodes.reduce((s, n) => s + (n.active_workers || 0), 0);
  const totalInflight = nodes.reduce((s, n) => s + (n.inflight_tasks || 0), 0);
  const totalCompleted = nodes.reduce((s, n) => s + (n.completed_tasks || 0), 0);

  return (
    <div className="app-shell">
      <Sidebar role="student" isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="main-content">
        <Header
          title="Node Connections"
          subtitle="View distributed computing cluster and nodes"
          onMenuToggle={() => setSidebarOpen(!sidebarOpen)}
          actions={
            <button className="btn btn-secondary btn-sm" onClick={() => { setLoading(true); fetchData(); }}>
              ↻ Refresh
            </button>
          }
        />
        <div className="page-body">
          {/* Consistent cluster stat cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 28 }}>
            <StatCard label="Total Nodes" value={nodes.length} icon="🖥️" color="#6366f1" />
            <StatCard label="Active Workers" value={totalWorkers} icon="⚙️" color="#10b981" />
            <StatCard label="Inflight Tasks" value={totalInflight} icon="🔄" color="#3b82f6" />
            <StatCard label="Tasks Completed" value={totalCompleted} icon="✅" color="#06b6d4" />
          </div>

          {/* Infrastructure Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginBottom: 28 }}>
            {data?.database_server && (
              <div className={styles.dbCard}>
                <div className={styles.dbIcon}>🗄️</div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 16 }}>{data.database_server.name || 'Centralized Database'}</div>
                  <div style={{ fontSize: 13, color: 'var(--clr-text-2)', marginTop: 4 }}>
                    <span style={{ fontFamily: 'var(--font-mono)' }}>
                      {data.database_server.ip}:{data.database_server.port}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {data?.gateway && (
              <div className={styles.dbCard} style={{ borderLeft: '4px solid var(--clr-primary, #6366f1)' }}>
                <div className={styles.dbIcon}>💻</div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 16 }}>Access Gateway Node</div>
                  <div style={{ fontSize: 13, color: 'var(--clr-text-2)', marginTop: 4 }}>
                    <span style={{ fontFamily: 'var(--font-mono)' }}>
                      {data.gateway.node_id} ({data.gateway.ip}:{data.gateway.port})
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <NodeTable nodes={nodes} loading={loading} onRefresh={fetchData} />
        </div>
      </div>
    </div>
  );
};

export default StudentNodeConnections;
