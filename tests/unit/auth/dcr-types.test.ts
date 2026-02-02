// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024-present Datadog, Inc.

/**
 * Unit tests for DCR types module
 */

import {
  DCR_CLIENT_NAME,
  DCR_REDIRECT_URIS,
  DCR_GRANT_TYPES,
  ClientRegistrationRequest,
  ClientRegistrationResponse,
  StoredClientCredentials,
} from '../../../src/lib/auth/dcr-types';

describe('DCR Types', () => {
  describe('constants', () => {
    it('should define the DCR client name', () => {
      expect(DCR_CLIENT_NAME).toBe('datadog-api-claude-plugin');
    });

    it('should define the DCR redirect URIs', () => {
      expect(DCR_REDIRECT_URIS).toContain('http://127.0.0.1:8000/oauth/callback');
      expect(DCR_REDIRECT_URIS).toContain('http://127.0.0.1:8080/oauth/callback');
      expect(DCR_REDIRECT_URIS.length).toBeGreaterThanOrEqual(4);
    });

    it('should define the DCR grant types', () => {
      expect(DCR_GRANT_TYPES).toEqual(['authorization_code', 'refresh_token']);
    });
  });

  describe('ClientRegistrationRequest type', () => {
    it('should accept valid registration request', () => {
      const request: ClientRegistrationRequest = {
        client_name: 'test-client',
        redirect_uris: ['http://localhost:8080/callback'],
        grant_types: ['authorization_code', 'refresh_token'],
      };

      expect(request.client_name).toBe('test-client');
      expect(request.redirect_uris).toHaveLength(1);
      expect(request.grant_types).toHaveLength(2);
    });
  });

  describe('ClientRegistrationResponse type', () => {
    it('should accept valid registration response', () => {
      const response: ClientRegistrationResponse = {
        client_id: 'abc-123-def',
        client_name: 'test-client',
        redirect_uris: ['http://localhost:8080/callback'],
        token_endpoint_auth_method: 'none',
        grant_types: ['authorization_code', 'refresh_token'],
        scope: 'dashboards_read',
      };

      expect(response.client_id).toBe('abc-123-def');
      expect(response.token_endpoint_auth_method).toBe('none');
      expect(response.scope).toBe('dashboards_read');
    });

    it('should allow response without optional scope', () => {
      const response: ClientRegistrationResponse = {
        client_id: 'abc-123-def',
        client_name: 'test-client',
        redirect_uris: ['http://localhost:8080/callback'],
        token_endpoint_auth_method: 'none',
        grant_types: ['authorization_code'],
      };

      expect(response.scope).toBeUndefined();
    });
  });

  describe('StoredClientCredentials type', () => {
    it('should accept valid stored credentials', () => {
      const credentials: StoredClientCredentials = {
        clientId: 'abc-123-def',
        clientName: 'test-client',
        redirectUris: ['http://localhost:8080/callback'],
        registeredAt: 1704067200,
        site: 'datadoghq.com',
      };

      expect(credentials.clientId).toBe('abc-123-def');
      expect(credentials.site).toBe('datadoghq.com');
      expect(credentials.registeredAt).toBe(1704067200);
    });
  });
});
