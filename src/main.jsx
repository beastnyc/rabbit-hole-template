import React from 'react';
import { createRoot } from 'react-dom/client';
import StackedApp from './StackedApp.jsx';

function boot() {
  const rootEl = document.getElementById('stack-root');
  if (!rootEl) return;
  const title = (document.querySelector('.note-title') || {}).textContent || 'Note';
  const body = (document.querySelector('.note-body') || {}).innerHTML || '';
  let meta = {};
  try {
    meta = JSON.parse(document.getElementById('note-data')?.textContent || '{}');
  } catch {}
  const path = window.location.pathname || '/notes/index.html';
  const match = path.match(/\/notes\/([^/.]+)(?:\.html)?/);
  const href = match ? `/notes/${match[1]}.html` : '/notes/index.html';
  const id = match ? match[1] : null;
  // Signal that React is handling stacking; hide static container, show root
  try {
    window.__STACKED_REACT__ = true;
    const cont = document.getElementById('container');
    if (cont) cont.style.display = 'none';
    rootEl.style.display = 'block';
    console.info('[Stack] Mode: React');
    if (window.__setStackBadge) window.__setStackBadge('React');
  } catch {}
  createRoot(rootEl).render(
    React.createElement(StackedApp, { initial: { title, body, href, id, meta } })
  );
}

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
