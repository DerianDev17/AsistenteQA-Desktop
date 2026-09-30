import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { AppRecovery } from './components/AppRecovery';
import './styles/app.css';
import './styles/dashboard.css';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppRecovery>
      <App />
    </AppRecovery>
  </React.StrictMode>,
);
