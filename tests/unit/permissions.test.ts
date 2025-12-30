/**
 * Unit tests for permissions module
 */

import { PermissionManager, OperationType, PermissionError } from '../../src/lib/permissions';

describe('PermissionManager', () => {
  // Suppress console output during tests
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  describe('checkPermission()', () => {
    it('should allow READ operations', () => {
      const check = {
        operation: OperationType.READ,
        resource: 'metrics',
        requiresConfirmation: false,
      };

      const result = PermissionManager.checkPermission(check);

      expect(result).toBe(true);
    });

    it('should allow WRITE operations (Phase 1 implementation)', () => {
      const check = {
        operation: OperationType.WRITE,
        resource: 'monitors',
        requiresConfirmation: true,
      };

      const result = PermissionManager.checkPermission(check);

      expect(result).toBe(true);
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it('should allow DELETE operations (Phase 1 implementation)', () => {
      const check = {
        operation: OperationType.DELETE,
        resource: 'dashboards',
        identifier: 'dash-123',
        requiresConfirmation: true,
        impactDescription: 'This will permanently delete the dashboard',
      };

      const result = PermissionManager.checkPermission(check);

      expect(result).toBe(true);
      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });

  describe('createReadCheck()', () => {
    it('should create a READ permission check', () => {
      const check = PermissionManager.createReadCheck('metrics', 'cpu.usage');

      expect(check.operation).toBe(OperationType.READ);
      expect(check.resource).toBe('metrics');
      expect(check.identifier).toBe('cpu.usage');
      expect(check.requiresConfirmation).toBe(false);
    });
  });

  describe('createWriteCheck()', () => {
    it('should create a WRITE permission check', () => {
      const check = PermissionManager.createWriteCheck(
        'monitors',
        'mon-123',
        'This will update the monitor configuration'
      );

      expect(check.operation).toBe(OperationType.WRITE);
      expect(check.resource).toBe('monitors');
      expect(check.identifier).toBe('mon-123');
      expect(check.requiresConfirmation).toBe(true);
      expect(check.warningMessage).toBe('This will update the monitor configuration');
    });
  });

  describe('createDeleteCheck()', () => {
    it('should create a DELETE permission check', () => {
      const check = PermissionManager.createDeleteCheck(
        'dashboards',
        'dash-123',
        'This will permanently delete the dashboard',
        'All associated widgets will also be removed'
      );

      expect(check.operation).toBe(OperationType.DELETE);
      expect(check.resource).toBe('dashboards');
      expect(check.identifier).toBe('dash-123');
      expect(check.requiresConfirmation).toBe(true);
      expect(check.impactDescription).toBe('This will permanently delete the dashboard');
      expect(check.warningMessage).toBe('All associated widgets will also be removed');
    });
  });

  describe('requirePermission()', () => {
    it('should not throw for allowed operations', () => {
      const check = PermissionManager.createReadCheck('metrics');

      expect(() => PermissionManager.requirePermission(check)).not.toThrow();
    });

    it('should throw PermissionError if permission is denied', () => {
      // Mock checkPermission to return false
      jest.spyOn(PermissionManager, 'checkPermission').mockReturnValue(false);

      const check = PermissionManager.createWriteCheck('monitors');

      expect(() => PermissionManager.requirePermission(check)).toThrow(PermissionError);
      expect(() => PermissionManager.requirePermission(check)).toThrow(/Permission denied/);
    });
  });
});
