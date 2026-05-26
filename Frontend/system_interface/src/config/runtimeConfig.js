/**
 * Runtime configuration singleton.
 * Stores discovered server URLs and exposes typed accessors.
 * Values are set once by ServerContext after discovery and then
 * read by every API service via endpointResolver.
 */

let _centralURL = null;
let _backendURL = null;
let _initialized = false;

const runtimeConfig = {
  setCentralURL(url) {
    _centralURL = url;
  },
  setBackendURL(url) {
    _backendURL = url;
  },
  getCentralURL() {
    if (!_centralURL) {
      throw new Error(
        'Centralized server URL has not been discovered yet. ' +
          'Ensure ServerContext has completed initialization before making API calls.'
      );
    }
    return _centralURL;
  },
  getBackendURL() {
    if (!_backendURL) {
      throw new Error(
        'Backend server URL has not been discovered yet. ' +
          'Ensure ServerContext has completed initialization before making API calls.'
      );
    }
    return _backendURL;
  },
  setInitialized(val) {
    _initialized = Boolean(val);
  },
  isInitialized() {
    return _initialized;
  },
  reset() {
    _centralURL = null;
    _backendURL = null;
    _initialized = false;
  },
};

export default runtimeConfig;
