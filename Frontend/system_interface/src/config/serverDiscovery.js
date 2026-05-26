import axios from 'axios';

const NODE_INFO_ENDPOINT ='http://127.0.0.1:8001/api/node_info/';
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 2000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Discovers backend and centralized server URLs at runtime.
 *
 * Strategy:
 *  - Backend URL  = window.location.origin (React app is served from the backend; 
 *                   in dev mode the CRA proxy forwards /api/* to the backend on port 8000)
 *  - Central URL  = derived from the database_server field returned by /api/node_info/
 *
 * No IP addresses are hardcoded anywhere in this module.
 */
export async function discoverServers(retries = MAX_RETRIES) {
  let lastError = null;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await axios.get(NODE_INFO_ENDPOINT, {
        timeout: 8000,
        headers: { 'Content-Type': 'application/json' },
      });

      const data = response.data;

      if (!data || !data.database_server) {
        throw new Error(
          'Invalid response from /api/node_info/: missing database_server field'
        );
      }

      const { ip, port } = data.database_server;

      if (!ip || !port) {
        throw new Error(
          'Invalid database_server info: ip or port is missing'
        );
      }

      const centralURL = `http://${ip}:${port}`;
      const backendURL = 'http://127.0.0.1:8000';

      return {
        centralURL,
        backendURL,
        nodeInfo: data,
      };
    } catch (error) {
      lastError = error;
      console.warn(
        `[ServerDiscovery] Attempt ${attempt}/${retries} failed:`,
        error.message
      );

      if (attempt < retries) {
        const delay = BASE_DELAY_MS * attempt;
        console.info(`[ServerDiscovery] Retrying in ${delay}ms...`);
        await sleep(delay);
      }
    }
  }

  throw new Error(
    `Server discovery failed after ${retries} attempts. Last error: ${lastError?.message || 'Unknown error'}. ` +
      'Make sure the backend server is running and accessible.'
  );
}
