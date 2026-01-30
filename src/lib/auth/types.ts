// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024-present Datadog, Inc.

/**
 * OAuth2 Authentication Types for Datadog API
 */

/**
 * PKCE (Proof Key for Code Exchange) challenge data
 */
export interface PKCEChallenge {
  /** The random code verifier (43-128 characters, URL-safe) */
  codeVerifier: string;
  /** The SHA-256 hash of codeVerifier, base64url encoded */
  codeChallenge: string;
  /** The challenge method, always 'S256' */
  codeChallengeMethod: 'S256';
}

/**
 * OAuth2 tokens returned from token endpoint
 */
export interface OAuthTokens {
  /** The access token for API authentication */
  accessToken: string;
  /** The refresh token for obtaining new access tokens */
  refreshToken: string;
  /** Token type, typically 'Bearer' */
  tokenType: string;
  /** Access token expiration time in seconds */
  expiresIn: number;
  /** Timestamp when the access token was issued (Unix timestamp in seconds) */
  issuedAt: number;
  /** Granted scopes (space-separated string) */
  scope?: string;
}

/**
 * Raw token response from Datadog OAuth2 token endpoint
 */
export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  scope?: string;
}

/**
 * Authentication state during OAuth flow
 */
export interface AuthState {
  /** Random state parameter for CSRF protection */
  state: string;
  /** PKCE challenge data */
  pkce: PKCEChallenge;
  /** The redirect URI used for this auth flow */
  redirectUri: string;
  /** Timestamp when the auth flow started */
  startedAt: number;
}

/**
 * Stored token data (persisted to disk)
 * Keyed by Datadog site (e.g., 'datadoghq.com')
 */
export interface StoredTokens {
  [site: string]: OAuthTokens;
}

/**
 * OAuth configuration
 */
export interface OAuthConfig {
  /** Datadog site (e.g., 'datadoghq.com') */
  site: string;
  /** OAuth2 client ID */
  clientId: string;
  /** Requested OAuth scopes */
  scopes: string[];
  /** Timeout for the OAuth flow in milliseconds */
  timeoutMs?: number;
}

/**
 * Result of an OAuth login attempt
 */
export interface LoginResult {
  /** Whether login was successful */
  success: boolean;
  /** Error message if login failed */
  error?: string;
  /** The obtained tokens if successful */
  tokens?: OAuthTokens;
}

/**
 * OAuth endpoints for a Datadog site
 */
export interface OAuthEndpoints {
  /** Authorization endpoint URL */
  authorizeUrl: string;
  /** Token endpoint URL */
  tokenUrl: string;
  /** Token revocation endpoint URL */
  revokeUrl: string;
}

/**
 * Default OAuth scopes to request
 * These match the capabilities of a full API key + Application key
 */
export const DEFAULT_OAUTH_SCOPES = [
  'dashboards_read',
  'dashboards_write',
  // 'events_read',
  // 'hosts_read',
  // 'incidents_read',
  // 'incidents_write',
  // 'logs_read',
  // 'metrics_read',
  // 'monitors_read',
  // 'monitors_write',
  // 'security_signals_read',
  // 'service_catalog_read',
  // 'service_catalog_write',
  // 'slos_read',
  // 'slos_write',
  // 'synthetics_read',
  // 'synthetics_write',
  // 'timeseries_query',
  // 'usage_read',
  // 'user_access_read',
] as const;

/**
 * OAuth client ID placeholder
 * Replace with actual Datadog CLI client ID when available
 */
export const DATADOG_CLI_CLIENT_ID = '90f37300-eaf8-4e0a-abb9-db3d85a38593';

/**
 * Default timeout for OAuth flow (5 minutes)
 */
export const DEFAULT_OAUTH_TIMEOUT_MS = 5 * 60 * 1000;

/**
 * Token refresh buffer - refresh token when it expires within this time
 * Default: 5 minutes before expiration
 */
export const TOKEN_REFRESH_BUFFER_SECONDS = 5 * 60;
