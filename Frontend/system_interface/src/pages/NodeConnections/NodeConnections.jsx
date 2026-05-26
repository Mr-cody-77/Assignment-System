import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import NodeTable from '../../components/NodeTable/NodeTable';
import { getNodeInfo } from '../../services/nodeService';
import { useToast } from '../../hooks/useToast'; // <-- 1. Imported useToast
import { formatDate } from '../../utils/formatters';
import styles from './NodeConnections.module.css';

const REFRESH_INTERVAL = 15000;

const NodeConnections = () => {
  const navigate = useNavigate();
  const { addToast } = useToast(); // <-- 2. Initialized the hook
  
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);
  
  // <-- 3. Added a ref to prevent spamming the toast every 15 seconds
  const hasToasted = useRef(false); 

  const fetchData = useCallback(async () => {
    try {
      const res = await getNodeInfo();
      setData(res);
      setLastUpdated(new Date());
      setError('');

      // <-- 4. Trigger the toast ONLY on the first successful fetch
      if (!hasToasted.current && res) {
        // Safely extract the gateway node info (fallback to the first node in the array if top-level variables aren't set)
        const gatewayId = res.node_id || (res.nodes && res.nodes[0]?.node_id) || 'Gateway';
        const gatewayIp = res.ip || (res.nodes && res.nodes[0]?.ip) || 'Unknown IP';
        const gatewayPort = res.port || (res.nodes && res.nodes[0]?.port) || 'Unknown Port';

        addToast(
          `Connected via Gateway: ${gatewayId} (${gatewayIp}:${gatewayPort})`,
          'success',
          5000
        );
        hasToasted.current = true; // Mark as toasted so it doesn't pop up on the next interval
      }

    } catch (err) {
      setError(err?.message || 'Failed to fetch node information.');
    } finally {
      setLoading(false);
    }
  }, [addToast]); // Added addToast to dependency array

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchData]);

  return (
    <div className={styles.page}>
      {/* Navbar */}
      <nav className={styles.navbar}>
        <div className={styles.navLogo} onClick={() => navigate('/')}>
          <div className={styles.navLogoIcon}>⚡</div>
          <span className={styles.navLogoText}>Assignment System</span>
        </div>
        <div className={styles.navActions}>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/')}>
            ← Home
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => navigate('/login')}>
            Sign In
          </button>
        </div>
      </nav>

      <div className={styles.content}>
        {/* Page header */}
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 4 }}>
            🔗 Connected Nodes
          </h1>
          <p style={{ color: 'var(--clr-text-2)' }}>
            Real-time view of distributed computing nodes
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="alert alert-error" style={{ marginBottom: 24 }}>
            {error}{' '}
            <button className="btn btn-ghost btn-sm" onClick={fetchData} style={{ marginLeft: 8 }}>
              Retry
            </button>
          </div>
        )}

 {/* --- Server Status Cards --- */}
        <div className={styles.cardsContainer}>
          
          {/* Database Server card */}
          {data?.database_server && (
            <div className={styles.dbCard}>
              <div className={styles.dbIcon}>🗄️</div>
              <div className={styles.dbInfo}>
                <h2>{data.database_server.name || 'Database Server'}</h2>
                <p style={{ color: 'var(--clr-text-2)', fontSize: 14, marginBottom: 8 }}>
                  Centralized Database Server
                </p>
                <div className={styles.dbMeta}>
                  <span className={styles.metaBadge}>
                    IP: {data.database_server.ip}
                  </span>
                  <span className={styles.metaBadge}>
                    Port: {data.database_server.port}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Current Gateway Node card */}
          {data?.gateway && (
            <div className={`${styles.dbCard} ${styles.gatewayCard}`}>
              <div className={styles.dbIcon}>💻</div>
              <div className={styles.dbInfo}>
                <h2>{data.gateway.node_id || 'Gateway Node'}</h2>
                <p style={{ color: 'var(--clr-text-2)', fontSize: 14, marginBottom: 8 }}>
                  Your Current Access Node
                </p>
                <div className={styles.dbMeta}>
                  <span className={styles.metaBadge}>
                    IP: {data.gateway.ip}
                  </span>
                  <span className={styles.metaBadge}>
                    Port: {data.gateway.port}
                  </span>
                </div>
              </div>
            </div>
          )}
          
        </div>
        {/* --------------------------- */}

        {/* Nodes section */}
        <div className={styles.sectionHeader}>
          <h2 style={{ fontWeight: 700, fontSize: 20 }}>
            Computing Nodes
            {data?.nodes && (
              <span className="badge badge-info" style={{ marginLeft: 10, fontSize: 12 }}>
                {data.nodes.length} online
              </span>
            )}
          </h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {lastUpdated && (
              <span className={styles.lastUpdated}>
                Updated {lastUpdated.toLocaleTimeString()}
              </span>
            )}
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => { setLoading(true); fetchData(); }}
            >
              ↻ Refresh
            </button>
          </div>
        </div>

        <NodeTable
          nodes={data?.nodes || []}
          loading={loading}
          onRefresh={fetchData}
        />
      </div>
    </div>
  );
};

export default NodeConnections;