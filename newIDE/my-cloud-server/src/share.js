// @ts-check
'use strict';

/**
 * Public sharing endpoints for the self-hosted "My Cloud" GDevelop server.
 *
 * These routes are intentionally NOT behind the access token: a share link is
 * meant to be given to other people. They only expose a single project by id.
 *
 *   GET /share/:id      landing page with Play + Download buttons
 *   GET /play/:id/*     serves the project's HTML5 export (if one was uploaded)
 *   GET /download/:id   downloads the project body archive (game.zip)
 */

const escapeHtml = value =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const renderLandingPage = ({ project, hasExport, baseUrl }) => {
  const name = escapeHtml(project.name || 'GDevelop project');
  const id = escapeHtml(project.id);
  // Absolute URLs so links work whether the server is reached directly or
  // behind a reverse-proxy path prefix (e.g. https://host/my-cloud).
  const base = (baseUrl || '').replace(/\/+$/, '');
  const updatedAt = project.updatedAt
    ? escapeHtml(new Date(project.updatedAt).toLocaleString())
    : '';
  const playButton = hasExport
    ? `<a class="btn btn-primary" href="${base}/play/${id}/">▶ Play game</a>`
    : `<span class="btn btn-disabled" title="No playable build has been shared yet">▶ Play (not available)</span>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${name} — GDevelop</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body {
    margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    background: radial-gradient(circle at top, #2b2f44, #16182a);
    color: #f0f1f7;
  }
  .card {
    background: #1f2237; border: 1px solid #34384f; border-radius: 16px;
    padding: 40px 44px; max-width: 460px; width: calc(100% - 32px);
    box-shadow: 0 20px 60px rgba(0,0,0,0.45); text-align: center;
  }
  h1 { font-size: 26px; margin: 8px 0 4px; }
  .subtitle { color: #9aa0bd; font-size: 13px; margin-bottom: 28px; }
  .btn {
    display: block; width: 100%; padding: 14px 18px; margin: 10px 0; border-radius: 10px;
    font-size: 15px; font-weight: 600; text-decoration: none; cursor: pointer;
    transition: transform .05s ease, background .15s ease;
  }
  .btn:active { transform: translateY(1px); }
  .btn-primary { background: #4c6fff; color: #fff; }
  .btn-primary:hover { background: #3c5cf0; }
  .btn-secondary { background: #2c3050; color: #dfe2f5; border: 1px solid #3c4166; }
  .btn-secondary:hover { background: #353a5e; }
  .btn-disabled { background: #262a40; color: #6a7095; cursor: not-allowed; }
  .footer { margin-top: 26px; font-size: 11px; color: #6a7095; }
  .logo { font-size: 40px; }
</style>
</head>
<body>
  <div class="card">
    <div class="logo">🎮</div>
    <h1>${name}</h1>
    <div class="subtitle">${updatedAt ? 'Updated ' + updatedAt : 'Shared with GDevelop'}</div>
    ${playButton}
    <a class="btn btn-secondary" href="${base}/download/${id}">⬇ Download project</a>
    <div class="footer">Made with GDevelop · self-hosted cloud</div>
  </div>
</body>
</html>`;
};

const renderNotFoundPage = () =>
  `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Not found</title>
  <style>body{font-family:sans-serif;background:#16182a;color:#f0f1f7;display:flex;
  align-items:center;justify-content:center;height:100vh;margin:0}</style></head>
  <body><div><h1>404</h1><p>This shared project does not exist.</p></div></body></html>`;

module.exports = {
  renderLandingPage,
  renderNotFoundPage,
  escapeHtml,
};
