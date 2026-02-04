// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024-present Datadog, Inc.

/**
 * Unit tests for token refresher module
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  TokenRefresher,
  NoTokensError,
  RefreshTokenExpiredError,
  resetTokenRefreshers,
} from '../../../src/lib/auth/token-refresher';
import { TokenStorage, resetTokenStorage } from '../../../src/lib/auth/token-storage';
import { OAuthTokens } from '../../../src/lib/auth/types';

describe('TokenRefresher', () => {
  let testDir: string;
  let storage: TokenStorage;
  let refresher: TokenRefresher;

  const createTestTokens = (options: {
    issuedSecondsAgo?: number;
    expiresIn?: number;
  } = {}): OAuthTokens => ({
    accessToken: 'test-access-token',
    refreshToken: 'test-refresh-token',
    tokenType: 'Bearer',
    expiresIn: options.expiresIn ?? 3600,
    issuedAt: Math.floor(Date.now() / 1000) - (options.issuedSecondsAgo ?? 0),
    scope: 'dashboards_read monitors_read',
  });

  beforeEach(() => {
    // Create a temporary test directory
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dd-oauth-refresh-test-'));
    storage = new TokenStorage(testDir);
    resetTokenStorage();
    resetTokenRefreshers();
    refresher = new TokenRefresher('datadoghq.com', 'test-client-id', storage);
  });

  afterEach(() => {
    // Clean up test directory
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('hasTokens()', () => {
    it('should return false when no tokens stored', () => {
      expect(refresher.hasTokens()).toBe(false);
    });

    it('should return true when tokens are stored', () => {
      storage.saveTokens('datadoghq.com', createTestTokens());
      expect(refresher.hasTokens()).toBe(true);
    });
  });

  describe('getCurrentTokens()', () => {
    it('should return null when no tokens stored', () => {
      expect(refresher.getCurrentTokens()).toBeNull();
    });

    it('should return stored tokens', () => {
      const tokens = createTestTokens();
      storage.saveTokens('datadoghq.com', tokens);

      const current = refresher.getCurrentTokens();
      expect(current).toEqual(tokens);
    });
  });

  describe('needsRefresh()', () => {
    it('should return false when no tokens stored', () => {
      expect(refresher.needsRefresh()).toBe(false);
    });

    it('should return false for valid non-expired tokens', () => {
      storage.saveTokens('datadoghq.com', createTestTokens());
      expect(refresher.needsRefresh()).toBe(false);
    });

    it('should return true for expired tokens', () => {
      storage.saveTokens('datadoghq.com', createTestTokens({
        issuedSecondsAgo: 7200, // 2 hours ago
        expiresIn: 3600, // Expires in 1 hour = expired 1 hour ago
      }));
      expect(refresher.needsRefresh()).toBe(true);
    });

    it('should return true for tokens expiring within buffer', () => {
      storage.saveTokens('datadoghq.com', createTestTokens({
        issuedSecondsAgo: 3400, // Expires in 200s
        expiresIn: 3600,
      }));
      // Default buffer is 5 minutes (300s), so 200s remaining = needs refresh
      expect(refresher.needsRefresh()).toBe(true);
    });
  });

  describe('getStatus()', () => {
    it('should return hasTokens false when no tokens', () => {
      const status = refresher.getStatus();
      expect(status.hasTokens).toBe(false);
      expect(status.needsRefresh).toBe(false);
      expect(status.expiresAt).toBeUndefined();
    });

    it('should return correct status for valid tokens', () => {
      storage.saveTokens('datadoghq.com', createTestTokens());

      const status = refresher.getStatus();
      expect(status.hasTokens).toBe(true);
      expect(status.needsRefresh).toBe(false);
      expect(status.expiresAt).toBeInstanceOf(Date);
      expect(status.expiresInSeconds).toBeGreaterThan(0);
    });

    it('should return correct status for tokens needing refresh', () => {
      storage.saveTokens('datadoghq.com', createTestTokens({
        issuedSecondsAgo: 3400, // Expires in 200s
        expiresIn: 3600,
      }));

      const status = refresher.getStatus();
      expect(status.hasTokens).toBe(true);
      expect(status.needsRefresh).toBe(true);
    });
  });

  describe('getValidAccessToken()', () => {
    it('should throw NoTokensError when no tokens stored', async () => {
      await expect(refresher.getValidAccessToken()).rejects.toThrow(NoTokensError);
    });

    it('should return access token when valid', async () => {
      const tokens = createTestTokens();
      storage.saveTokens('datadoghq.com', tokens);

      const accessToken = await refresher.getValidAccessToken();
      expect(accessToken).toBe('test-access-token');
    });
  });

  describe('NoTokensError', () => {
    it('should have correct message', () => {
      const error = new NoTokensError('datadoghq.com');
      expect(error.message).toContain('datadoghq.com');
      expect(error.message).toContain('dd-plugin auth login');
      expect(error.name).toBe('NoTokensError');
    });
  });

  describe('RefreshTokenExpiredError', () => {
    it('should have correct message', () => {
      const error = new RefreshTokenExpiredError();
      expect(error.message).toContain('expired');
      expect(error.message).toContain('dd-plugin auth login');
      expect(error.name).toBe('RefreshTokenExpiredError');
    });
  });
});
