// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024-present Datadog, Inc.

/**
 * Local HTTP server for OAuth callback handling
 */

import * as http from 'http';
import * as net from 'net';
import * as url from 'url';
import { DEFAULT_OAUTH_TIMEOUT_MS } from './types';
import { DCR_REDIRECT_URIS } from './dcr-types';

/**
 * Result of the OAuth callback
 */
export interface CallbackResult {
  /** The authorization code, if successful */
  code?: string;
  /** The state parameter returned by the authorization server */
  state?: string;
  /** Error code, if authorization failed */
  error?: string;
  /** Error description, if authorization failed */
  errorDescription?: string;
}

/**
 * HTML page to display on successful authorization
 */
const SUCCESS_HTML = `
<!DOCTYPE html>
<html>
<head>
  <title>Authorization Successful</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      display: flex;
      justify-content: center;
      align-items: center;
      height: 100vh;
      margin: 0;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    }
    .container {
      text-align: center;
      padding: 40px;
      background: white;
      border-radius: 12px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
    }
    .checkmark {
      width: 80px;
      height: 80px;
      margin: 0 auto 20px;
      border-radius: 50%;
      background: #4caf50;
      display: flex;
      justify-content: center;
      align-items: center;
    }
    .checkmark svg {
      width: 40px;
      height: 40px;
      fill: white;
    }
    h1 {
      color: #333;
      margin: 0 0 10px;
      font-size: 24px;
    }
    p {
      color: #666;
      margin: 0;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="checkmark">
      <svg viewBox="0 0 24 24">
        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
      </svg>
    </div>
    <h1>Authorization Successful</h1>
    <p>You can close this window and return to the terminal.</p>
  </div>
</body>
</html>
`;

/**
 * HTML page to display on authorization error
 */
const ERROR_HTML = (error: string, description?: string) => `
<!DOCTYPE html>
<html>
<head>
  <title>Authorization Failed</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      display: flex;
      justify-content: center;
      align-items: center;
      height: 100vh;
      margin: 0;
      background: linear-gradient(135deg, #ff6b6b 0%, #ee5a5a 100%);
    }
    .container {
      text-align: center;
      padding: 40px;
      background: white;
      border-radius: 12px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
      max-width: 400px;
    }
    .error-icon {
      width: 80px;
      height: 80px;
      margin: 0 auto 20px;
      border-radius: 50%;
      background: #f44336;
      display: flex;
      justify-content: center;
      align-items: center;
    }
    .error-icon svg {
      width: 40px;
      height: 40px;
      fill: white;
    }
    h1 {
      color: #333;
      margin: 0 0 10px;
      font-size: 24px;
    }
    p {
      color: #666;
      margin: 0 0 10px;
    }
    .error-details {
      background: #f5f5f5;
      padding: 15px;
      border-radius: 8px;
      margin-top: 15px;
      text-align: left;
    }
    .error-details code {
      font-family: Monaco, Consolas, monospace;
      font-size: 12px;
      color: #d32f2f;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="error-icon">
      <svg viewBox="0 0 24 24">
        <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
      </svg>
    </div>
    <h1>Authorization Failed</h1>
    <p>Please try again or check the terminal for details.</p>
    <div class="error-details">
      <code>Error: ${escapeHtml(error)}${description ? `\\n${escapeHtml(description)}` : ''}</code>
    </div>
  </div>
</body>
</html>
`;

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Extract ports from DCR_REDIRECT_URIS
 * These are the only ports that can be used for OAuth callbacks
 */
function getDcrRegisteredPorts(): number[] {
  return DCR_REDIRECT_URIS.map((uri) => {
    const match = uri.match(/:(\d+)\//);
    return match ? parseInt(match[1], 10) : 0;
  }).filter((port) => port > 0);
}

/**
 * Find an available port on localhost
 * Only tries ports that are registered with DCR to avoid invalid_redirect_uri errors
 * @returns An available port number from the DCR-registered ports
 * @throws Error if no registered ports are available
 */
export async function findAvailablePort(): Promise<number> {
  const registeredPorts = getDcrRegisteredPorts();

  for (const port of registeredPorts) {
    const isAvailable = await checkPortAvailable(port);
    if (isAvailable) {
      return port;
    }
  }

  throw new Error(
    `No available ports for OAuth callback. All DCR-registered ports (${registeredPorts.join(', ')}) are in use. ` +
      'Please free one of these ports and try again.'
  );
}

/**
 * Check if a port is available
 */
function checkPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();

    server.once('error', () => {
      resolve(false);
    });

    server.once('listening', () => {
      server.close();
      resolve(true);
    });

    server.listen(port, '127.0.0.1');
  });
}

/**
 * OAuth Callback Server
 * Starts a local HTTP server to receive the OAuth callback
 */
export class CallbackServer {
  private server: http.Server | null = null;
  private port: number = 0;
  private expectedState: string = '';
  private callbackPath: string;
  private timeoutMs: number;
  /** Buffered callback result to handle race condition between start() and waitForCallback() */
  private bufferedResult: CallbackResult | null = null;

  /**
   * Create a new CallbackServer
   * @param callbackPath The path for the callback endpoint (default: '/oauth/callback')
   * @param timeoutMs Timeout for waiting for callback (default: 5 minutes)
   */
  constructor(callbackPath: string = '/oauth/callback', timeoutMs: number = DEFAULT_OAUTH_TIMEOUT_MS) {
    this.callbackPath = callbackPath;
    this.timeoutMs = timeoutMs;
  }

  /**
   * Start the callback server on an available port
   * @param expectedState The expected state parameter for validation
   * @returns The port number the server is listening on
   */
  async start(expectedState: string): Promise<number> {
    this.expectedState = expectedState;
    this.port = await findAvailablePort();
    this.bufferedResult = null;

    return new Promise((resolve, reject) => {
      this.server = http.createServer((req, res) => {
        // Only handle the callback path
        const parsedUrl = url.parse(req.url || '', true);
        if (parsedUrl.pathname !== this.callbackPath) {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('Not Found');
          return;
        }

        // Capture callback data to buffer (handles race condition with waitForCallback)
        const query = parsedUrl.query;
        const result: CallbackResult = {
          code: query.code as string | undefined,
          state: query.state as string | undefined,
          error: query.error as string | undefined,
          errorDescription: query.error_description as string | undefined,
        };

        // Buffer the result for waitForCallback() to consume
        if (!this.bufferedResult) {
          this.bufferedResult = result;
        }

        // Serve HTML response
        if (result.error) {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(ERROR_HTML(result.error, result.errorDescription));
        } else {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(SUCCESS_HTML);
        }
      });

      this.server.on('error', (err) => {
        reject(new Error(`Failed to start callback server: ${err.message}`));
      });

      this.server.listen(this.port, '127.0.0.1', () => {
        resolve(this.port);
      });
    });
  }

  /**
   * Wait for the OAuth callback
   * Uses polling to check for buffered results, avoiding duplicate request handlers.
   * @returns The callback result
   */
  waitForCallback(): Promise<CallbackResult> {
    return new Promise((resolve, reject) => {
      if (!this.server) {
        reject(new Error('Server not started'));
        return;
      }

      let resolved = false;
      const pollIntervalMs = 100;

      // Set up timeout
      const timeoutId = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          this.stop();
          reject(new Error('OAuth callback timed out. Please try again.'));
        }
      }, this.timeoutMs);

      // Poll for buffered result (set by the start() handler)
      const checkForResult = () => {
        if (resolved) return;

        if (this.bufferedResult) {
          const result = this.bufferedResult;
          this.bufferedResult = null;
          resolved = true;
          clearTimeout(timeoutId);

          // Validate state
          if (result.state !== this.expectedState) {
            setTimeout(() => {
              this.stop();
              reject(new Error('Invalid state parameter. This may be a CSRF attack attempt.'));
            }, 100);
            return;
          }

          setTimeout(() => {
            this.stop();
            resolve(result);
          }, 100);
          return;
        }

        // Continue polling
        setTimeout(checkForResult, pollIntervalMs);
      };

      // Start polling
      checkForResult();
    });
  }

  /**
   * Stop the callback server
   */
  stop(): void {
    if (this.server) {
      this.server.close();
      this.server = null;
    }
  }

  /**
   * Get the redirect URI for this server
   * @returns The redirect URI
   */
  getRedirectUri(): string {
    return `http://127.0.0.1:${this.port}${this.callbackPath}`;
  }

  /**
   * Get the port number
   * @returns The port number, or 0 if not started
   */
  getPort(): number {
    return this.port;
  }
}
