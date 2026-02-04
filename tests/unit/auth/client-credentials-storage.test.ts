// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024-present Datadog, Inc.

/**
 * Unit tests for client credentials storage module
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  FileClientStorage,
  ClientCredentialsError,
  resetClientCredentialsStorage,
} from '../../../src/lib/auth/client-credentials-storage';
import { StoredClientCredentials } from '../../../src/lib/auth/dcr-types';

describe('Client Credentials Storage', () => {
  describe('FileClientStorage', () => {
    let storage: FileClientStorage;
    let testDir: string;
    let testFilePath: string;

    beforeEach(() => {
      // Create a temp directory for testing
      testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dcr-test-'));
      testFilePath = path.join(testDir, 'oauth_clients.json');
      storage = new FileClientStorage(testFilePath);
    });

    afterEach(() => {
      // Clean up test files
      resetClientCredentialsStorage();
      try {
        if (fs.existsSync(testFilePath)) {
          fs.unlinkSync(testFilePath);
        }
        fs.rmdirSync(testDir);
      } catch {
        // Ignore cleanup errors
      }
    });

    const createTestCredentials = (site: string = 'datadoghq.com'): StoredClientCredentials => ({
      clientId: 'test-client-id-123',
      clientName: 'test-client',
      redirectUris: ['http://localhost:8080/callback'],
      registeredAt: Math.floor(Date.now() / 1000),
      site,
    });

    describe('getBackendType()', () => {
      it('should return "file"', () => {
        expect(storage.getBackendType()).toBe('file');
      });
    });

    describe('getStorageLocation()', () => {
      it('should return the file path', () => {
        expect(storage.getStorageLocation()).toBe(testFilePath);
      });
    });

    describe('saveCredentials() / getCredentials()', () => {
      it('should save and retrieve credentials', () => {
        const credentials = createTestCredentials();
        storage.saveCredentials('datadoghq.com', credentials);

        const retrieved = storage.getCredentials('datadoghq.com');
        expect(retrieved).toEqual(credentials);
      });

      it('should return null for non-existent credentials', () => {
        const retrieved = storage.getCredentials('nonexistent.com');
        expect(retrieved).toBeNull();
      });

      it('should handle multiple sites', () => {
        const us1Credentials = createTestCredentials('datadoghq.com');
        const euCredentials = createTestCredentials('datadoghq.eu');
        euCredentials.clientId = 'eu-client-id';

        storage.saveCredentials('datadoghq.com', us1Credentials);
        storage.saveCredentials('datadoghq.eu', euCredentials);

        expect(storage.getCredentials('datadoghq.com')?.clientId).toBe('test-client-id-123');
        expect(storage.getCredentials('datadoghq.eu')?.clientId).toBe('eu-client-id');
      });

      it('should overwrite existing credentials', () => {
        const original = createTestCredentials();
        const updated = createTestCredentials();
        updated.clientId = 'new-client-id';

        storage.saveCredentials('datadoghq.com', original);
        storage.saveCredentials('datadoghq.com', updated);

        expect(storage.getCredentials('datadoghq.com')?.clientId).toBe('new-client-id');
      });

      it('should create the credentials file with 0600 permissions', () => {
        const credentials = createTestCredentials();
        storage.saveCredentials('datadoghq.com', credentials);

        expect(fs.existsSync(testFilePath)).toBe(true);

        // Check file permissions (Unix only)
        if (process.platform !== 'win32') {
          const stats = fs.statSync(testFilePath);
          // 0o600 = owner read/write only
          expect(stats.mode & 0o777).toBe(0o600);
        }
      });
    });

    describe('deleteCredentials()', () => {
      it('should delete existing credentials', () => {
        const credentials = createTestCredentials();
        storage.saveCredentials('datadoghq.com', credentials);

        const deleted = storage.deleteCredentials('datadoghq.com');

        expect(deleted).toBe(true);
        expect(storage.getCredentials('datadoghq.com')).toBeNull();
      });

      it('should return false for non-existent credentials', () => {
        const deleted = storage.deleteCredentials('nonexistent.com');
        expect(deleted).toBe(false);
      });

      it('should not affect other sites', () => {
        const us1Credentials = createTestCredentials('datadoghq.com');
        const euCredentials = createTestCredentials('datadoghq.eu');

        storage.saveCredentials('datadoghq.com', us1Credentials);
        storage.saveCredentials('datadoghq.eu', euCredentials);

        storage.deleteCredentials('datadoghq.com');

        expect(storage.getCredentials('datadoghq.com')).toBeNull();
        expect(storage.getCredentials('datadoghq.eu')).not.toBeNull();
      });
    });

    describe('deleteAllCredentials()', () => {
      it('should delete the credentials file', () => {
        const credentials = createTestCredentials();
        storage.saveCredentials('datadoghq.com', credentials);

        expect(fs.existsSync(testFilePath)).toBe(true);

        storage.deleteAllCredentials();

        expect(fs.existsSync(testFilePath)).toBe(false);
      });

      it('should not throw if file does not exist', () => {
        expect(() => storage.deleteAllCredentials()).not.toThrow();
      });
    });

    describe('listSites()', () => {
      it('should return empty array when no credentials exist', () => {
        expect(storage.listSites()).toEqual([]);
      });

      it('should return all sites with credentials', () => {
        storage.saveCredentials('datadoghq.com', createTestCredentials('datadoghq.com'));
        storage.saveCredentials('datadoghq.eu', createTestCredentials('datadoghq.eu'));

        const sites = storage.listSites();

        expect(sites).toContain('datadoghq.com');
        expect(sites).toContain('datadoghq.eu');
        expect(sites).toHaveLength(2);
      });
    });
  });

  describe('ClientCredentialsError', () => {
    it('should have the correct name', () => {
      const error = new ClientCredentialsError('test message', 'test-operation');
      expect(error.name).toBe('ClientCredentialsError');
    });

    it('should include operation', () => {
      const error = new ClientCredentialsError('test message', 'save');
      expect(error.operation).toBe('save');
    });

    it('should include cause', () => {
      const cause = new Error('underlying error');
      const error = new ClientCredentialsError('test message', 'get', cause);
      expect(error.cause).toBe(cause);
    });
  });
});
