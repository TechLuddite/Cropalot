import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import {execSync} from 'child_process';
import path from 'path';
import {defineConfig, type Plugin} from 'vite';

/**
 * The production Content-Security-Policy in index.html sets `connect-src 'none'`,
 * which is the app's core privacy guarantee: the browser itself refuses every
 * outbound network request, so photos physically cannot be uploaded.
 *
 * That same rule also blocks the WebSocket the Vite dev server uses for hot
 * module reload. This plugin relaxes ONLY `connect-src`, and ONLY while running
 * `vite dev` (`apply: 'serve'`). It never runs during `vite build`, so the
 * policy shipped to users is identical to the one written in index.html.
 */
function devCspRelax(): Plugin {
  return {
    name: 'cropalot-dev-csp-relax',
    apply: 'serve',
    transformIndexHtml(html) {
      return html.replace("connect-src 'none'", "connect-src 'self' ws: wss:");
    },
  };
}

/**
 * Records the commit this bundle was built from, so the running app can state
 * its own provenance instead of merely asserting trustworthiness. Falls back to
 * 'unknown' outside a git checkout (e.g. a source tarball build).
 */
function resolveCommitSha(): string {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA;
  try {
    return execSync('git rev-parse HEAD', {stdio: ['ignore', 'pipe', 'ignore']})
      .toString()
      .trim();
  } catch {
    return 'unknown';
  }
}

export default defineConfig(() => {
  return {
    base: './',
    plugins: [react(), tailwindcss(), devCspRelax()],
    define: {
      __COMMIT_SHA__: JSON.stringify(resolveCommitSha()),
      __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
    },
    build: {
      // Vite's module-preload polyfill is injected as an inline <script>, which
      // `script-src 'self'` correctly refuses. Every browser this app targets
      // supports module preload natively, so the polyfill is redundant.
      modulePreload: {polyfill: false},
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
