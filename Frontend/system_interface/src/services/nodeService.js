import { backendRequest } from './api';
import { endpoints } from '../config/endpointResolver';

/**
 * Fetch node information from the Backend Node Server.
 *
 * GET /api/node_info/
 * Response: {
 *   database_server: { name, ip, port },
 *   nodes: [{
 *     node_id, hostname, ip, port,
 *     cpu_usage, memory_usage, io_wait,
 *     active_workers, inflight_tasks, completed_tasks,
 *     workers_limit, current_load_score
 *   }]
 * }
 */
/**
 * Deduplicate nodes so that the same machine is never listed multiple times.
 */
export const deduplicateNodes = (nodes) => {
  if (!Array.isArray(nodes)) return [];
  const seenIds = new Set();
  const seenEndpoints = new Set();
  const seenHosts = new Set();
  const result = [];

  // Always keep gateway at top
  const sorted = [...nodes].sort((a, b) => (b.is_gateway ? 1 : 0) - (a.is_gateway ? 1 : 0));

  for (const node of sorted) {
    if (!node) continue;

    const id = node.node_id ? String(node.node_id) : null;
    const ipPort = node.ip && node.port ? `${node.ip}:${node.port}` : null;
    const hostPort = node.hostname && !['localhost', '127.0.0.1', '—', ''].includes(String(node.hostname).toLowerCase()) && node.port
      ? `${String(node.hostname).toLowerCase()}:${node.port}`
      : null;

    if (id && seenIds.has(id)) continue;
    if (ipPort && seenEndpoints.has(ipPort)) continue;
    if (hostPort && seenHosts.has(hostPort)) continue;

    if (id) seenIds.add(id);
    if (ipPort) seenEndpoints.add(ipPort);
    if (hostPort) seenHosts.add(hostPort);

    result.push(node);
  }

  return result;
};

export const getNodeInfo = async () => {
  const res = await backendRequest.get(endpoints.nodeInfo());
  if (res.data && Array.isArray(res.data.nodes)) {
    res.data.nodes = deduplicateNodes(res.data.nodes);
  }
  return res.data;
};
