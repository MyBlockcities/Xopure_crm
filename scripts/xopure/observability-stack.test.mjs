// XO Pure Observability Stack — contract test
//
// Validates that the observability config files in services/observability/
// and the deploy script in scripts/xopure/ satisfy the security and routing
// contract before deployment.  Fails cleanly before the files exist, passes
// once they contain the correct bindings.
//
// Usage:  node scripts/xopure/observability-stack.test.mjs

import { describe, it, before } from 'node:test';
import { ok, match, doesNotMatch } from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// ── paths ───────────────────────────────────────────────────────────────────

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..', '..');

const REQUIRED_FILES = /** @type {const} */ ([
  'services/observability/alloy/config.alloy',
  'services/observability/loki/loki-config.yaml',
  'services/observability/prometheus/prometheus.yml',
  'services/observability/tempo/tempo-config.yaml',
  'services/observability/grafana/grafana.ini',
  'services/observability/grafana/provisioning/datasources/datasources.yaml',
  'scripts/xopure/deploy-observability-stack.sh',
]);

/** @returns {string} absolute path for a repo-relative path */
function repoPath(relative) {
  return resolve(REPO_ROOT, relative);
}

/** @returns {string} file content (cached per path) */
const _contentCache = new Map();
function readConfig(relative) {
  if (!_contentCache.has(relative)) {
    _contentCache.set(relative, readFileSync(repoPath(relative), 'utf-8'));
  }
  return _contentCache.get(relative);
}

// ── helpers ─────────────────────────────────────────────────────────────────

/**
 * Named list of files missing from disk — populated once in a single `before`
 * hook so every other test can assume existence and give clean errors.
 */
let missingFiles = [];

function assertAllFilesExist() {
  const abs = REQUIRED_FILES.map((f) => repoPath(f));
  missingFiles = REQUIRED_FILES.filter((_, i) => !existsSync(abs[i]));
  if (missingFiles.length > 0) {
    throw new Error(
      `Missing required files (${missingFiles.length}):\n` +
        missingFiles.map((f) => `  - ${f}`).join('\n') +
        '\n\nCreate these files to satisfy the observability stack contract.',
    );
  }
}

function skipIfMissingFiles(t) {
  if (missingFiles.length > 0) {
    t.skip();
    return true;
  }
  return false;
}

// ── suite ───────────────────────────────────────────────────────────────────

describe('XO Pure observability stack contract', () => {
  // ── file existence ──────────────────────────────────────────────────────

  describe('required files exist', () => {
    it('all 7 required config / script files are present on disk', () => {
      assertAllFilesExist();
    });
  });

  // ── Alloy ───────────────────────────────────────────────────────────────

  describe('alloy/config.alloy', () => {
    let content;

    before(() => {
      if (missingFiles.length > 0) return;
      content = readConfig(REQUIRED_FILES[0]);
    });

    it('forwards OTLP traces to local Tempo (127.0.0.1:4317 or 127.0.0.1:4318)', (t) => {
      if (skipIfMissingFiles(t)) return;
      const hasGrpc = content.includes('127.0.0.1:4317');
      const hasHttp = content.includes('127.0.0.1:4318');
      ok(hasGrpc || hasHttp, 'Expected traces forwarded to 127.0.0.1:4317 or 127.0.0.1:4318');
    });

    it('receives OTLP gRPC on 100.119.117.43:4317', (t) => {
      if (skipIfMissingFiles(t)) return;
      ok(content.includes('100.119.117.43:4317'), 'Expected OTLP gRPC receiver on 100.119.117.43:4317');
    });

    it('receives OTLP HTTP on 100.119.117.43:4318', (t) => {
      if (skipIfMissingFiles(t)) return;
      ok(content.includes('100.119.117.43:4318'), 'Expected OTLP HTTP receiver on 100.119.117.43:4318');
    });

    it('writes metrics to 127.0.0.1:9090', (t) => {
      if (skipIfMissingFiles(t)) return;
      ok(content.includes('127.0.0.1:9090'), 'Expected metrics endpoint 127.0.0.1:9090');
    });

    it('writes logs to 127.0.0.1:3200', (t) => {
      if (skipIfMissingFiles(t)) return;
      ok(content.includes('127.0.0.1:3200'), 'Expected logs endpoint 127.0.0.1:3200');
    });

    it('contains no 0.0.0.0 wildcard bind', (t) => {
      if (skipIfMissingFiles(t)) return;
      doesNotMatch(content, /0\.0\.0\.0/, 'Alloy config must not bind to 0.0.0.0');
    });

    it('contains an explicit ACL or auth keyword comment near the OTLP receiver', (t) => {
      if (skipIfMissingFiles(t)) return;
      ok(
        /\bACL\b/i.test(content) ||
          /\bauth\b/i.test(content) ||
          /\bnot\s+sufficient\b/i.test(content),
        'Expected an ACL/auth keyword comment in alloy config near the OTLP receiver block',
      );
    });
  });

  // ── Loki ────────────────────────────────────────────────────────────────

  describe('loki/loki-config.yaml', () => {
    let content;

    before(() => {
      if (missingFiles.length > 0) return;
      content = readConfig(REQUIRED_FILES[1]);
    });

    it('binds HTTP server to 127.0.0.1', (t) => {
      if (skipIfMissingFiles(t)) return;
      match(content, /http_listen_address.*127\.0\.0\.1/,
        'Expected server.http_listen_address = 127.0.0.1');
    });

    it('binds gRPC server to 127.0.0.1', (t) => {
      if (skipIfMissingFiles(t)) return;
      match(content, /grpc_listen_address.*127\.0\.0\.1/,
        'Expected server.grpc_listen_address = 127.0.0.1');
    });

    it('uses filesystem storage under /loki', (t) => {
      if (skipIfMissingFiles(t)) return;
      ok(content.includes('/loki'), 'Expected filesystem storage directory under /loki');
    });
  });

  // ── Prometheus ──────────────────────────────────────────────────────────

  describe('prometheus/prometheus.yml', () => {
    let content;

    before(() => {
      if (missingFiles.length > 0) return;
      content = readConfig(REQUIRED_FILES[2]);
    });

    it('keeps scrape target on 127.0.0.1:9090', (t) => {
      if (skipIfMissingFiles(t)) return;
      ok(
        content.includes('127.0.0.1:9090'),
        'Expected scrape target localhost:9090',
      );
    });
  });

  // ── Tempo ───────────────────────────────────────────────────────────────

  describe('tempo/tempo-config.yaml', () => {
    let content;

    before(() => {
      if (missingFiles.length > 0) return;
      content = readConfig(REQUIRED_FILES[3]);
    });

    it('binds OTLP HTTP receiver to 127.0.0.1', (t) => {
      if (skipIfMissingFiles(t)) return;
      match(content, /endpoint.*127\.0\.0\.1.*4318/,
        'Expected OTLP HTTP receiver endpoint 127.0.0.1:4318');
    });

    it('binds OTLP gRPC receiver to 127.0.0.1', (t) => {
      if (skipIfMissingFiles(t)) return;
      match(content, /endpoint.*127\.0\.0\.1.*4317/,
        'Expected OTLP gRPC receiver endpoint 127.0.0.1:4317');
    });

    it('uses local filesystem storage under /tempo', (t) => {
      if (skipIfMissingFiles(t)) return;
      ok(content.includes('/tempo'), 'Expected filesystem storage directory under /tempo');
    });

    it('contains no 0.0.0.0 wildcard bind', (t) => {
      if (skipIfMissingFiles(t)) return;
      doesNotMatch(content, /0\.0\.0\.0/, 'Tempo config must not bind to 0.0.0.0');
    });

    it('contains no unsupported compactor top-level key', (t) => {
      if (skipIfMissingFiles(t)) return;
      doesNotMatch(content, /^compactor:/m, 'Top-level compactor: rejected by Tempo >=v2 — use tempo v1 config or remove the key');
    });
  });

  // ── Grafana ini ─────────────────────────────────────────────────────────

  describe('grafana/grafana.ini', () => {
    let content;

    before(() => {
      if (missingFiles.length > 0) return;
      content = readConfig(REQUIRED_FILES[4]);
    });

    it('binds http_addr to 127.0.0.1', (t) => {
      if (skipIfMissingFiles(t)) return;
      match(content, /http_addr\s*=\s*127\.0\.0\.1/, 'Expected http_addr = 127.0.0.1');
    });

    it('disables anonymous authentication (auth.anonymous section sets enabled = false)', (t) => {
      if (skipIfMissingFiles(t)) return;
      const sectionMatch = content.match(/\[auth\.anonymous\](?:\r?\n|.)*?(?=\[|$)/);
      ok(sectionMatch, 'Expected [auth.anonymous] section in grafana.ini');
      match(sectionMatch[0], /enabled\s*=\s*false/,
        'Expected auth.anonymous enabled = false');
    });

    it('root_url uses http:// protocol (no TLS termination in this stack)', (t) => {
      if (skipIfMissingFiles(t)) return;
      match(content, /root_url\s*=\s*http:\/\//,
        'Expected root_url with http:// protocol — no TLS termination in this stack');
    });

    it('root_url and http_port are coherent (port in root_url matches http_port)', (t) => {
      if (skipIfMissingFiles(t)) return;
      const portMatch = content.match(/http_port\s*=\s*(\d+)/);
      const urlPortMatch = content.match(/root_url\s*=\s*https?:\/\/[^:]+:(\d+)/);
      ok(portMatch, 'Expected http_port setting in grafana.ini');
      ok(urlPortMatch, 'Expected root_url with port number');
      ok(
        portMatch[1] === urlPortMatch[1],
        `Port mismatch: http_port=${portMatch[1]} but root_url uses port=${urlPortMatch[1]}`,
      );
    });

    it('domain is localhost (not a Tailscale hostname without documented Tailscale Serve)', (t) => {
      if (skipIfMissingFiles(t)) return;
      match(content, /domain\s*=\s*localhost/,
        'Expected domain = localhost (update when Tailscale Serve is configured)');
    });
  });

  // ── Grafana datasources ─────────────────────────────────────────────────

  describe('grafana/provisioning/datasources/datasources.yaml', () => {
    let content;

    before(() => {
      if (missingFiles.length > 0) return;
      content = readConfig(REQUIRED_FILES[5]);
    });

    it('includes Prometheus datasource with localhost URL', (t) => {
      if (skipIfMissingFiles(t)) return;
      ok(
        /Prometheus|prometheus/.test(content) && content.includes('localhost'),
        'Expected Prometheus datasource with localhost URL',
      );
    });

    it('includes Loki datasource with localhost URL', (t) => {
      if (skipIfMissingFiles(t)) return;
      ok(
        /Loki|loki/.test(content) && content.includes('localhost'),
        'Expected Loki datasource with localhost URL',
      );
    });

    it('includes Tempo datasource with localhost URL', (t) => {
      if (skipIfMissingFiles(t)) return;
      ok(
        /Tempo|tempo/.test(content) && content.includes('localhost'),
        'Expected Tempo datasource with localhost URL',
      );
    });
  });

  // ── Deploy script ───────────────────────────────────────────────────────

  describe('scripts/xopure/deploy-observability-stack.sh', () => {
    let content;

    before(() => {
      if (missingFiles.length > 0) return;
      content = readConfig(REQUIRED_FILES[6]);
    });

    it('recreates / starts all five containers (alloy, loki, prometheus, tempo, grafana)', (t) => {
      if (skipIfMissingFiles(t)) return;
      const containerNames = ['alloy', 'loki', 'prometheus', 'tempo', 'grafana'];
      const found = containerNames.filter((name) =>
        new RegExp(`\\b${name}\\b`, 'i').test(content),
      );
      ok(
        found.length === containerNames.length,
        `Expected all 5 container names in deploy script. Missing: ${containerNames.filter((n) => !found.includes(n)).join(', ')}`,
      );
    });

    it('mounts repo config directories into /opt/grafana-stack', (t) => {
      if (skipIfMissingFiles(t)) return;
      ok(
        content.includes('/opt/grafana-stack'),
        'Expected config mount path /opt/grafana-stack',
      );
    });

    it('uses --network host for all containers', (t) => {
      if (skipIfMissingFiles(t)) return;
      ok(
        content.includes('--network host') || content.includes('--network=host'),
        'Expected --network host on containers',
      );
    });

    it('sets Prometheus --web.listen-address=127.0.0.1:9090', (t) => {
      if (skipIfMissingFiles(t)) return;
      ok(
        content.includes('web.listen-address') &&
          content.includes('127.0.0.1:9090'),
        'Expected Prometheus --web.listen-address=127.0.0.1:9090',
      );
    });

    it('sets Grafana anonymous auth to disabled via GF_AUTH_ANONYMOUS_ENABLED=false', (t) => {
      if (skipIfMissingFiles(t)) return;
      ok(
        /GF_AUTH_ANONYMOUS_ENABLED\s*=\s*false/i.test(content),
        'Expected GF_AUTH_ANONYMOUS_ENABLED=false in deploy script',
      );
    });

    it('mounts tempo-data to /var/tempo, not /tempo', (t) => {
      if (skipIfMissingFiles(t)) return;
      doesNotMatch(content, /tempo-data:\/tempo(:Z)?/,
        'Expected tempo-data mount at /var/tempo, not /tempo');
      ok(content.includes('tempo-data:/var/'),
        'Expected tempo-data mount under /var (e.g. /var/tempo)');
    });

    it('prepares Tempo storage ownership for uid/gid 10001:10001 before starting Tempo', (t) => {
      if (skipIfMissingFiles(t)) return;
      ok(
        content.includes('10001:10001') && content.includes('chown'),
        'Expected chown for 10001:10001 before Tempo container starts',
      );
    });

    it('refuses to start Grafana when GF_SECURITY_ADMIN_PASSWORD is unset or empty', (t) => {
      if (skipIfMissingFiles(t)) return;
      ok(
        /\$\{GF_SECURITY_ADMIN_PASSWORD:\?/.test(content) ||
          content.includes('exit 1') ||
          content.includes('die '),
        'Expected guard that exits when GF_SECURITY_ADMIN_PASSWORD is unset or empty',
      );
    });

    it('passes GF_SECURITY_ADMIN_PASSWORD as an env var to the Grafana container', (t) => {
      if (skipIfMissingFiles(t)) return;
      const grafanaRunLines = content.split('\n').filter((l) =>
        l.includes('run_container') && l.includes('grafana'),
      );
      const allLines = content.split('\n');
      const grafanaBlockStart = allLines.findIndex((l) =>
        l.includes('run_container') && l.includes('grafana'),
      );
      // Collect lines from the grafana run_container call until the next run_container or blank
      const blockLines = [];
      for (let i = grafanaBlockStart; i < allLines.length && i < grafanaBlockStart + 20; i++) {
        if (i > grafanaBlockStart && /^run_container\s/.test(allLines[i])) break;
        blockLines.push(allLines[i]);
      }
      const block = blockLines.join('\n');
      ok(
        /GF_SECURITY_ADMIN_PASSWORD/.test(block),
        'Expected GF_SECURITY_ADMIN_PASSWORD env var in the Grafana run_container block',
      );
    });

    it('pins all container images to explicit version tags (no :latest)', (t) => {
      if (skipIfMissingFiles(t)) return;
      const imageRefs = content.match(/docker\.io\/\S+/g) || [];
      const latestRefs = imageRefs.filter((ref) => /:latest$/.test(ref));
      ok(
        latestRefs.length === 0,
        `Expected no :latest image tags. Found: ${latestRefs.join(', ')}`,
      );
    });
  });
});
