// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024-present Datadog, Inc.

/**
 * Unit tests for DCR client module
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  getDCREndpoint,
  deleteClientCredentials,
  getStoredClientCredentials,
  hasClientCredentials,
  DCRError,
  DCRNotAvailableError,
} from '../../../src/lib/auth/dcr-client';
import { resetClientCredentialsStorage } from '../../../src/lib/auth/client-credentials-storage';
import { DCR_CLIENT_NAME, DCR_REDIRECT_URIS, DCR_GRANT_TYPES } from '../../../src/lib/auth/dcr-types';

describe('DCR Client', () => {
  describe('getDCREndpoint()', () => {
    it('should return correct endpoint for US1 site', () => {
      const endpoint = getDCREndpoint('datadoghq.com');
      expect(endpoint).toBe('https://api.datadoghq.com/api/v2/oauth2/register');
    });

    it('should return correct endpoint for EU1 site', () => {
      const endpoint = getDCREndpoint('datadoghq.eu');
      expect(endpoint).toBe('https://api.datadoghq.eu/api/v2/oauth2/register');
    });

    it('should return correct endpoint for US3 site', () => {
      const endpoint = getDCREndpoint('us3.datadoghq.com');
      expect(endpoint).toBe('https://api.us3.datadoghq.com/api/v2/oauth2/register');
    });

    it('should return correct endpoint for staging site', () => {
      const endpoint = getDCREndpoint('datad0g.com');
      expect(endpoint).toBe('https://api.datad0g.com/api/v2/oauth2/register');
    });
  });

  describe('DCRError', () => {
    it('should have correct name', () => {
      const error = new DCRError('test message');
      expect(error.name).toBe('DCRError');
    });

    it('should include status code', () => {
      const error = new DCRError('test', 400, 'invalid_request');
      expect(error.statusCode).toBe(400);
      expect(error.errorCode).toBe('invalid_request');
    });

    it('should include cause', () => {
      const cause = new Error('underlying');
      const error = new DCRError('test', undefined, undefined, cause);
      expect(error.cause).toBe(cause);
    });
  });

  describe('DCRNotAvailableError', () => {
    it('should have correct name', () => {
      const error = new DCRNotAvailableError('datadoghq.com');
      expect(error.name).toBe('DCRNotAvailableError');
    });

    it('should have 404 status code', () => {
      const error = new DCRNotAvailableError('datadoghq.com');
      expect(error.statusCode).toBe(404);
    });

    it('should include site in message', () => {
      const error = new DCRNotAvailableError('datadoghq.eu');
      expect(error.message).toContain('datadoghq.eu');
    });
  });

  describe('registerClient() - request structure', () => {
    // Note: Network tests are skipped because the registerClient function uses https
    // and we can't easily mock it with a local http server in unit tests.
    // Integration tests should cover the actual DCR flow.

    it('should construct correct registration request', () => {
      // This test verifies the interface/types work correctly
      const request = {
        client_name: DCR_CLIENT_NAME,
        redirect_uris: DCR_REDIRECT_URIS,
        grant_types: DCR_GRANT_TYPES,
      };

      expect(request.client_name).toBe('datadog-api-claude-plugin');
      expect(request.redirect_uris[0]).toContain('http://127.0.0.1');
      expect(request.redirect_uris[0]).toContain('/oauth/callback');
      expect(request.grant_types).toContain('authorization_code');
      expect(request.grant_types).toContain('refresh_token');
    });
  });

  describe('credential management functions', () => {
    let testDir: string;
    let testFilePath: string;
    let originalEnv: string | undefined;

    beforeEach(() => {
      // Reset storage and set up file-based storage for testing
      resetClientCredentialsStorage();
      originalEnv = process.env.DD_CLIENT_STORAGE;
      process.env.DD_CLIENT_STORAGE = 'file';

      testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dcr-client-test-'));
      testFilePath = path.join(testDir, 'oauth_clients.json');
    });

    afterEach(() => {
      // Restore environment
      if (originalEnv !== undefined) {
        process.env.DD_CLIENT_STORAGE = originalEnv;
      } else {
        delete process.env.DD_CLIENT_STORAGE;
      }
      resetClientCredentialsStorage();

      // Clean up test files
      try {
        if (fs.existsSync(testFilePath)) {
          fs.unlinkSync(testFilePath);
        }
        fs.rmdirSync(testDir);
      } catch {
        // Ignore cleanup errors
      }
    });

    describe('hasClientCredentials()', () => {
      it('should return false when no credentials exist', () => {
        expect(hasClientCredentials('nonexistent.com')).toBe(false);
      });
    });

    describe('getStoredClientCredentials()', () => {
      it('should return null when no credentials exist', () => {
        expect(getStoredClientCredentials('nonexistent.com')).toBeNull();
      });
    });

    describe('deleteClientCredentials()', () => {
      it('should return false when no credentials exist', () => {
        expect(deleteClientCredentials('nonexistent.com')).toBe(false);
      });
    });
  });
});
