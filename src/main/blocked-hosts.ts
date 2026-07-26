/**
 * Blocked upstream hosts.
 *
 * Discov is a fork of SuperCmd and deliberately sends nothing to the upstream
 * project's infrastructure. Those hosts are blocked here rather than merely
 * removed from the call sites, so that a future refactor — or a merged upstream
 * commit — cannot quietly reintroduce a request to them.
 *
 * Enforced in two places, because they cover different traffic:
 *   - `installUpstreamHostBlocker()` covers Electron session traffic
 *     (renderer fetch/XHR, `net.fetch`, window loads).
 *   - `assertHostAllowed()` covers Node `http`/`https` calls made from the
 *     main process, which never reach a session and so bypass webRequest.
 */

/** Hosts owned by the upstream SuperCmd project. Matched on the host itself and any subdomain. */
export const BLOCKED_UPSTREAM_HOSTS = [
  'supercmd.sh',
  'supercmd-extensions.s3.amazonaws.com',
] as const;

function hostMatches(hostname: string): boolean {
  const host = hostname.trim().toLowerCase().replace(/\.$/, '');
  if (!host) return false;
  return BLOCKED_UPSTREAM_HOSTS.some(
    (blocked) => host === blocked || host.endsWith(`.${blocked}`)
  );
}

/** True when `url` points at upstream SuperCmd infrastructure. Unparseable input is not blocked. */
export function isBlockedUpstreamUrl(url: string): boolean {
  try {
    return hostMatches(new URL(String(url || '')).hostname);
  } catch {
    return false;
  }
}

/** Throw if `url` points at upstream infrastructure. Use before any main-process request. */
export function assertHostAllowed(url: string): void {
  if (isBlockedUpstreamUrl(url)) {
    throw new Error(
      `Blocked request to upstream SuperCmd host: ${url}. Discov sends no data to upstream infrastructure; configure your own endpoint instead.`
    );
  }
}

/** Block upstream hosts across all Electron session traffic. Safe to call once at startup. */
export function installUpstreamHostBlocker(): void {
  try {
    const { session } = require('electron');
    const defaultSession = session?.defaultSession;
    if (!defaultSession?.webRequest?.onBeforeRequest) {
      console.warn('[blocked-hosts] webRequest.onBeforeRequest unavailable; session blocker not installed');
      return;
    }

    defaultSession.webRequest.onBeforeRequest(
      { urls: ['http://*/*', 'https://*/*', 'ws://*/*', 'wss://*/*'] },
      (details: any, callback: any) => {
        if (isBlockedUpstreamUrl(details.url)) {
          console.warn(`[blocked-hosts] Blocked upstream request: ${details.url}`);
          callback({ cancel: true });
          return;
        }
        callback({});
      }
    );
    console.log('[blocked-hosts] Upstream host blocker installed on defaultSession');
  } catch (error) {
    console.warn('[blocked-hosts] Failed to install upstream host blocker:', error);
  }
}
