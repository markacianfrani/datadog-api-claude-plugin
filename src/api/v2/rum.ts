/**
 * RUM API operations (v2)
 * Handles Real User Monitoring queries
 */

import { v2 } from '@datadog/datadog-api-client';
import { getV2Api } from '../../lib/client';
import { ErrorHandler } from '../../lib/error-handler';
import { PermissionManager } from '../../lib/permissions';
import { ResponseFormatter } from '../../lib/formatter';

export interface RUMSearchParams {
  query: string;
  from: number;
  to: number;
  limit?: number;
}

/**
 * RUM API handler
 */
export class RUMApi {
  private api: v2.RUMApi;

  constructor() {
    this.api = getV2Api(v2.RUMApi);
  }

  /**
   * Search RUM events
   * @param params Search parameters
   * @returns Formatted RUM results
   */
  async searchRUMEvents(params: RUMSearchParams): Promise<string> {
    try {
      // Check permissions
      PermissionManager.requirePermission(
        PermissionManager.createReadCheck('rum', 'search')
      );

      // Make API call
      const response = await this.api.listRUMEvents({
        body: {
          filter: {
            query: params.query,
            from: new Date(params.from * 1000).toISOString(),
            to: new Date(params.to * 1000).toISOString(),
          },
          page: {
            limit: params.limit || 50,
          },
        },
      } as any);

      // Format response
      if (response.data && Array.isArray(response.data)) {
        return ResponseFormatter.formatJSON(response.data);
      }

      return ResponseFormatter.formatJSON(response);
    } catch (error) {
      ErrorHandler.handle(error);
    }
  }
}

/**
 * Convenience function to create a RUMApi instance
 */
export function createRUMApi(): RUMApi {
  return new RUMApi();
}
