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
export const getNodeInfo = async () => {
  const res = await backendRequest.get(endpoints.nodeInfo());
  return res.data;
};
