// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024-present Datadog, Inc.

/**
 * Dynamic Client Registration (DCR) Client for Datadog OAuth2
 *
 * Implements RFC 7591 Dynamic Client Registration to register
 * unique OAuth clients per CLI installation.
 */

import * as https from 'https';
import * as http from 'http';
import {
  ClientRegistrationRequest,
  ClientRegistrationResponse,
  ClientRegistrationError,
  StoredClientCredentials,
  DCR_CLIENT_NAME,
  DCR_REDIRECT_URIS,
  DCR_GRANT_TYPES,
} from './dcr-types';
import { getClientCredentialsStorage } from './client-credentials-storage';

/**
 * Error thrown when DCR registration fails
 */
export class DCRError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly errorCode?: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'DCRError';
  }
}

/**
 * Error thrown when DCR endpoint is not available
 */
export class DCRNotAvailableError extends DCRError {
  constructor(site: string) {
    super(
      `Dynamic Client Registration is not available for site "${site}". ` +
        'OAuth authentication requires a Datadog site with DCR support. ' +
        'Please check that your site supports OAuth2 DCR or contact Datadog support.',
      404,
      'dcr_not_available'
    );
    this.name = 'DCRNotAvailableError';
  }
}

/**
 * Get the DCR endpoint URL for a Datadog site
 * @param site The Datadog site (e.g., 'datadoghq.com')
 * @returns The DCR endpoint URL
 */
export function getDCREndpoint(site: string): string {
  return `https://api.${site}/api/v2/oauth2/register`;
}

/**
 * Register a new OAuth client with Datadog DCR
 *
 * @param site The Datadog site
 * @param clientName The human-readable client name
 * @param redirectUris The redirect URIs for the OAuth flow
 * @returns The registration response with client_id
 * @throws {DCRError} If registration fails
 * @throws {DCRNotAvailableError} If DCR endpoint returns 404
 */
export async function registerClient(
  site: string,
  clientName: string = DCR_CLIENT_NAME,
  redirectUris: string[] = DCR_REDIRECT_URIS
): Promise<ClientRegistrationResponse> {
  const endpoint = getDCREndpoint(site);

  const request: ClientRegistrationRequest = {
    client_name: clientName,
    redirect_uris: redirectUris,
    grant_types: DCR_GRANT_TYPES,
  };

  const body = JSON.stringify(request);

  return new Promise((resolve, reject) => {
    const urlObj = new URL(endpoint);
    const isHttps = urlObj.protocol === 'https:';
    const httpModule = isHttps ? https : http;

    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
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
        // Handle empty response
        if (!data || data.trim() === '') {
          reject(
            new DCRError(
              `DCR endpoint returned empty response (HTTP ${res.statusCode}). ` +
                `Endpoint: ${endpoint}. ` +
                'The DCR endpoint may not be available for this site.',
              res.statusCode,
              'empty_response'
            )
          );
          return;
        }

        // Handle non-JSON responses (like HTML error pages)
        const contentType = res.headers['content-type'] || '';
        if (!contentType.includes('application/json')) {
          reject(
            new DCRError(
              `DCR endpoint returned non-JSON response (HTTP ${res.statusCode}, ` +
                `Content-Type: ${contentType}). Response: ${data.substring(0, 200)}...`,
              res.statusCode,
              'invalid_content_type'
            )
          );
          return;
        }

        try {
          const parsed = JSON.parse(data);

          if (res.statusCode === 404) {
            reject(new DCRNotAvailableError(site));
            return;
          }

          if (res.statusCode && res.statusCode >= 400) {
            const errorResponse = parsed as ClientRegistrationError;
            reject(
              new DCRError(
                errorResponse.error_description ||
                  errorResponse.error ||
                  `DCR registration failed with HTTP ${res.statusCode}`,
                res.statusCode,
                errorResponse.error
              )
            );
            return;
          }

          resolve(parsed as ClientRegistrationResponse);
        } catch (e) {
          reject(
            new DCRError(
              `Failed to parse DCR response (HTTP ${res.statusCode}): ${data.substring(0, 500)}`,
              res.statusCode
            )
          );
        }
      });
    });

    req.on('error', (e) => {
      reject(
        new DCRError(
          `DCR request failed: ${e.message}. Please check your network connection and try again.`,
          undefined,
          'network_error',
          e
        )
      );
    });

    req.write(body);
    req.end();
  });
}

/**
 * Get an existing client ID or register a new one
 *
 * Checks for stored client credentials first. If none exist,
 * registers a new client via DCR and stores the credentials.
 *
 * @param site The Datadog site
 * @param clientName Optional custom client name
 * @returns The stored or newly registered client credentials
 * @throws {DCRError} If registration fails
 * @throws {DCRNotAvailableError} If DCR endpoint is not available
 */
export async function getOrRegisterClient(
  site: string,
  clientName: string = DCR_CLIENT_NAME
): Promise<StoredClientCredentials> {
  const storage = getClientCredentialsStorage();

  // Check for existing credentials
  const existingCredentials = storage.getCredentials(site);
  if (existingCredentials) {
    return existingCredentials;
  }

  // No existing credentials, register a new client
  console.log('Registering new OAuth client...');

  const redirectUris = DCR_REDIRECT_URIS;
  let response: ClientRegistrationResponse;

  try {
    response = await registerClient(site, clientName, redirectUris);
  } catch (error) {
    if (error instanceof DCRNotAvailableError) {
      throw error;
    }
    if (error instanceof DCRError) {
      // Retry once for transient errors
      if (error.statusCode && error.statusCode >= 500) {
        console.log('Server error, retrying DCR registration...');
        try {
          response = await registerClient(site, clientName, redirectUris);
        } catch (retryError) {
          throw retryError;
        }
      } else {
        throw error;
      }
    } else {
      throw error;
    }
  }

  // Store the credentials
  const credentials: StoredClientCredentials = {
    clientId: response.client_id,
    clientName: response.client_name,
    redirectUris: response.redirect_uris,
    registeredAt: Math.floor(Date.now() / 1000),
    site,
  };

  storage.saveCredentials(site, credentials);
  console.log('OAuth client registered successfully.');

  return credentials;
}

/**
 * Delete stored client credentials for a site
 *
 * Note: This only deletes local credentials. The client registration
 * on Datadog's side is not affected.
 *
 * @param site The Datadog site
 * @returns Whether credentials were deleted
 */
export function deleteClientCredentials(site: string): boolean {
  const storage = getClientCredentialsStorage();
  return storage.deleteCredentials(site);
}

/**
 * Get stored client credentials for a site (without registering)
 *
 * @param site The Datadog site
 * @returns The stored credentials, or null if none exist
 */
export function getStoredClientCredentials(site: string): StoredClientCredentials | null {
  const storage = getClientCredentialsStorage();
  return storage.getCredentials(site);
}

/**
 * Check if client credentials exist for a site
 *
 * @param site The Datadog site
 * @returns Whether credentials exist
 */
export function hasClientCredentials(site: string): boolean {
  const storage = getClientCredentialsStorage();
  return storage.getCredentials(site) !== null;
}
