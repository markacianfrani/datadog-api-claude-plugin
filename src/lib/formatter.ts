/**
 * Response formatting utilities for Datadog API data
 */

export enum OutputFormat {
  JSON = 'json',
  COMPACT = 'compact',
  TABLE = 'table',
  LIST = 'list',
}

/**
 * Response formatter for Datadog API data
 */
export class ResponseFormatter {
  /**
   * Formats data according to the specified format
   * @param data The data to format
   * @param format The output format to use
   * @returns Formatted string
   */
  static format(data: any, format: OutputFormat = OutputFormat.JSON): string {
    switch (format) {
      case OutputFormat.JSON:
        return this.formatJSON(data);
      case OutputFormat.COMPACT:
        return this.formatCompact(data);
      case OutputFormat.TABLE:
        return this.formatTable(data);
      case OutputFormat.LIST:
        return this.formatList(data);
      default:
        return this.formatJSON(data);
    }
  }

  /**
   * Formats data as pretty-printed JSON
   */
  static formatJSON(data: any): string {
    return JSON.stringify(data, null, 2);
  }

  /**
   * Formats data as compact JSON (single line)
   */
  static formatCompact(data: any): string {
    return JSON.stringify(data);
  }

  /**
   * Formats an array of objects as a simple list
   * @param items Array of items to format
   * @param nameField Field to use for the item name (default: 'name')
   * @param idField Field to use for the item ID (default: 'id')
   */
  static formatList(
    items: any[],
    nameField: string = 'name',
    idField: string = 'id'
  ): string {
    if (!Array.isArray(items)) {
      return this.formatJSON(items);
    }

    if (items.length === 0) {
      return 'No items found.';
    }

    return items
      .map((item, index) => {
        const name = item[nameField] || item[idField] || `Item ${index + 1}`;
        const id = item[idField];
        return id ? `${index + 1}. ${name} (${id})` : `${index + 1}. ${name}`;
      })
      .join('\n');
  }

  /**
   * Formats an array of objects as a simple table
   * @param items Array of items to format
   * @param columns Columns to display (if not specified, uses all keys from first item)
   */
  static formatTable(items: any[], columns?: string[]): string {
    if (!Array.isArray(items)) {
      return this.formatJSON(items);
    }

    if (items.length === 0) {
      return 'No items found.';
    }

    // Determine columns
    const cols = columns || Object.keys(items[0] || {});
    if (cols.length === 0) {
      return 'No data to display.';
    }

    // Calculate column widths
    const widths = cols.map((col) => {
      const values = items.map((item) => String(item[col] || ''));
      const maxValueWidth = Math.max(...values.map((v) => v.length));
      return Math.max(col.length, maxValueWidth);
    });

    // Build header row
    const header = cols.map((col, i) => col.padEnd(widths[i])).join(' | ');
    const separator = widths.map((w) => '-'.repeat(w)).join('-+-');

    // Build data rows
    const rows = items.map((item) =>
      cols.map((col, i) => String(item[col] || '').padEnd(widths[i])).join(' | ')
    );

    return [header, separator, ...rows].join('\n');
  }

  /**
   * Formats metric query results
   */
  static formatMetrics(data: any): string {
    if (!data || !data.series) {
      return this.formatJSON(data);
    }

    const output: string[] = [];
    output.push(`Query: ${data.query || 'N/A'}`);
    output.push(`Series: ${data.series.length}`);
    output.push('');

    data.series.forEach((series: any, index: number) => {
      output.push(`Series ${index + 1}:`);
      output.push(`  Metric: ${series.metric || 'N/A'}`);
      output.push(`  Tags: ${(series.tags || []).join(', ') || 'None'}`);
      output.push(`  Points: ${(series.pointlist || []).length}`);
      if (series.pointlist && series.pointlist.length > 0) {
        const firstPoint = series.pointlist[0];
        const lastPoint = series.pointlist[series.pointlist.length - 1];
        output.push(`  First: ${new Date(firstPoint[0]).toISOString()} = ${firstPoint[1]}`);
        output.push(`  Last: ${new Date(lastPoint[0]).toISOString()} = ${lastPoint[1]}`);
      }
      output.push('');
    });

    return output.join('\n');
  }

  /**
   * Formats monitor information
   */
  static formatMonitor(monitor: any): string {
    const output: string[] = [];
    output.push(`Monitor: ${monitor.name || 'Unnamed'}`);
    output.push(`ID: ${monitor.id || 'N/A'}`);
    output.push(`Type: ${monitor.type || 'N/A'}`);
    output.push(`Status: ${monitor.overall_state || 'N/A'}`);
    output.push(`Query: ${monitor.query || 'N/A'}`);
    if (monitor.message) {
      output.push(`Message: ${monitor.message}`);
    }
    if (monitor.tags && monitor.tags.length > 0) {
      output.push(`Tags: ${monitor.tags.join(', ')}`);
    }
    return output.join('\n');
  }

  /**
   * Formats dashboard information
   */
  static formatDashboard(dashboard: any): string {
    const output: string[] = [];
    output.push(`Dashboard: ${dashboard.title || 'Untitled'}`);
    output.push(`ID: ${dashboard.id || 'N/A'}`);
    output.push(`Description: ${dashboard.description || 'None'}`);
    if (dashboard.widgets) {
      output.push(`Widgets: ${dashboard.widgets.length}`);
    }
    if (dashboard.layout_type) {
      output.push(`Layout: ${dashboard.layout_type}`);
    }
    return output.join('\n');
  }

  /**
   * Formats a success message
   */
  static formatSuccess(message: string, data?: any): string {
    const output = {
      success: true,
      message,
      ...(data && { data }),
    };
    return this.formatJSON(output);
  }

  /**
   * Formats an error message (for consistency)
   */
  static formatError(message: string, details?: any): string {
    const output = {
      error: true,
      message,
      ...(details && { details }),
    };
    return this.formatJSON(output);
  }
}
