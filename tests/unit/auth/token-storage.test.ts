// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024-present Datadog, Inc.

/**
 * Unit tests for token storage module
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { TokenStorage, resetTokenStorage } from '../../../src/lib/auth/token-storage';
import { OAuthTokens } from '../../../src/lib/auth/types';

describe('TokenStorage', () => {
  let testDir: string;
  let storage: TokenStorage;

  const createTestTokens = (site: string = 'datadoghq.com'): OAuthTokens => ({
    accessToken: `access-token-${site}`,
    refreshToken: `refresh-token-${site}`,
    tokenType: 'Bearer',
    expiresIn: 3600,
    issuedAt: Math.floor(Date.now() / 1000),
    scope: 'dashboards_read monitors_read',
  });

  beforeEach(() => {
    // Create a temporary test directory
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dd-oauth-test-'));
    storage = new TokenStorage(testDir);
    resetTokenStorage();
  });

  afterEach(() => {
    // Clean up test directory
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('saveTokens()', () => {
    it('should save tokens to storage', () => {
      const tokens = createTestTokens();
      storage.saveTokens('datadoghq.com', tokens);

      const retrieved = storage.getTokens('datadoghq.com');
      expect(retrieved).toEqual(tokens);
    });

    it('should create storage directory if it does not exist', () => {
      const newDir = path.join(testDir, 'new-subdir');
      const newStorage = new TokenStorage(newDir);
      const tokens = createTestTokens();

      newStorage.saveTokens('datadoghq.com', tokens);

      expect(fs.existsSync(newDir)).toBe(true);
    });

    it('should overwrite existing tokens for same site', () => {
      const tokens1 = createTestTokens();
      storage.saveTokens('datadoghq.com', tokens1);

      const tokens2 = { ...createTestTokens(), accessToken: 'new-access-token' };
      storage.saveTokens('datadoghq.com', tokens2);

      const retrieved = storage.getTokens('datadoghq.com');
      expect(retrieved?.accessToken).toBe('new-access-token');
    });

    it('should support multiple sites', () => {
      const tokensUS = createTestTokens('datadoghq.com');
      const tokensEU = createTestTokens('datadoghq.eu');

      storage.saveTokens('datadoghq.com', tokensUS);
      storage.saveTokens('datadoghq.eu', tokensEU);

      expect(storage.getTokens('datadoghq.com')).toEqual(tokensUS);
      expect(storage.getTokens('datadoghq.eu')).toEqual(tokensEU);
    });
  });

  describe('getTokens()', () => {
    it('should return null for non-existent site', () => {
      const tokens = storage.getTokens('nonexistent.site');
      expect(tokens).toBeNull();
    });

    it('should return stored tokens', () => {
      const tokens = createTestTokens();
      storage.saveTokens('datadoghq.com', tokens);

      const retrieved = storage.getTokens('datadoghq.com');
      expect(retrieved).toEqual(tokens);
    });

    it('should return null when storage file does not exist', () => {
      const freshStorage = new TokenStorage(path.join(testDir, 'fresh'));
      expect(freshStorage.getTokens('datadoghq.com')).toBeNull();
    });
  });

  describe('deleteTokens()', () => {
    it('should delete tokens for a site', () => {
      const tokens = createTestTokens();
      storage.saveTokens('datadoghq.com', tokens);

      const deleted = storage.deleteTokens('datadoghq.com');

      expect(deleted).toBe(true);
      expect(storage.getTokens('datadoghq.com')).toBeNull();
    });

    it('should return false when no tokens exist', () => {
      const deleted = storage.deleteTokens('nonexistent.site');
      expect(deleted).toBe(false);
    });

    it('should not affect other sites', () => {
      const tokensUS = createTestTokens('datadoghq.com');
      const tokensEU = createTestTokens('datadoghq.eu');

      storage.saveTokens('datadoghq.com', tokensUS);
      storage.saveTokens('datadoghq.eu', tokensEU);

      storage.deleteTokens('datadoghq.com');

      expect(storage.getTokens('datadoghq.com')).toBeNull();
      expect(storage.getTokens('datadoghq.eu')).toEqual(tokensEU);
    });
  });

  describe('deleteAllTokens()', () => {
    it('should delete all stored tokens', () => {
      const tokensUS = createTestTokens('datadoghq.com');
      const tokensEU = createTestTokens('datadoghq.eu');

      storage.saveTokens('datadoghq.com', tokensUS);
      storage.saveTokens('datadoghq.eu', tokensEU);

      storage.deleteAllTokens();

      expect(storage.getTokens('datadoghq.com')).toBeNull();
      expect(storage.getTokens('datadoghq.eu')).toBeNull();
    });

    it('should handle non-existent storage file', () => {
      expect(() => storage.deleteAllTokens()).not.toThrow();
    });
  });

  describe('hasValidTokens()', () => {
    it('should return false when no tokens exist', () => {
      expect(storage.hasValidTokens('datadoghq.com')).toBe(false);
    });

    it('should return true for valid non-expired tokens', () => {
      const tokens = createTestTokens();
      storage.saveTokens('datadoghq.com', tokens);

      expect(storage.hasValidTokens('datadoghq.com')).toBe(true);
    });

    it('should return true for expired tokens with refresh token (refreshable)', () => {
      const tokens = {
        ...createTestTokens(),
        issuedAt: Math.floor(Date.now() / 1000) - 7200, // 2 hours ago
        expiresIn: 3600, // Expired 1 hour ago
      };
      storage.saveTokens('datadoghq.com', tokens);

      expect(storage.hasValidTokens('datadoghq.com', true)).toBe(true);
    });

    it('should return false for expired tokens when not checking refreshable', () => {
      const tokens = {
        ...createTestTokens(),
        issuedAt: Math.floor(Date.now() / 1000) - 7200, // 2 hours ago
        expiresIn: 3600, // Expired 1 hour ago
      };
      storage.saveTokens('datadoghq.com', tokens);

      expect(storage.hasValidTokens('datadoghq.com', false)).toBe(false);
    });
  });

  describe('listSites()', () => {
    it('should return empty array when no tokens stored', () => {
      expect(storage.listSites()).toEqual([]);
    });

    it('should return list of sites with stored tokens', () => {
      storage.saveTokens('datadoghq.com', createTestTokens('datadoghq.com'));
      storage.saveTokens('datadoghq.eu', createTestTokens('datadoghq.eu'));

      const sites = storage.listSites();
      expect(sites).toContain('datadoghq.com');
      expect(sites).toContain('datadoghq.eu');
      expect(sites.length).toBe(2);
    });
  });

  describe('getStoragePath()', () => {
    it('should return the token file path', () => {
      const storagePath = storage.getStoragePath();
      expect(storagePath).toBe(path.join(testDir, 'oauth_tokens.json'));
    });
  });

  describe('exists()', () => {
    it('should return false when storage file does not exist', () => {
      expect(storage.exists()).toBe(false);
    });

    it('should return true when storage file exists', () => {
      storage.saveTokens('datadoghq.com', createTestTokens());
      expect(storage.exists()).toBe(true);
    });
  });

  describe('getTokenExpiration()', () => {
    it('should return null when no tokens exist', () => {
      expect(storage.getTokenExpiration('datadoghq.com')).toBeNull();
    });

    it('should return expiration info for valid tokens', () => {
      const tokens = createTestTokens();
      storage.saveTokens('datadoghq.com', tokens);

      const expiration = storage.getTokenExpiration('datadoghq.com');

      expect(expiration).not.toBeNull();
      expect(expiration?.accessTokenExpiresAt).toBeInstanceOf(Date);
      expect(expiration?.isAccessTokenExpired).toBe(false);
      expect(expiration?.expiresInSeconds).toBeGreaterThan(0);
    });

    it('should correctly identify expired tokens', () => {
      const tokens = {
        ...createTestTokens(),
        issuedAt: Math.floor(Date.now() / 1000) - 7200, // 2 hours ago
        expiresIn: 3600, // Expired 1 hour ago
      };
      storage.saveTokens('datadoghq.com', tokens);

      const expiration = storage.getTokenExpiration('datadoghq.com');

      expect(expiration?.isAccessTokenExpired).toBe(true);
      expect(expiration?.expiresInSeconds).toBe(0);
    });
  });
});
