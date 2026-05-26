import React, { useState, useMemo } from 'react';
import ProgressBar from '../common/ProgressBar';
import EmptyState from '../common/EmptyState';
import SearchBar from '../SearchBar/SearchBar';
import Pagination from '../Pagination/Pagination';
import { SkeletonCard } from '../Loader/SkeletonLoader';
import { filterData, sortData, paginateData } from '../../utils/helpers';
import styles from './NodeTable.module.css';

const PAGE_SIZE = 10;

const NodeTable = ({ nodes = [], loading = false, onRefresh }) => {
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState('node_id');
  const [sortDir, setSortDir] = useState('asc');
  const [page, setPage] = useState(1);
  const [refreshing, setRefreshing] = useState(false);

  const handleSort = (key) => {
    if (key === sortKey) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('asc'); }
  };

  const handleRefresh = async () => {
    if (!onRefresh) return;
    setRefreshing(true);
    try { await onRefresh(); } finally { setRefreshing(false); }
  };

  const filtered = useMemo(
    () => filterData(nodes, search, ['node_id', 'hostname', 'ip']),
    [nodes, search]
  );
  const sorted = useMemo(() => sortData(filtered, sortKey, sortDir), [filtered, sortKey, sortDir]);
  const { items, totalPages, totalItems } = paginateData(sorted, page, PAGE_SIZE);

  const SortIcon = ({ col }) => sortKey === col ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ' ↕';

  const ColHeader = ({ col, label }) => (
    <th
      className={styles.sortableHeader}
      onClick={() => handleSort(col)}
    >
      {label}<span className={styles.sortIcon}><SortIcon col={col} /></span>
    </th>
  );

  if (loading && nodes.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {[1, 2, 3].map((i) => <SkeletonCard key={i} />)}
      </div>
    );
  }

  return (
    <div>
      <div className={styles.controls}>
        <SearchBar
          value={search}
          onChange={(v) => { setSearch(v); setPage(1); }}
          placeholder="Search nodes…"
        />
        <button
          className={`btn btn-secondary btn-sm ${styles.refreshBtn}`}
          onClick={handleRefresh}
          disabled={refreshing}
        >
          {refreshing ? '⟳ Refreshing…' : '↻ Refresh'}
        </button>
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon="🖥️"
          title="No nodes found"
          description={search ? 'No nodes match your search.' : 'No computing nodes are currently connected.'}
        />
      ) : (
        <>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <ColHeader col="node_id" label="Node ID" />
                  <ColHeader col="hostname" label="Hostname" />
                  <th>IP : Port</th>
                  <ColHeader col="cpu_usage" label="CPU %" />
                  <ColHeader col="memory_usage" label="Memory %" />
                  <ColHeader col="io_wait" label="IO Wait" />
                  <ColHeader col="active_workers" label="Workers" />
                  <ColHeader col="inflight_tasks" label="Inflight" />
                  <ColHeader col="completed_tasks" label="Completed" />
                  <ColHeader col="current_load_score" label="Load Score" />
                </tr>
              </thead>
              <tbody>
                {items.map((node) => (
                  <tr key={node.node_id}>
                    <td><span className={styles.mono}>{node.node_id}</span></td>
                    <td>{node.hostname || '—'}</td>
                    <td><span className={styles.mono}>{node.ip}:{node.port}</span></td>
                    <td style={{ minWidth: 100 }}>
                      <ProgressBar
                        value={Number(node.cpu_usage || 0) * 100}
                        showValue
                        label=""
                      />
                    </td>
                    <td style={{ minWidth: 100 }}>
                      <ProgressBar
                        value={Number(node.memory_usage || 0) * 100}
                        showValue
                        label=""
                      />
                    </td>
                    <td>{(Number(node.io_wait || 0) * 100).toFixed(1)}%</td>
                    <td>
                      <span className={styles.mono}>
                        {node.active_workers}/{node.workers_limit}
                      </span>
                    </td>
                    <td>{node.inflight_tasks ?? '—'}</td>
                    <td>{node.completed_tasks ?? '—'}</td>
                    <td>
                      <span style={{
                        fontWeight: 700,
                        color: node.current_load_score > 0.8 ? 'var(--clr-error)'
                          : node.current_load_score > 0.5 ? 'var(--clr-warning)'
                          : 'var(--clr-success)',
                      }}>
                        {Number(node.current_load_score || 0).toFixed(2)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            totalItems={totalItems}
            pageSize={PAGE_SIZE}
            onPageChange={setPage}
          />
        </>
      )}
    </div>
  );
};

export default NodeTable;
