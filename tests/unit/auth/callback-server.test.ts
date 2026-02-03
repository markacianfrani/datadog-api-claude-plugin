// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024-present Datadog, Inc.

/**
 * Unit tests for callback server module
 */

import * as http from 'http';
import { CallbackServer, findAvailablePort } from '../../../src/lib/auth/callback-server';
import { DCR_REDIRECT_URIS } from '../../../src/lib/auth/dcr-types';

// Extract the DCR-registered ports for test assertions
const DCR_REGISTERED_PORTS = DCR_REDIRECT_URIS.map((uri) => {
  const match = uri.match(/:(\d+)\//);
  return match ? parseInt(match[1], 10) : 0;
}).filter((port) => port > 0);

describe('Callback Server', () => {
  describe('findAvailablePort()', () => {
    it('should find an available port from DCR-registered ports', async () => {
      const port = await findAvailablePort();
      expect(DCR_REGISTERED_PORTS).toContain(port);
    });

    it('should find different ports on subsequent calls when first is taken', async () => {
      // Start a server on the first port
      const server1 = new CallbackServer();
      await server1.start('state1');
      const port1 = server1.getPort();

      // Find another port
      const port2 = await findAvailablePort();

      // Clean up
      server1.stop();

      // The second port should be different (the first one was taken)
      expect(port2).not.toBe(port1);
      // Both should be DCR-registered ports
      expect(DCR_REGISTERED_PORTS).toContain(port1);
      expect(DCR_REGISTERED_PORTS).toContain(port2);
    });
  });

  describe('CallbackServer', () => {
    let server: CallbackServer;

    afterEach(() => {
      if (server) {
        server.stop();
      }
    });

    describe('start()', () => {
      it('should start server on an available port', async () => {
        server = new CallbackServer();
        const port = await server.start('test-state');

        expect(port).toBeGreaterThan(0);
        expect(server.getPort()).toBe(port);
      });

      it('should generate correct redirect URI', async () => {
        server = new CallbackServer('/oauth/callback');
        const port = await server.start('test-state');

        expect(server.getRedirectUri()).toBe(`http://127.0.0.1:${port}/oauth/callback`);
      });

      it('should use custom callback path', async () => {
        server = new CallbackServer('/custom/path');
        const port = await server.start('test-state');

        expect(server.getRedirectUri()).toBe(`http://127.0.0.1:${port}/custom/path`);
      });
    });

    describe('stop()', () => {
      it('should stop the server', async () => {
        server = new CallbackServer();
        await server.start('test-state');
        const port = server.getPort();

        server.stop();

        // Verify server is stopped by checking we can't connect
        const canConnect = await checkPortListening(port);
        expect(canConnect).toBe(false);
      });

      it('should handle being called multiple times', async () => {
        server = new CallbackServer();
        await server.start('test-state');

        expect(() => {
          server.stop();
          server.stop();
        }).not.toThrow();
      });
    });

    describe('waitForCallback()', () => {
      it('should extract code from successful callback', async () => {
        server = new CallbackServer('/oauth/callback', 5000);
        const port = await server.start('test-state');

        // Make callback request in background
        const callbackPromise = server.waitForCallback();

        // Simulate OAuth callback
        await makeCallbackRequest(port, '/oauth/callback', {
          code: 'auth-code-123',
          state: 'test-state',
        });

        const result = await callbackPromise;

        expect(result.code).toBe('auth-code-123');
        expect(result.state).toBe('test-state');
        expect(result.error).toBeUndefined();
      });

      it('should extract error from error callback', async () => {
        server = new CallbackServer('/oauth/callback', 5000);
        const port = await server.start('test-state');

        // Make callback request in background
        const callbackPromise = server.waitForCallback();

        // Small delay to ensure server is ready
        await new Promise((resolve) => setTimeout(resolve, 10));

        // Simulate OAuth error callback (don't await, let it run in parallel)
        makeCallbackRequest(port, '/oauth/callback', {
          error: 'access_denied',
          error_description: 'User denied access',
          state: 'test-state',
        }).catch(() => {
          // Ignore connection errors - server may close before response is fully read
        });

        const result = await callbackPromise;

        expect(result.error).toBe('access_denied');
        expect(result.errorDescription).toBe('User denied access');
        expect(result.state).toBe('test-state');
      });

      it('should reject on invalid state', async () => {
        server = new CallbackServer('/oauth/callback', 5000);
        const port = await server.start('expected-state');

        // Make callback request with wrong state
        const callbackPromise = server.waitForCallback();

        // Small delay to ensure server is ready
        await new Promise((resolve) => setTimeout(resolve, 10));

        // Make callback request (ignore connection errors)
        makeCallbackRequest(port, '/oauth/callback', {
          code: 'auth-code',
          state: 'wrong-state',
        }).catch(() => {
          // Ignore connection errors - server may close before response is fully read
        });

        await expect(callbackPromise).rejects.toThrow('Invalid state parameter');
      });

      it('should timeout if no callback received', async () => {
        server = new CallbackServer('/oauth/callback', 100); // 100ms timeout
        await server.start('test-state');

        const callbackPromise = server.waitForCallback();

        await expect(callbackPromise).rejects.toThrow('OAuth callback timed out');
      });
    });

    describe('getPort()', () => {
      it('should return 0 when server not started', () => {
        server = new CallbackServer();
        expect(server.getPort()).toBe(0);
      });

      it('should return port after server started', async () => {
        server = new CallbackServer();
        const port = await server.start('test-state');
        expect(server.getPort()).toBe(port);
      });
    });
  });
});

/**
 * Helper function to check if a port is listening
 */
function checkPortListening(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.get(`http://127.0.0.1:${port}/`, () => {
      resolve(true);
    });

    req.on('error', () => {
      resolve(false);
    });

    req.setTimeout(100, () => {
      req.destroy();
      resolve(false);
    });
  });
}

/**
 * Helper function to make a callback request
 */
function makeCallbackRequest(
  port: number,
  path: string,
  params: Record<string, string>
): Promise<void> {
  return new Promise((resolve, reject) => {
    const queryString = new URLSearchParams(params).toString();
    const url = `http://127.0.0.1:${port}${path}?${queryString}`;

    const req = http.get(url, (res) => {
      // Consume response
      res.on('data', () => {/* consume response */});
      res.on('end', () => resolve());
    });

    req.on('error', reject);
    req.setTimeout(5000);
  });
}
