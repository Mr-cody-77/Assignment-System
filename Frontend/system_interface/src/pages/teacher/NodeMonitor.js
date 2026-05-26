import React, { useEffect, useState, useRef } from 'react';
import { nodeApi } from '../../api/api';
import Sidebar from '../../components/Sidebar';

export default function NodeMonitor() {
  const [nodes, setNodes] = useState([]);
  const [liveNodes, setLiveNodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(null);
  const intervalRef = useRef(null);

  const loadNodes = async () => {
    try {
      const [dbRes, liveRes] = await Promise.all([
        nodeApi.list(),
        nodeApi.live().catch(() => ({ data: { nodes: [] } })),
      ]);
      setNodes(dbRes.data.results || dbRes.data);
      setLiveNodes(liveRes.data.nodes || []);
      setLastRefresh(new Date());
    } catch (e) {
      console.error(e);
    } finally { setLoading(false); }
  };

  useEffect(() => {
    loadNodes();
    intervalRef.current = setInterval(loadNodes, 5000);
    return () => clearInterval(intervalRef.current);
  }, []);

  // Merge DB + live data
  const mergedNodes = nodes.map(n => {
    const live = liveNodes.find(l => l.node_id === n.node_id || l.ip === n.ip);
    return live ? { ...n, ...live, status: 'online' } : n;
  });

  const onlineCount = mergedNodes.filter(n => n.status === 'online').length;
  const totalWorkers = mergedNodes.reduce((a, n) => a + (n.workers_limit || 0), 0);
  const activeWorkers = mergedNodes.reduce((a, n) => a + (n.active_workers || 0), 0);
  const totalInflight = mergedNodes.reduce((a, n) => a + (n.inflight_tasks || 0), 0);

  const pct = (v) => Math.min(Math.round((v || 0) * 100), 100);
  const barClass = (v) => v > 0.8 ? 'danger' : v > 0.6 ? 'warn' : '';

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-content">
        <div className="topbar" style={{justifyContent:'space-between'}}>
          <span style={{fontWeight:700}}>Node Monitor</span>
          <div className="flex items-center gap-3">
            {lastRefresh && (
              <span style={{fontSize:12,color:'var(--clr-text-3)'}}>
                Updated: {lastRefresh.toLocaleTimeString()}
              </span>
            )}
            <button className="btn btn-ghost btn-sm" onClick={loadNodes}>↺ Refresh</button>
          </div>
        </div>
        <div className="page-body">
          <div className="page-header">
            <h1 className="page-title">LAN Node Monitor</h1>
            <p className="page-subtitle">Real-time distributed cluster health and worker status</p>
          </div>

          {/* Cluster Summary */}
          <div className="stats-grid">
            {[
              { label:'Online Nodes',    value: onlineCount,           color:'var(--clr-success)',  icon:'🟢' },
              { label:'Total Workers',   value: totalWorkers,          color:'var(--clr-accent)',   icon:'⚙' },
              { label:'Active Workers',  value: activeWorkers,         color:'var(--clr-warning)',  icon:'⚡' },
              { label:'Inflight Tasks',  value: totalInflight,         color:'var(--clr-info)',     icon:'📦' },
            ].map(s => (
              <div key={s.label} className="stat-card" style={{'--stat-accent': s.color}}>
                <div className="stat-label">{s.icon} {s.label}</div>
                <div className="stat-value" style={{color: s.color}}>{loading ? '—' : s.value}</div>
              </div>
            ))}
          </div>

          {/* Node Cards */}
          {loading ? (
            <div className="loading-screen" style={{minHeight:300}}><span className="spinner" /></div>
          ) : mergedNodes.length === 0 ? (
            <div className="card" style={{textAlign:'center',padding:60}}>
              <div style={{fontSize:48,marginBottom:12}}>🔍</div>
              <div style={{color:'var(--clr-text-2)'}}>No nodes discovered yet. Start more nodes on the LAN.</div>
            </div>
          ) : (
            <div className="node-grid">
              {mergedNodes.map(node => {
                const cpu = pct(node.cpu_load);
                const mem = pct(node.memory_load);
                const workerUsage = node.workers_limit ? node.active_workers / node.workers_limit : 0;

                return (
                  <div key={node.node_id} className={`node-card ${node.status}`}>
                    <div className="node-header">
                      <div>
                        <div className="node-name">{node.node_id}</div>
                        <div className="node-ip">{node.ip}:{node.port}</div>
                        {node.hostname && <div className="node-ip">{node.hostname}</div>}
                      </div>
                      <div style={{display:'flex',alignItems:'center',gap:6}}>
                        <span className={`pulse-dot ${node.status}`} />
                        <span className={`badge ${node.status==='online'?'badge-success':'badge-error'}`}>
                          {node.status}
                        </span>
                      </div>
                    </div>

                    {/* CPU */}
                    <div style={{marginBottom:10}}>
                      <div className="flex justify-between mb-1" style={{fontSize:12}}>
                        <span style={{color:'var(--clr-text-2)'}}>CPU</span>
                        <span style={{fontWeight:700,fontFamily:'var(--font-mono)'}}>{cpu}%</span>
                      </div>
                      <div className="progress-bar-wrap">
                        <div className={`progress-bar ${barClass(node.cpu_load)}`} style={{width:`${cpu}%`}} />
                      </div>
                    </div>

                    {/* Memory */}
                    <div style={{marginBottom:10}}>
                      <div className="flex justify-between mb-1" style={{fontSize:12}}>
                        <span style={{color:'var(--clr-text-2)'}}>Memory</span>
                        <span style={{fontWeight:700,fontFamily:'var(--font-mono)'}}>{mem}%</span>
                      </div>
                      <div className="progress-bar-wrap">
                        <div className={`progress-bar ${barClass(node.memory_load)}`} style={{width:`${mem}%`}} />
                      </div>
                    </div>

                    {/* Workers */}
                    <div style={{marginBottom:10}}>
                      <div className="flex justify-between mb-1" style={{fontSize:12}}>
                        <span style={{color:'var(--clr-text-2)'}}>Workers</span>
                        <span style={{fontWeight:700,fontFamily:'var(--font-mono)'}}>
                          {node.active_workers}/{node.workers_limit}
                        </span>
                      </div>
                      <div className="progress-bar-wrap">
                        <div className={`progress-bar ${barClass(workerUsage)}`} style={{width:`${pct(workerUsage)}%`}} />
                      </div>
                    </div>

                    <div className="flex gap-2 mt-2" style={{fontSize:12}}>
                      <div style={{flex:1,background:'var(--clr-bg-3)',borderRadius:6,padding:'6px 10px',textAlign:'center'}}>
                        <div style={{color:'var(--clr-text-3)',marginBottom:2}}>Inflight</div>
                        <div style={{fontWeight:700,color:'var(--clr-info)'}}>{node.inflight_tasks || 0}</div>
                      </div>
                      <div style={{flex:1,background:'var(--clr-bg-3)',borderRadius:6,padding:'6px 10px',textAlign:'center'}}>
                        <div style={{color:'var(--clr-text-3)',marginBottom:2}}>Load Score</div>
                        <div style={{fontWeight:700,color:'var(--clr-accent-light)'}}>
                          {((node.predicted_cpu || node.cpu_load || 0) * 100).toFixed(0)}%
                        </div>
                      </div>
                    </div>

                    {node.last_seen && (
                      <div style={{marginTop:8,fontSize:11,color:'var(--clr-text-3)',textAlign:'right'}}>
                        Last seen: {new Date(node.last_seen).toLocaleTimeString()}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
