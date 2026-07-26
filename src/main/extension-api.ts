/**
 * Extension API Client
 *
 * Optional client for a self-hosted extension backend (discovery + pre-built
 * bundle download). There is no default endpoint: unless the user sets
 * `extensionApiUrl`, every function here is inert and extension-registry
 * routes discovery and installs through GitHub instead.
 */

import * as https from 'https';
import * as http from 'http';
import { loadSettings } from './settings-store';
import { isBlockedUpstreamUrl } from './blocked-hosts';

import type { CatalogEntry } from './extension-registry';

const REQUEST_TIMEOUT = 30_000;

function getApiBaseUrl(): string {
  try {
    const configured = String(loadSettings().extensionApiUrl || '').trim();
    // Refuse upstream hosts even if one is pasted into the setting by hand.
    if (!configured || isBlockedUpstreamUrl(configured)) return '';
    return configured;
  } catch {
    return '';
  }
}

/**
 * True when the user has configured their own extension backend. Callers must
 * check this before using the functions below — without it there is no
 * endpoint to talk to and every request fails.
 */
export function isExtensionApiConfigured(): boolean {
  return getApiBaseUrl().length > 0;
}

/** Minimal JSON fetch using Node built-in http(s). */
function jsonRequest<T>(
  method: string,
  urlPath: string,
  body?: Record<string, unknown>,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const baseUrl = getApiBaseUrl();
    if (!baseUrl) {
      reject(new Error('No extension API configured (set `extensionApiUrl`).'));
      return;
    }
    const fullUrl = new URL(urlPath, baseUrl);

    const isHttps = fullUrl.protocol === 'https:';
    const transport = isHttps ? https : http;

    const payload = body ? JSON.stringify(body) : undefined;

    const options: https.RequestOptions = {
      method,
      hostname: fullUrl.hostname,
      port: fullUrl.port || (isHttps ? 443 : 80),
      path: fullUrl.pathname + fullUrl.search,
      headers: {
        'User-Agent': 'Discov',
        Accept: 'application/json',
        ...(payload
          ? {
              'Content-Type': 'application/json',
              'Content-Length': Buffer.byteLength(payload),
            }
          : {}),
      },
      timeout: REQUEST_TIMEOUT,
    };

    const req = transport.request(options, (res) => {
      const chunks: Buffer[] = [];

      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const statusCode = res.statusCode ?? 0;
        const rawBody = Buffer.concat(chunks).toString('utf-8');

        if (statusCode < 200 || statusCode >= 300) {
          reject(
            new Error(
              `API request failed: ${method} ${urlPath} → ${statusCode} ${res.statusMessage}\n${rawBody}`,
            ),
          );
          return;
        }

        try {
          resolve(JSON.parse(rawBody) as T);
        } catch (parseError) {
          reject(new Error(`Failed to parse API response as JSON: ${rawBody}`));
        }
      });
    });

    req.on('error', (err) => reject(err));
    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`API request timed out: ${method} ${urlPath}`));
    });

    if (payload) req.write(payload);
    req.end();
  });
}

// ─── Public API ──────────────────────────────────────────────────────

/** Fetch the full extension catalog from the backend. */
export async function fetchCatalogFromAPI(): Promise<CatalogEntry[]> {
  const data = await jsonRequest<any[]>('GET', '/extensions/catalog');

  // Normalize backend shape → CatalogEntry
  return data.map((entry) => ({
    name: entry.name ?? '',
    title: entry.title ?? '',
    description: entry.description ?? '',
    author: entry.author ?? '',
    contributors: entry.contributors ?? [],
    icon: entry.icon ?? '',
    iconUrl: entry.iconUrl ?? entry.icon_url ?? '',
    screenshotUrls: entry.screenshotUrls ?? entry.screenshot_urls ?? [],
    categories: entry.categories ?? [],
    platforms: entry.platforms ?? [],
    commands: (entry.commands ?? []).map((cmd: any) => ({
      name: cmd.name ?? '',
      title: cmd.title ?? '',
      description: cmd.description ?? '',
    })),
    installCount: entry.installCount ?? entry.install_count ?? 0,
  }));
}

/** Get a download URL for the extension bundle from the backend. */
export async function getExtensionBundleUrl(
  name: string,
): Promise<{ url: string; type: 'bundle' | 'source' }> {
  return jsonRequest<{ url: string; type: 'bundle' | 'source' }>(
    'GET',
    `/extensions/${encodeURIComponent(name)}/bundle`,
  );
}

/** Get extension screenshot URLs from the backend. */
export async function getExtensionScreenshotsFromAPI(
  name: string,
): Promise<string[]> {
  try {
    return await jsonRequest<string[]>(
      'GET',
      `/extensions/${encodeURIComponent(name)}/screenshots`,
    );
  } catch {
    return [];
  }
}
