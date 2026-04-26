import './assets/base.css';
import './neonwire/tokens.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { initDiagnostics } from './diagnostics';

initDiagnostics();

// NEON WIRE design system gates on [data-nw="on"] — set early so first paint
// has the tokens. ADR 016.
document.documentElement.dataset.nw = 'on';

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('#root missing');
createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
