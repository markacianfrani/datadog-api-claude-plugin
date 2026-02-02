// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024-present Datadog, Inc.

/**
 * OAuth2 PKCE Client for Datadog API authentication
 */

import * as crypto from 'crypto';
import * as https from 'https';
import * as http from 'http';
import {
  PKCEChallenge,
  OAuthTokens,
  TokenResponse,
  OAuthEndpoints,
  OAuthConfig,
  DEFAULT_OAUTH_SCOPES,
} from './types';

/**
 * Generate a cryptographically secure PKCE code verifier
 * @param length The length of the verifier (43-128 characters, default 64)
 * @returns A URL-safe random string
 */
export function generateCodeVerifier(length: number = 64): string {
  if (length < 43 || length > 128) {
    throw new Error('Code verifier length must be between 43 and 128 characters');
  }

  // Generate random bytes and encode as base64url
  const buffer = crypto.randomBytes(Math.ceil(length * 0.75));
  return buffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
    .slice(0, length);
}

/**
 * Generate a PKCE code challenge from a code verifier
 * @param codeVerifier The code verifier to hash
 * @returns The SHA-256 hash encoded as base64url
 */
export function generateCodeChallenge(codeVerifier: string): string {
  const hash = crypto.createHash('sha256').update(codeVerifier).digest();
  return hash.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

/**
 * Generate a complete PKCE challenge
 * @returns PKCE challenge with code verifier and code challenge
 */
export function generatePKCEChallenge(): PKCEChallenge {
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);

  return {
    codeVerifier,
    codeChallenge,
    codeChallengeMethod: 'S256',
  };
}

/**
 * Generate a cryptographically secure state parameter
 * @returns A random state string for CSRF protection
 */
export function generateState(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Get OAuth endpoints for a Datadog site
 * @param site The Datadog site (e.g., 'datadoghq.com')
 * @returns OAuth endpoint URLs
 */
export function getOAuthEndpoints(site: string): OAuthEndpoints {
  // For the authorization endpoint, we use app.{site}
  // For the token endpoint, we use api.{site}
  const appBase = `https://app.${site}`;
  const apiBase = `https://api.${site}`;

  return {
    authorizeUrl: `${appBase}/oauth2/v1/authorize`,
    tokenUrl: `${apiBase}/oauth2/v1/token`,
    revokeUrl: `${apiBase}/oauth2/v1/revoke`,
  };
}

/**
 * Build the OAuth2 authorization URL
 * @param config OAuth configuration
 * @param pkce PKCE challenge
 * @param state State parameter for CSRF protection
 * @param redirectUri The callback URI
 * @returns The complete authorization URL
 */
export function buildAuthorizationUrl(
  config: OAuthConfig,
  pkce: PKCEChallenge,
  state: string,
  redirectUri: string
): string {
  if (!config.clientId) {
    throw new Error('clientId is required in OAuthConfig');
  }

  const endpoints = getOAuthEndpoints(config.site);
  const scopes = config.scopes.length > 0 ? config.scopes : [...DEFAULT_OAUTH_SCOPES];

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: config.clientId,
    redirect_uri: redirectUri,
    scope: scopes.join(' '),
    state: state,
    code_challenge: pkce.codeChallenge,
    code_challenge_method: pkce.codeChallengeMethod,
  });

  return `${endpoints.authorizeUrl}?${params.toString()}`;
}

/**
 * Exchange an authorization code for tokens
 * @param site The Datadog site
 * @param code The authorization code
 * @param codeVerifier The PKCE code verifier
 * @param redirectUri The redirect URI used in the authorization request
 * @param clientId The OAuth client ID
 * @returns The OAuth tokens
 */
export async function exchangeCodeForTokens(
  site: string,
  code: string,
  codeVerifier: string,
  redirectUri: string,
  clientId: string
): Promise<OAuthTokens> {
  const endpoints = getOAuthEndpoints(site);

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: clientId,
    code: code,
    redirect_uri: redirectUri,
    code_verifier: codeVerifier,
  });

  const response = await makeTokenRequest(endpoints.tokenUrl, body.toString());
  return parseTokenResponse(response);
}

/**
 * Refresh an access token using a refresh token
 * @param site The Datadog site
 * @param refreshToken The refresh token
 * @param clientId The OAuth client ID
 * @returns New OAuth tokens
 */
export async function refreshAccessToken(
  site: string,
  refreshToken: string,
  clientId: string
): Promise<OAuthTokens> {
  const endpoints = getOAuthEndpoints(site);

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: clientId,
    refresh_token: refreshToken,
  });

  const response = await makeTokenRequest(endpoints.tokenUrl, body.toString());
  return parseTokenResponse(response);
}

/**
 * Revoke an OAuth token
 * @param site The Datadog site
 * @param token The token to revoke
 * @param tokenTypeHint Optional hint about the token type ('access_token' or 'refresh_token')
 * @param clientId The OAuth client ID
 * @returns Whether revocation was successful
 */
export async function revokeToken(
  site: string,
  token: string,
  tokenTypeHint?: 'access_token' | 'refresh_token',
  clientId?: string
): Promise<boolean> {
  const endpoints = getOAuthEndpoints(site);

  const bodyParams: Record<string, string> = {
    token: token,
  };

  if (clientId) {
    bodyParams.client_id = clientId;
  }

  if (tokenTypeHint) {
    bodyParams.token_type_hint = tokenTypeHint;
  }

  const body = new URLSearchParams(bodyParams);

  try {
    await makeTokenRequest(endpoints.revokeUrl, body.toString());
    return true;
  } catch {
    // Revocation endpoints may return errors but token is often revoked anyway
    return false;
  }
}

/**
 * Make an HTTP POST request to a token endpoint
 * @param url The endpoint URL
 * @param body The URL-encoded body
 * @returns The parsed JSON response
 */
async function makeTokenRequest(url: string, body: string): Promise<TokenResponse> {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const isHttps = urlObj.protocol === 'https:';
    const httpModule = isHttps ? https : http;

    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(body),
        Accept: 'application/json',
      },
    };

    const req = httpModule.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);

          if (res.statusCode && res.statusCode >= 400) {
            const error = new Error(
              parsed.error_description || parsed.error || `HTTP ${res.statusCode}`
            );
            (error as any).statusCode = res.statusCode;
            (error as any).response = parsed;
            reject(error);
            return;
          }

          resolve(parsed as TokenResponse);
        } catch (e) {
          reject(new Error(`Failed to parse token response: ${data}`));
        }
      });
    });

    req.on('error', (e) => {
      reject(new Error(`Token request failed: ${e.message}`));
    });

    req.write(body);
    req.end();
  });
}

/**
 * Parse a token response into OAuthTokens
 * @param response The raw token response
 * @returns Parsed OAuth tokens
 */
function parseTokenResponse(response: TokenResponse): OAuthTokens {
  return {
    accessToken: response.access_token,
    refreshToken: response.refresh_token,
    tokenType: response.token_type,
    expiresIn: response.expires_in,
    issuedAt: Math.floor(Date.now() / 1000),
    scope: response.scope,
  };
}

/**
 * Check if an access token is expired or will expire soon
 * @param tokens The OAuth tokens
 * @param bufferSeconds Number of seconds before expiration to consider expired (default: 300 = 5 min)
 * @returns Whether the token is expired or will expire within the buffer
 */
export function isTokenExpired(tokens: OAuthTokens, bufferSeconds: number = 300): boolean {
  const expiresAt = tokens.issuedAt + tokens.expiresIn;
  const now = Math.floor(Date.now() / 1000);
  return now >= expiresAt - bufferSeconds;
}
