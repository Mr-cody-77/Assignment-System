import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from 'react';
import { discoverServers } from '../config/serverDiscovery';
import runtimeConfig from '../config/runtimeConfig';

const ServerContext = createContext(null);

/* ─── Loading screen ────────────────────────────────────────────────── */
function DiscoveryLoadingScreen({ message }) {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--clr-bg)',
        gap: '24px',
        padding: '24px',
      }}
    >
      {/* Animated logo */}
      <div
        style={{
          width: 64,
          height: 64,
          borderRadius: 16,
          background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 32,
          boxShadow: '0 0 30px rgba(99,102,241,0.4)',
          animation: 'pulse-glow 2s ease-in-out infinite',
        }}
      >
        ⚡
      </div>

      <div style={{ textAlign: 'center' }}>
        <h2
          style={{
            fontSize: 22,
            fontWeight: 700,
            color: 'var(--clr-text)',
            marginBottom: 8,
          }}
        >
          Connecting to CodeMesh
        </h2>
        <p
          style={{
            fontSize: 14,
            color: 'var(--clr-text-2)',
            marginBottom: 20,
          }}
        >
          {message || 'Discovering server addresses…'}
        </p>
      </div>

      <div className="spinner" style={{ width: 32, height: 32 }} />

      <p style={{ fontSize: 12, color: 'var(--clr-text-3)', maxWidth: 380, textAlign: 'center' }}>
        The frontend is automatically discovering the backend and centralized server URLs.
        This usually takes less than a second.
      </p>

      <style>{`
        @keyframes pulse-glow {
          0%, 100% { box-shadow: 0 0 20px rgba(99,102,241,0.3); }
          50%       { box-shadow: 0 0 40px rgba(99,102,241,0.6); }
        }
      `}</style>
    </div>
  );
}

/* ─── Error screen ───────────────────────────────────────────────────── */
function DiscoveryErrorScreen({ error, onRetry, retryCount }) {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--clr-bg)',
        gap: '20px',
        padding: '24px',
      }}
    >
      <div
        style={{
          width: 64,
          height: 64,
          borderRadius: '50%',
          background: 'rgba(239,68,68,0.12)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 32,
          border: '2px solid rgba(239,68,68,0.3)',
        }}
      >
        ⚠️
      </div>

      <div style={{ textAlign: 'center', maxWidth: 480 }}>
        <h2
          style={{
            fontSize: 22,
            fontWeight: 700,
            color: 'var(--clr-text)',
            marginBottom: 8,
          }}
        >
          Connection Failed
        </h2>
        <p style={{ fontSize: 14, color: 'var(--clr-text-2)', marginBottom: 12 }}>
          Could not connect to the backend server to discover server addresses.
        </p>

        <div
          style={{
            background: 'rgba(239,68,68,0.08)',
            border: '1px solid rgba(239,68,68,0.2)',
            borderRadius: 10,
            padding: '12px 16px',
            marginBottom: 20,
            textAlign: 'left',
          }}
        >
          <p
            style={{
              fontSize: 12,
              fontFamily: 'var(--font-mono)',
              color: '#fca5a5',
              wordBreak: 'break-all',
              margin: 0,
            }}
          >
            {error}
          </p>
        </div>

        <div
          style={{
            background: 'var(--clr-surface)',
            border: '1px solid var(--clr-border)',
            borderRadius: 10,
            padding: '12px 16px',
            marginBottom: 24,
            textAlign: 'left',
          }}
        >
          <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--clr-text)', marginBottom: 6 }}>
            Checklist:
          </p>
          <ul style={{ fontSize: 13, color: 'var(--clr-text-2)', paddingLeft: 16, margin: 0 }}>
            <li>Make sure the Backend Node Server is running</li>
            <li>Verify the server is accessible at the expected address</li>
            <li>Check that <code style={{ fontFamily: 'var(--font-mono)' }}>/api/node_info/</code> returns a valid response</li>
          </ul>
        </div>

        <button
          className="btn btn-primary btn-lg"
          onClick={onRetry}
          style={{ minWidth: 180 }}
        >
          🔄 Try Again {retryCount > 0 ? `(${retryCount})` : ''}
        </button>
      </div>
    </div>
  );
}

/* ─── Provider ───────────────────────────────────────────────────────── */
export const ServerProvider = ({ children }) => {
  const [backendURL, setBackendURL] = useState(null);
  const [centralURL, setCentralURL] = useState(null);
  const [nodeInfo, setNodeInfo] = useState(null);
  const [isDiscovering, setIsDiscovering] = useState(true);
  const [discoveryError, setDiscoveryError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const [statusMessage, setStatusMessage] = useState('Initializing discovery…');

  const discover = useCallback(async () => {
    setIsDiscovering(true);
    setDiscoveryError(null);
    setStatusMessage('Connecting to backend server…');

    try {
      setStatusMessage('Fetching node information…');
      const result = await discoverServers();

      runtimeConfig.setCentralURL(result.centralURL);
      runtimeConfig.setBackendURL(result.backendURL);
      runtimeConfig.setInitialized(true);

      setCentralURL(result.centralURL);
      setBackendURL(result.backendURL);
      setNodeInfo(result.nodeInfo);
      setStatusMessage('Connected!');
    } catch (err) {
      const msg = err?.message || 'Unknown connection error';
      setDiscoveryError(msg);
      runtimeConfig.reset();
    } finally {
      setIsDiscovering(false);
    }
  }, []);

  useEffect(() => {
    discover();
  }, [discover]);

  const retryDiscovery = useCallback(() => {
    setRetryCount((c) => c + 1);
    discover();
  }, [discover]);

  // Show loading screen while discovering
  if (isDiscovering) {
    return <DiscoveryLoadingScreen message={statusMessage} />;
  }

  // Show error screen if discovery failed
  if (discoveryError) {
    return (
      <DiscoveryErrorScreen
        error={discoveryError}
        onRetry={retryDiscovery}
        retryCount={retryCount}
      />
    );
  }

  const value = {
    backendURL,
    centralURL,
    nodeInfo,
    isDiscovering,
    discoveryError,
    retryDiscovery,
    retryCount,
  };

  return (
    <ServerContext.Provider value={value}>{children}</ServerContext.Provider>
  );
};

export const useServer = () => {
  const ctx = useContext(ServerContext);
  if (!ctx) throw new Error('useServer must be used within a ServerProvider');
  return ctx;
};

export default ServerContext;
