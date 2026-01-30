// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024-present Datadog, Inc.

/**
 * Unit tests for OAuth client module
 */

import {
  generateCodeVerifier,
  generateCodeChallenge,
  generatePKCEChallenge,
  generateState,
  getOAuthEndpoints,
  buildAuthorizationUrl,
  isTokenExpired,
} from '../../../src/lib/auth/oauth-client';
import { OAuthTokens, DATADOG_CLI_CLIENT_ID, DEFAULT_OAUTH_SCOPES } from '../../../src/lib/auth/types';

describe('OAuth Client', () => {
  describe('generateCodeVerifier()', () => {
    it('should generate a code verifier of default length', () => {
      const verifier = generateCodeVerifier();
      expect(verifier.length).toBe(64);
    });

    it('should generate a code verifier of specified length', () => {
      const verifier = generateCodeVerifier(43);
      expect(verifier.length).toBe(43);
    });

    it('should throw for length less than 43', () => {
      expect(() => generateCodeVerifier(42)).toThrow('Code verifier length must be between 43 and 128 characters');
    });

    it('should throw for length greater than 128', () => {
      expect(() => generateCodeVerifier(129)).toThrow('Code verifier length must be between 43 and 128 characters');
    });

    it('should generate URL-safe characters only', () => {
      const verifier = generateCodeVerifier();
      // Base64url alphabet: A-Z, a-z, 0-9, -, _
      expect(verifier).toMatch(/^[A-Za-z0-9_-]+$/);
    });

    it('should generate unique verifiers', () => {
      const verifier1 = generateCodeVerifier();
      const verifier2 = generateCodeVerifier();
      expect(verifier1).not.toBe(verifier2);
    });
  });

  describe('generateCodeChallenge()', () => {
    it('should generate a code challenge from verifier', () => {
      const verifier = 'test-verifier-123456789012345678901234567890';
      const challenge = generateCodeChallenge(verifier);

      // Should be base64url encoded
      expect(challenge).toMatch(/^[A-Za-z0-9_-]+$/);
      // Should not have padding
      expect(challenge).not.toContain('=');
    });

    it('should produce consistent results for same input', () => {
      const verifier = 'consistent-verifier-12345678901234567890123';
      const challenge1 = generateCodeChallenge(verifier);
      const challenge2 = generateCodeChallenge(verifier);
      expect(challenge1).toBe(challenge2);
    });

    it('should produce different results for different inputs', () => {
      const verifier1 = 'verifier-one-123456789012345678901234567890';
      const verifier2 = 'verifier-two-123456789012345678901234567890';
      const challenge1 = generateCodeChallenge(verifier1);
      const challenge2 = generateCodeChallenge(verifier2);
      expect(challenge1).not.toBe(challenge2);
    });
  });

  describe('generatePKCEChallenge()', () => {
    it('should generate a complete PKCE challenge', () => {
      const pkce = generatePKCEChallenge();

      expect(pkce.codeVerifier).toBeDefined();
      expect(pkce.codeVerifier.length).toBe(64);
      expect(pkce.codeChallenge).toBeDefined();
      expect(pkce.codeChallengeMethod).toBe('S256');
    });

    it('should generate challenge that matches verifier', () => {
      const pkce = generatePKCEChallenge();
      const expectedChallenge = generateCodeChallenge(pkce.codeVerifier);
      expect(pkce.codeChallenge).toBe(expectedChallenge);
    });
  });

  describe('generateState()', () => {
    it('should generate a state string', () => {
      const state = generateState();
      expect(state).toBeDefined();
      expect(typeof state).toBe('string');
      expect(state.length).toBe(64); // 32 bytes = 64 hex chars
    });

    it('should generate unique states', () => {
      const state1 = generateState();
      const state2 = generateState();
      expect(state1).not.toBe(state2);
    });

    it('should generate hex characters only', () => {
      const state = generateState();
      expect(state).toMatch(/^[0-9a-f]+$/);
    });
  });

  describe('getOAuthEndpoints()', () => {
    it('should return correct endpoints for US1 site', () => {
      const endpoints = getOAuthEndpoints('datadoghq.com');

      expect(endpoints.authorizeUrl).toBe('https://app.datadoghq.com/oauth2/v1/authorize');
      expect(endpoints.tokenUrl).toBe('https://api.datadoghq.com/oauth2/v1/token');
      expect(endpoints.revokeUrl).toBe('https://api.datadoghq.com/oauth2/v1/revoke');
    });

    it('should return correct endpoints for EU1 site', () => {
      const endpoints = getOAuthEndpoints('datadoghq.eu');

      expect(endpoints.authorizeUrl).toBe('https://app.datadoghq.eu/oauth2/v1/authorize');
      expect(endpoints.tokenUrl).toBe('https://api.datadoghq.eu/oauth2/v1/token');
      expect(endpoints.revokeUrl).toBe('https://api.datadoghq.eu/oauth2/v1/revoke');
    });

    it('should return correct endpoints for US3 site', () => {
      const endpoints = getOAuthEndpoints('us3.datadoghq.com');

      expect(endpoints.authorizeUrl).toBe('https://app.us3.datadoghq.com/oauth2/v1/authorize');
      expect(endpoints.tokenUrl).toBe('https://api.us3.datadoghq.com/oauth2/v1/token');
      expect(endpoints.revokeUrl).toBe('https://api.us3.datadoghq.com/oauth2/v1/revoke');
    });
  });

  describe('buildAuthorizationUrl()', () => {
    const pkce = {
      codeVerifier: 'test-verifier',
      codeChallenge: 'test-challenge',
      codeChallengeMethod: 'S256' as const,
    };
    const state = 'test-state-123';
    const redirectUri = 'http://127.0.0.1:8080/oauth/callback';

    it('should build a valid authorization URL', () => {
      const config = {
        site: 'datadoghq.com',
        clientId: 'test-client-id',
        scopes: ['dashboards_read', 'monitors_read'],
      };

      const url = buildAuthorizationUrl(config, pkce, state, redirectUri);
      const parsedUrl = new URL(url);

      expect(parsedUrl.origin).toBe('https://app.datadoghq.com');
      expect(parsedUrl.pathname).toBe('/oauth2/v1/authorize');
      expect(parsedUrl.searchParams.get('response_type')).toBe('code');
      expect(parsedUrl.searchParams.get('client_id')).toBe('test-client-id');
      expect(parsedUrl.searchParams.get('redirect_uri')).toBe(redirectUri);
      expect(parsedUrl.searchParams.get('scope')).toBe('dashboards_read monitors_read');
      expect(parsedUrl.searchParams.get('state')).toBe(state);
      expect(parsedUrl.searchParams.get('code_challenge')).toBe('test-challenge');
      expect(parsedUrl.searchParams.get('code_challenge_method')).toBe('S256');
    });

    it('should use default client ID when not specified', () => {
      const config = {
        site: 'datadoghq.com',
        clientId: '',
        scopes: [],
      };

      const url = buildAuthorizationUrl(config, pkce, state, redirectUri);
      const parsedUrl = new URL(url);

      expect(parsedUrl.searchParams.get('client_id')).toBe(DATADOG_CLI_CLIENT_ID);
    });

    it('should use default scopes when empty', () => {
      const config = {
        site: 'datadoghq.com',
        clientId: 'test-client',
        scopes: [],
      };

      const url = buildAuthorizationUrl(config, pkce, state, redirectUri);
      const parsedUrl = new URL(url);

      const scopeParam = parsedUrl.searchParams.get('scope');
      expect(scopeParam).toBe(DEFAULT_OAUTH_SCOPES.join(' '));
    });
  });

  describe('isTokenExpired()', () => {
    const createTokens = (issuedSecondsAgo: number, expiresIn: number): OAuthTokens => ({
      accessToken: 'test-token',
      refreshToken: 'test-refresh',
      tokenType: 'Bearer',
      expiresIn,
      issuedAt: Math.floor(Date.now() / 1000) - issuedSecondsAgo,
    });

    it('should return false for non-expired token', () => {
      const tokens = createTokens(0, 3600); // Issued now, expires in 1 hour
      expect(isTokenExpired(tokens)).toBe(false);
    });

    it('should return true for expired token', () => {
      const tokens = createTokens(3700, 3600); // Issued 3700s ago, expired after 3600s
      expect(isTokenExpired(tokens)).toBe(true);
    });

    it('should return true when token expires within buffer', () => {
      const tokens = createTokens(3400, 3600); // Issued 3400s ago, expires in 200s
      expect(isTokenExpired(tokens, 300)).toBe(true); // Buffer is 300s
    });

    it('should return false when token expires after buffer', () => {
      const tokens = createTokens(3000, 3600); // Issued 3000s ago, expires in 600s
      expect(isTokenExpired(tokens, 300)).toBe(false); // Buffer is 300s
    });

    it('should use default buffer of 300 seconds', () => {
      const tokens = createTokens(3350, 3600); // Expires in 250s
      expect(isTokenExpired(tokens)).toBe(true); // Default buffer 300s
    });
  });
});
