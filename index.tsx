import './polyfills';

import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles/responsive.css';
// Last, like the former CDN stylesheet: utilities keep precedence over the other styles.
import './styles/tailwind.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Impossible de trouver l'élément root");
}

const root = createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
