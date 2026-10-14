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
 * Normalise a hostname so that loopback aliases and empty values all map to
 * the same sentinel, preventing the deduplication logic from treating the same
 * physical machine as two different nodes when it announces itself both via its
 * LAN IP and via localhost/127.0.0.1.
 *
 * BUG-08 FIX: Previously the hostname check explicitly skipped localhost /
 * 127.0.0.1, so if the same node broadcast once via its LAN IP and once via a
 * loopback hostname with a slightly different node_id, all three deduplication
 * checks (id, ip:port, hostname:port) would miss it and list the node twice.
 */
const LOOPBACK_ALIASES = new Set(['localhost', '127.0.0.1', '0.0.0.0', '—', '']);

function normaliseHostname(hostname) {
  if (!hostname) return null;
  const h = String(hostname).toLowerCase().trim();
  // Treat all loopback aliases as the same sentinel so they match each other
  return LOOPBACK_ALIASES.has(h) ? '__loopback__' : h;
}

/**
 * Deduplicate nodes so that the same machine is never listed multiple times.
 *
 * BUG-08 FIX: normalise loopback hostnames before the hostname:port check so
 * that two announcements from the same node (one via LAN IP, one via loopback)
 * are correctly identified as the same machine.
 */
export const deduplicateNodes = (nodes) => {
  if (!Array.isArray(nodes)) return [];
  const seenIds       = new Set();
  const seenEndpoints = new Set();
  const seenHosts     = new Set();
  const result        = [];

  // Always keep gateway at top
  const sorted = [...nodes].sort((a, b) => (b.is_gateway ? 1 : 0) - (a.is_gateway ? 1 : 0));

  for (const node of sorted) {
    if (!node) continue;

    const id     = node.node_id ? String(node.node_id) : null;
    const ipPort = node.ip && node.port ? `${node.ip}:${node.port}` : null;

    // BUG-08 FIX: use normaliseHostname so loopback aliases match each other
    const normHost = normaliseHostname(node.hostname);
    const hostPort = normHost && node.port ? `${normHost}:${node.port}` : null;

    if (id       && seenIds.has(id))             continue;
    if (ipPort   && seenEndpoints.has(ipPort))   continue;
    if (hostPort && seenHosts.has(hostPort))     continue;

    if (id)       seenIds.add(id);
    if (ipPort)   seenEndpoints.add(ipPort);
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
