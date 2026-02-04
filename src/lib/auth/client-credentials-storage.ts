// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024-present Datadog, Inc.

/**
 * Client Credentials Storage for DCR-registered OAuth clients
 *
 * Stores DCR client credentials (client_id, etc.) separately from OAuth tokens.
 * Supports both OS keychain (primary) and file-based (fallback) storage.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { Entry } from '@napi-rs/keyring';
import { StoredClientCredentials, IClientCredentialsStorage } from './dcr-types';

/**
 * Keychain service name for DCR client credentials
 */
const DCR_KEYCHAIN_SERVICE = 'datadog-cli-dcr';

/**
 * Prefix for account names in keychain
 */
const ACCOUNT_PREFIX = 'client:';

/**
 * Default file path for client credentials storage
 */
const DEFAULT_CREDENTIALS_FILE = path.join(os.homedir(), '.datadog', 'oauth_clients.json');

/**
 * Known Datadog sites for iteration
 */
const KNOWN_SITES = [
  'datadoghq.com',
  'us3.datadoghq.com',
  'us5.datadoghq.com',
  'datadoghq.eu',
  'ap1.datadoghq.com',
  'ddog-gov.com',
  'datad0g.com', // staging
];

/**
 * Error thrown when client credential operations fail
 */
export class ClientCredentialsError extends Error {
  constructor(
    message: string,
    public readonly operation: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'ClientCredentialsError';
  }
}

/**
 * Keychain-based client credentials storage (primary)
 *
 * Stores credentials in OS keychain with:
 * - Service: "datadog-cli-dcr"
 * - Account: "client:{site}"
 */
export class KeychainClientStorage implements IClientCredentialsStorage {
  private service: string;

  constructor(service: string = DCR_KEYCHAIN_SERVICE) {
    this.service = service;
  }

  getBackendType(): 'keychain' | 'file' {
    return 'keychain';
  }

  getStorageLocation(): string {
    switch (process.platform) {
      case 'darwin':
        return 'macOS Keychain (datadog-cli-dcr)';
      case 'win32':
        return 'Windows Credential Manager (datadog-cli-dcr)';
      default:
        return 'System Keychain/Secret Service (datadog-cli-dcr)';
    }
  }

  private getAccountName(site: string): string {
    return `${ACCOUNT_PREFIX}${site}`;
  }

  private getEntry(site: string): Entry {
    return new Entry(this.service, this.getAccountName(site));
  }

  saveCredentials(site: string, credentials: StoredClientCredentials): void {
    try {
      const entry = this.getEntry(site);
      const serialized = JSON.stringify(credentials);
      entry.setPassword(serialized);
    } catch (error: any) {
      throw new ClientCredentialsError(
        `Failed to save client credentials for site "${site}": ${error.message}`,
        'save',
        error
      );
    }
  }

  getCredentials(site: string): StoredClientCredentials | null {
    try {
      const entry = this.getEntry(site);
      const password = entry.getPassword();

      if (!password) {
        return null;
      }

      return JSON.parse(password) as StoredClientCredentials;
    } catch (error: any) {
      // Entry not found or invalid JSON - return null
      if (error.message?.includes('No password found') || error instanceof SyntaxError) {
        return null;
      }
      throw new ClientCredentialsError(
        `Failed to get client credentials for site "${site}": ${error.message}`,
        'get',
        error
      );
    }
  }

  deleteCredentials(site: string): boolean {
    try {
      const entry = this.getEntry(site);
      const existing = entry.getPassword();
      if (!existing) {
        return false;
      }
      entry.deletePassword();
      return true;
    } catch (error: any) {
      if (error.message?.includes('No password found')) {
        return false;
      }
      throw new ClientCredentialsError(
        `Failed to delete client credentials for site "${site}": ${error.message}`,
        'delete',
        error
      );
    }
  }

  deleteAllCredentials(): void {
    for (const site of KNOWN_SITES) {
      try {
        this.deleteCredentials(site);
      } catch {
        // Ignore errors when deleting individual sites
      }
    }
  }

  listSites(): string[] {
    const sitesWithCredentials: string[] = [];

    for (const site of KNOWN_SITES) {
      try {
        const credentials = this.getCredentials(site);
        if (credentials) {
          sitesWithCredentials.push(site);
        }
      } catch {
        // Ignore errors when listing sites
      }
    }

    return sitesWithCredentials;
  }

  /**
   * Check if keychain is available on this system
   */
  static isAvailable(): boolean {
    try {
      const testEntry = new Entry('datadog-cli-dcr-test', 'availability-check');
      testEntry.getPassword();
      return true;
    } catch (error: any) {
      const message = error.message?.toLowerCase() || '';
      if (
        message.includes('no password found') ||
        message.includes('not found') ||
        message.includes('item not found')
      ) {
        return true;
      }
      return false;
    }
  }
}

/**
 * Stored credentials file structure
 */
interface StoredCredentialsFile {
  [site: string]: StoredClientCredentials;
}

/**
 * File-based client credentials storage (fallback)
 *
 * Stores credentials in ~/.datadog/oauth_clients.json with 0600 permissions
 */
export class FileClientStorage implements IClientCredentialsStorage {
  private filePath: string;

  constructor(filePath: string = DEFAULT_CREDENTIALS_FILE) {
    this.filePath = filePath;
  }

  getBackendType(): 'keychain' | 'file' {
    return 'file';
  }

  getStorageLocation(): string {
    return this.filePath;
  }

  private ensureDirectory(): void {
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    }
  }

  private readFile(): StoredCredentialsFile {
    try {
      if (!fs.existsSync(this.filePath)) {
        return {};
      }
      const content = fs.readFileSync(this.filePath, 'utf-8');
      return JSON.parse(content) as StoredCredentialsFile;
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return {};
      }
      throw new ClientCredentialsError(
        `Failed to read client credentials file: ${error.message}`,
        'read',
        error
      );
    }
  }

  private writeFile(data: StoredCredentialsFile): void {
    this.ensureDirectory();
    const content = JSON.stringify(data, null, 2);
    fs.writeFileSync(this.filePath, content, { mode: 0o600 });
  }

  saveCredentials(site: string, credentials: StoredClientCredentials): void {
    try {
      const data = this.readFile();
      data[site] = credentials;
      this.writeFile(data);
    } catch (error: any) {
      if (error instanceof ClientCredentialsError) {
        throw error;
      }
      throw new ClientCredentialsError(
        `Failed to save client credentials for site "${site}": ${error.message}`,
        'save',
        error
      );
    }
  }

  getCredentials(site: string): StoredClientCredentials | null {
    try {
      const data = this.readFile();
      return data[site] || null;
    } catch (error: any) {
      if (error instanceof ClientCredentialsError) {
        throw error;
      }
      throw new ClientCredentialsError(
        `Failed to get client credentials for site "${site}": ${error.message}`,
        'get',
        error
      );
    }
  }

  deleteCredentials(site: string): boolean {
    try {
      const data = this.readFile();
      if (!data[site]) {
        return false;
      }
      delete data[site];
      this.writeFile(data);
      return true;
    } catch (error: any) {
      if (error instanceof ClientCredentialsError) {
        throw error;
      }
      throw new ClientCredentialsError(
        `Failed to delete client credentials for site "${site}": ${error.message}`,
        'delete',
        error
      );
    }
  }

  deleteAllCredentials(): void {
    try {
      if (fs.existsSync(this.filePath)) {
        fs.unlinkSync(this.filePath);
      }
    } catch (error: any) {
      throw new ClientCredentialsError(
        `Failed to delete all client credentials: ${error.message}`,
        'deleteAll',
        error
      );
    }
  }

  listSites(): string[] {
    try {
      const data = this.readFile();
      return Object.keys(data);
    } catch {
      return [];
    }
  }
}

/**
 * Global client credentials storage instance
 */
let globalClientStorage: IClientCredentialsStorage | null = null;

/**
 * Get the client credentials storage instance
 *
 * Auto-selects keychain if available, falls back to file storage.
 * Can be overridden via DD_CLIENT_STORAGE environment variable.
 *
 * @returns The client credentials storage instance
 */
export function getClientCredentialsStorage(): IClientCredentialsStorage {
  if (globalClientStorage) {
    return globalClientStorage;
  }

  // Check for explicit storage preference
  const storagePreference = process.env.DD_CLIENT_STORAGE?.toLowerCase();

  if (storagePreference === 'file') {
    globalClientStorage = new FileClientStorage();
    return globalClientStorage;
  }

  if (storagePreference === 'keychain') {
    if (!KeychainClientStorage.isAvailable()) {
      console.warn('DD_CLIENT_STORAGE=keychain but keychain is unavailable, using file storage');
      globalClientStorage = new FileClientStorage();
    } else {
      globalClientStorage = new KeychainClientStorage();
    }
    return globalClientStorage;
  }

  // Auto-detect: prefer keychain, fall back to file
  if (KeychainClientStorage.isAvailable()) {
    globalClientStorage = new KeychainClientStorage();
  } else {
    globalClientStorage = new FileClientStorage();
  }

  return globalClientStorage;
}

/**
 * Reset the global client credentials storage (for testing)
 */
export function resetClientCredentialsStorage(): void {
  globalClientStorage = null;
}

/**
 * Check if using secure keychain storage for client credentials
 */
export function isUsingSecureClientStorage(): boolean {
  const storage = getClientCredentialsStorage();
  return storage.getBackendType() === 'keychain';
}

/**
 * Get a description of the client credentials storage location
 */
export function getClientStorageDescription(): string {
  return getClientCredentialsStorage().getStorageLocation();
}
