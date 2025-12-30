/**
 * Unit tests for formatter module
 */

import { ResponseFormatter, OutputFormat } from '../../src/lib/formatter';

describe('ResponseFormatter', () => {
  describe('formatJSON()', () => {
    it('should format data as pretty JSON', () => {
      const data = { key: 'value', number: 42 };
      const result = ResponseFormatter.formatJSON(data);

      expect(result).toBe(JSON.stringify(data, null, 2));
      expect(result).toContain('\n');
    });
  });

  describe('formatCompact()', () => {
    it('should format data as compact JSON', () => {
      const data = { key: 'value', number: 42 };
      const result = ResponseFormatter.formatCompact(data);

      expect(result).toBe(JSON.stringify(data));
      expect(result).not.toContain('\n');
    });
  });

  describe('formatList()', () => {
    it('should format array of objects as a list', () => {
      const items = [
        { id: '1', name: 'Item One' },
        { id: '2', name: 'Item Two' },
        { id: '3', name: 'Item Three' },
      ];

      const result = ResponseFormatter.formatList(items);

      expect(result).toContain('1. Item One (1)');
      expect(result).toContain('2. Item Two (2)');
      expect(result).toContain('3. Item Three (3)');
    });

    it('should handle empty arrays', () => {
      const result = ResponseFormatter.formatList([]);
      expect(result).toBe('No items found.');
    });

    it('should handle objects without name field', () => {
      const items = [{ id: 'abc' }, { id: 'def' }];
      const result = ResponseFormatter.formatList(items);

      expect(result).toContain('1. abc');
      expect(result).toContain('2. def');
    });

    it('should return JSON for non-array input', () => {
      const data = { key: 'value' };
      const result = ResponseFormatter.formatList(data as any);

      expect(result).toBe(JSON.stringify(data, null, 2));
    });
  });

  describe('formatTable()', () => {
    it('should format array of objects as a table', () => {
      const items = [
        { id: '1', name: 'Item One', status: 'active' },
        { id: '2', name: 'Item Two', status: 'inactive' },
      ];

      const result = ResponseFormatter.formatTable(items);

      expect(result).toContain('id');
      expect(result).toContain('name');
      expect(result).toContain('status');
      expect(result).toContain('Item One');
      expect(result).toContain('Item Two');
      expect(result).toContain('---'); // Separator
    });

    it('should handle empty arrays', () => {
      const result = ResponseFormatter.formatTable([]);
      expect(result).toBe('No items found.');
    });

    it('should format with specified columns', () => {
      const items = [
        { id: '1', name: 'Item One', status: 'active', extra: 'ignored' },
        { id: '2', name: 'Item Two', status: 'inactive', extra: 'ignored' },
      ];

      const result = ResponseFormatter.formatTable(items, ['id', 'name']);

      expect(result).toContain('id');
      expect(result).toContain('name');
      expect(result).not.toContain('status');
      expect(result).not.toContain('extra');
    });

    it('should return JSON for non-array input', () => {
      const data = { key: 'value' };
      const result = ResponseFormatter.formatTable(data as any);

      expect(result).toBe(JSON.stringify(data, null, 2));
    });
  });

  describe('formatSuccess()', () => {
    it('should format success message', () => {
      const result = ResponseFormatter.formatSuccess('Operation completed');
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.message).toBe('Operation completed');
    });

    it('should include data if provided', () => {
      const result = ResponseFormatter.formatSuccess('Done', { id: '123' });
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.message).toBe('Done');
      expect(parsed.data).toEqual({ id: '123' });
    });
  });

  describe('formatError()', () => {
    it('should format error message', () => {
      const result = ResponseFormatter.formatError('Something went wrong');
      const parsed = JSON.parse(result);

      expect(parsed.error).toBe(true);
      expect(parsed.message).toBe('Something went wrong');
    });

    it('should include details if provided', () => {
      const result = ResponseFormatter.formatError('Failed', { code: 500 });
      const parsed = JSON.parse(result);

      expect(parsed.error).toBe(true);
      expect(parsed.message).toBe('Failed');
      expect(parsed.details).toEqual({ code: 500 });
    });
  });

  describe('formatMonitor()', () => {
    it('should format monitor information', () => {
      const monitor = {
        id: 123,
        name: 'CPU Monitor',
        type: 'metric alert',
        overall_state: 'OK',
        query: 'avg(last_5m):avg:system.cpu.user{*} > 0.9',
        message: 'CPU usage is high',
        tags: ['env:prod', 'service:web'],
      };

      const result = ResponseFormatter.formatMonitor(monitor);

      expect(result).toContain('CPU Monitor');
      expect(result).toContain('123');
      expect(result).toContain('metric alert');
      expect(result).toContain('OK');
      expect(result).toContain('avg(last_5m)');
      expect(result).toContain('CPU usage is high');
      expect(result).toContain('env:prod');
    });
  });

  describe('formatDashboard()', () => {
    it('should format dashboard information', () => {
      const dashboard = {
        id: 'abc-123',
        title: 'System Dashboard',
        description: 'Overview of system metrics',
        layout_type: 'ordered',
        widgets: [{}, {}, {}],
      };

      const result = ResponseFormatter.formatDashboard(dashboard);

      expect(result).toContain('System Dashboard');
      expect(result).toContain('abc-123');
      expect(result).toContain('Overview of system metrics');
      expect(result).toContain('Widgets: 3');
      expect(result).toContain('ordered');
    });
  });

  describe('format()', () => {
    it('should format according to OutputFormat', () => {
      const data = { key: 'value' };

      const jsonResult = ResponseFormatter.format(data, OutputFormat.JSON);
      expect(jsonResult).toContain('\n');

      const compactResult = ResponseFormatter.format(data, OutputFormat.COMPACT);
      expect(compactResult).not.toContain('\n');
    });

    it('should default to JSON format', () => {
      const data = { key: 'value' };
      const result = ResponseFormatter.format(data);

      expect(result).toBe(ResponseFormatter.formatJSON(data));
    });
  });
});
