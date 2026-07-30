import React from 'react';
import ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux';

import App from './App';
import './index.css';

import { store } from './store/store';

// Webpack error interceptors are located in public/index.html to ensure they execute first

const root = ReactDOM.createRoot(
  document.getElementById('root')
);

root.render(
  <Provider store={store}>
    <App />
  </Provider>
);