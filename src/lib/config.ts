// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024-present Datadog, Inc.

/**
 * Configuration and credential validation for Datadog API
 */

import { getTokenStorage, getTokenRefresher, NoTokensError, RefreshTokenExpiredError } from './auth';

export interface AgentInfo {
  type: string;
  version?: string;
  metadata?: Record<string, string>;
}

/**
 * Authentication method used for Datadog API
 */
export type AuthMethod = 'api_key' | 'oauth';

export interface DatadogConfig {
  /** API key (for api_key auth) */
  apiKey: string;
  /** Application key (for api_key auth) */
  appKey: string;
  /** Datadog site (e.g., 'datadoghq.com') */
  site: string;
  /** Auto-approve operations without prompting */
  autoApprove: boolean;
  /** Agent identification info */
  agentInfo: AgentInfo;
  /** Authentication method being used */
  authMethod: AuthMethod;
  /** OAuth access token (for oauth auth) */
  accessToken?: string;
}

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

/**
 * Validates and retrieves Datadog configuration from environment variables
 */
export class ConfigValidator {
  private static instance: DatadogConfig | null = null;

  /**
   * Detects agent information from environment variables and process context
   * @returns AgentInfo object with detected agent details
   */
  private static detectAgentInfo(): AgentInfo {
    // Check for explicit agent identification via environment variables
    const agentType = process.env.DD_AGENT_TYPE;
    const agentVersion = process.env.DD_AGENT_VERSION;

    // Auto-detect agent type from common environment variables
    let detectedType = agentType || 'unknown';
    const metadata: Record<string, string> = {};

    // Claude detection
    if (!agentType) {
      if (process.env.CLAUDE_MODEL || process.env.ANTHROPIC_API_KEY) {
        detectedType = 'claude';
        if (process.env.CLAUDE_MODEL) {
          metadata.model = process.env.CLAUDE_MODEL;
        }
      }
      // Letta detection
      else if (process.env.LETTA_API_KEY || process.env.LETTA_BASE_URL) {
        detectedType = 'letta';
        if (process.env.LETTA_VERSION) {
          metadata.version = process.env.LETTA_VERSION;
        }
      }
      // ChatGPT/OpenAI detection
      else if (process.env.OPENAI_API_KEY || process.env.OPENAI_MODEL) {
        detectedType = 'chatgpt';
        if (process.env.OPENAI_MODEL) {
          metadata.model = process.env.OPENAI_MODEL;
        }
      }
      // Generic AI assistant detection
      else if (process.env.AI_ASSISTANT_TYPE) {
        detectedType = process.env.AI_ASSISTANT_TYPE;
      }
    }

    // Add runtime information
    metadata.runtime = 'nodejs';
    metadata.node_version = process.version;

    // Add plugin version from package.json if available
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const packageJson = require('../../package.json');
      metadata.plugin_version = packageJson.version;
    } catch {
      // Ignore if package.json is not available
    }

    return {
      type: detectedType,
      version: agentVersion,
      metadata,
    };
  }

  /**
   * Validates and returns Datadog configuration
   * Supports both API key and OAuth authentication
   * @param requireSync If true, won't attempt async OAuth token refresh (for synchronous contexts)
   * @throws {ConfigError} If required credentials are missing
   */
  static validate(requireSync: boolean = false): DatadogConfig {
    if (this.instance) {
      return this.instance;
    }

    const apiKey = process.env.DD_API_KEY;
    const appKey = process.env.DD_APP_KEY;
    const site = process.env.DD_SITE || 'datadoghq.com';
    const autoApprove = process.env.DD_AUTO_APPROVE === 'true';
    const useOAuth = process.env.DD_USE_OAUTH === 'true';
    const agentInfo = this.detectAgentInfo();

    // Validate site format first (applies to both auth methods)
    const validSites = [
      'datadoghq.com',       // US1
      'us3.datadoghq.com',   // US3
      'us5.datadoghq.com',   // US5
      'datadoghq.eu',        // EU1
      'ddog-gov.com',        // US1-FED
      'ap1.datadoghq.com',   // AP1
    ];

    if (!validSites.includes(site)) {
      console.warn(
        `Warning: DD_SITE "${site}" is not a standard Datadog site. ` +
        `Valid sites are: ${validSites.join(', ')}`
      );
    }

    // Determine authentication method
    // If DD_USE_OAUTH=true or no API keys, try OAuth
    const hasApiKeys = apiKey && appKey;
    const shouldUseOAuth = useOAuth || !hasApiKeys;

    if (shouldUseOAuth) {
      // Try OAuth authentication
      const oauthConfig = this.tryOAuthConfig(site, autoApprove, agentInfo, requireSync);
      if (oauthConfig) {
        this.instance = oauthConfig;
        return this.instance;
      }

      // If OAuth was explicitly requested but failed, error out
      if (useOAuth) {
        throw new ConfigError(
          'DD_USE_OAUTH is set but no valid OAuth tokens found. ' +
          'Run "dd-plugin auth login" to authenticate.'
        );
      }

      // If no API keys and no OAuth, show helpful error
      if (!hasApiKeys) {
        throw new ConfigError(
          'Authentication required. Either:\n' +
          '  1. Set DD_API_KEY and DD_APP_KEY environment variables, or\n' +
          '  2. Run "dd-plugin auth login" to authenticate with OAuth'
        );
      }
    }

    // Use API key authentication
    if (!apiKey) {
      throw new ConfigError(
        'DD_API_KEY environment variable is required. ' +
        'Set it with: export DD_API_KEY="your-api-key"'
      );
    }

    if (!appKey) {
      throw new ConfigError(
        'DD_APP_KEY environment variable is required. ' +
        'Set it with: export DD_APP_KEY="your-app-key"'
      );
    }

    // Basic validation for API key format
    if (apiKey.length < 32) {
      throw new ConfigError(
        'DD_API_KEY appears to be invalid (too short). ' +
        'Please check your API key at https://app.datadoghq.com/account/settings#api'
      );
    }

    // Basic validation for App key format
    if (appKey.length < 32) {
      throw new ConfigError(
        'DD_APP_KEY appears to be invalid (too short). ' +
        'Please check your Application key at https://app.datadoghq.com/account/settings#api'
      );
    }

    this.instance = {
      apiKey,
      appKey,
      site,
      autoApprove,
      agentInfo,
      authMethod: 'api_key',
    };
    return this.instance;
  }

  /**
   * Try to configure OAuth authentication
   * @returns DatadogConfig if OAuth tokens are valid, null otherwise
   */
  private static tryOAuthConfig(
    site: string,
    autoApprove: boolean,
    agentInfo: AgentInfo,
    requireSync: boolean
  ): DatadogConfig | null {
    try {
      const storage = getTokenStorage();
      const tokens = storage.getTokens(site);

      if (!tokens) {
        return null;
      }

      // Check if we have a valid (or refreshable) access token
      const refresher = getTokenRefresher(site);

      if (!refresher.hasTokens()) {
        return null;
      }

      // For sync contexts, just check if we have tokens (can't refresh synchronously)
      // The actual token refresh will happen when the client makes a request
      if (requireSync) {
        return {
          apiKey: '',  // Not used with OAuth
          appKey: '',  // Not used with OAuth
          site,
          autoApprove,
          agentInfo,
          authMethod: 'oauth',
          accessToken: tokens.accessToken,
        };
      }

      // For async contexts, we could pre-validate the token, but we'll defer
      // to the client layer which handles refresh automatically
      return {
        apiKey: '',  // Not used with OAuth
        appKey: '',  // Not used with OAuth
        site,
        autoApprove,
        agentInfo,
        authMethod: 'oauth',
        accessToken: tokens.accessToken,
      };
    } catch {
      // If anything fails, OAuth is not available
      return null;
    }
  }

  /**
   * Async version of validate that can refresh OAuth tokens
   * @throws {ConfigError} If required credentials are missing
   */
  static async validateAsync(): Promise<DatadogConfig> {
    // First do sync validation
    const config = this.validate(true);

    // If using OAuth, ensure we have a valid token
    if (config.authMethod === 'oauth') {
      const site = config.site;
      const refresher = getTokenRefresher(site);

      try {
        const accessToken = await refresher.getValidAccessToken();
        config.accessToken = accessToken;
      } catch (error) {
        // Reset instance so next call tries again
        this.instance = null;

        if (error instanceof NoTokensError || error instanceof RefreshTokenExpiredError) {
          throw new ConfigError(
            'OAuth authentication failed. ' +
            'Run "dd-plugin auth login" to re-authenticate.'
          );
        }
        throw error;
      }
    }

    return config;
  }

  /**
   * Clears the cached configuration (useful for testing)
   */
  static reset(): void {
    this.instance = null;
  }

  /**
   * Gets the current configuration without validation
   * @returns The cached configuration or null if not yet validated
   */
  static getCurrent(): DatadogConfig | null {
    return this.instance;
  }
}
