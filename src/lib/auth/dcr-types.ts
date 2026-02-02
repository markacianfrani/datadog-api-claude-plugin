// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024-present Datadog, Inc.

/**
 * Dynamic Client Registration (RFC 7591) Types for Datadog OAuth2
 *
 * DCR allows each CLI installation to register as a unique OAuth client,
 * providing better security through:
 * - Per-installation audit trail
 * - Granular revocation capability
 * - No shared client credentials across installations
 */

/**
 * Grant types supported by the CLI
 */
export type GrantType = 'authorization_code' | 'refresh_token';

/**
 * Token endpoint authentication method
 * For public clients (CLI), this is 'none'
 */
export type TokenEndpointAuthMethod = 'none' | 'client_secret_basic' | 'client_secret_post';

/**
 * DCR Registration Request (RFC 7591 Section 2)
 * Sent to POST /api/v2/oauth2/register
 */
export interface ClientRegistrationRequest {
  /**
   * Human-readable name of the client
   * Example: "datadog-api-claude-plugin"
   */
  client_name: string;

  /**
   * Array of redirect URIs for the OAuth flow
   * Supports dynamic URI patterns for localhost ports:
   * Example: ["urn:dd-dcr:v1:http://127.0.0.1:{validweb:8000-9000}/oauth/callback"]
   */
  redirect_uris: string[];

  /**
   * Grant types the client will use
   * CLI uses: ["authorization_code", "refresh_token"]
   */
  grant_types: GrantType[];
}

/**
 * DCR Registration Response (RFC 7591 Section 3.2.1)
 * Returned from successful POST /api/v2/oauth2/register
 */
export interface ClientRegistrationResponse {
  /**
   * Unique client identifier assigned by Datadog
   * This replaces the hardcoded DATADOG_CLI_CLIENT_ID
   */
  client_id: string;

  /**
   * Human-readable name of the client (echoed back)
   */
  client_name: string;

  /**
   * Registered redirect URIs (echoed back)
   */
  redirect_uris: string[];

  /**
   * Authentication method for token endpoint
   * For public clients: 'none'
   */
  token_endpoint_auth_method: TokenEndpointAuthMethod;

  /**
   * Granted grant types (echoed back)
   */
  grant_types: string[];

  /**
   * Default scope for the client (optional)
   */
  scope?: string;
}

/**
 * DCR Error Response (RFC 7591 Section 3.2.2)
 */
export interface ClientRegistrationError {
  /**
   * Error code
   * Common values: "invalid_redirect_uri", "invalid_client_metadata"
   */
  error: string;

  /**
   * Human-readable error description
   */
  error_description?: string;
}

/**
 * Stored client credentials for a Datadog site
 * Persisted in OS keychain or file storage
 */
export interface StoredClientCredentials {
  /**
   * The client_id from DCR registration
   */
  clientId: string;

  /**
   * The client name used during registration
   */
  clientName: string;

  /**
   * The redirect URIs registered for this client
   */
  redirectUris: string[];

  /**
   * Unix timestamp when the client was registered
   */
  registeredAt: number;

  /**
   * The Datadog site this client is registered with
   */
  site: string;
}

/**
 * Storage interface for client credentials
 */
export interface IClientCredentialsStorage {
  /**
   * Save client credentials for a site
   * @param site The Datadog site
   * @param credentials The client credentials to save
   */
  saveCredentials(site: string, credentials: StoredClientCredentials): void;

  /**
   * Get client credentials for a site
   * @param site The Datadog site
   * @returns The stored credentials, or null if none exist
   */
  getCredentials(site: string): StoredClientCredentials | null;

  /**
   * Delete client credentials for a site
   * @param site The Datadog site
   * @returns Whether credentials were deleted
   */
  deleteCredentials(site: string): boolean;

  /**
   * Delete all stored client credentials
   */
  deleteAllCredentials(): void;

  /**
   * Get all sites with stored client credentials
   * @returns Array of site names
   */
  listSites(): string[];

  /**
   * Get storage location description
   * @returns Human-readable description of where credentials are stored
   */
  getStorageLocation(): string;

  /**
   * Get the storage backend type
   * @returns 'keychain' or 'file'
   */
  getBackendType(): 'keychain' | 'file';
}

/**
 * Default client name for DCR registration
 */
export const DCR_CLIENT_NAME = 'datadog-api-claude-plugin';

/**
 * Redirect URIs for localhost callback server
 * Only 127.0.0.1 is allowed (not localhost)
 * Registers specific ports in the callback server range (8000-9000)
 */
export const DCR_REDIRECT_URIS = [
  'http://127.0.0.1:8000/oauth/callback',
  'http://127.0.0.1:8080/oauth/callback',
  'http://127.0.0.1:8888/oauth/callback',
  'http://127.0.0.1:9000/oauth/callback',
];

/**
 * Default grant types for CLI registration
 */
export const DCR_GRANT_TYPES: GrantType[] = ['authorization_code', 'refresh_token'];
