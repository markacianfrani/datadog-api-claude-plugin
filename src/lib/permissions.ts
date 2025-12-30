/**
 * Permission system for Datadog API operations
 * Implements a three-tier model: READ, WRITE, DELETE
 */

export enum OperationType {
  READ = 'read',
  WRITE = 'write',
  DELETE = 'delete',
}

export interface PermissionCheck {
  operation: OperationType;
  resource: string;
  identifier?: string;
  requiresConfirmation: boolean;
  warningMessage?: string;
  impactDescription?: string;
}

export class PermissionError extends Error {
  constructor(message: string, public check: PermissionCheck) {
    super(message);
    this.name = 'PermissionError';
  }
}

/**
 * Permission manager for controlling access to Datadog operations
 */
export class PermissionManager {
  /**
   * Checks if an operation should be allowed
   * @param check The permission check to perform
   * @returns true if the operation is allowed, false otherwise
   */
  static checkPermission(check: PermissionCheck): boolean {
    switch (check.operation) {
      case OperationType.READ:
        return this.handleReadOperation(check);
      case OperationType.WRITE:
        return this.handleWriteOperation(check);
      case OperationType.DELETE:
        return this.handleDeleteOperation(check);
      default:
        console.error(`Unknown operation type: ${check.operation}`);
        return false;
    }
  }

  /**
   * Handles READ operations (always allowed)
   */
  private static handleReadOperation(_check: PermissionCheck): boolean {
    return true;
  }

  /**
   * Handles WRITE operations (requires confirmation in Phase 5)
   */
  private static handleWriteOperation(check: PermissionCheck): boolean {
    // Phase 1 implementation: Log warning but allow
    // Phase 5 will implement interactive confirmation
    if (check.requiresConfirmation) {
      console.error(
        `⚠️  WRITE operation requires confirmation: ${check.resource}${
          check.identifier ? ` (${check.identifier})` : ''
        }`
      );
      if (check.warningMessage) {
        console.error(`   ${check.warningMessage}`);
      }
    }
    // For now, return true (allow operation)
    // In Phase 5, this will prompt the user interactively
    return true;
  }

  /**
   * Handles DELETE operations (requires explicit confirmation with impact warning)
   */
  private static handleDeleteOperation(check: PermissionCheck): boolean {
    // Phase 1 implementation: Log error but allow
    // Phase 5 will implement interactive confirmation with impact statement
    console.error(
      `🚨 DESTRUCTIVE operation requires confirmation: ${check.resource}${
        check.identifier ? ` (${check.identifier})` : ''
      }`
    );
    if (check.impactDescription) {
      console.error(`   Impact: ${check.impactDescription}`);
    }
    if (check.warningMessage) {
      console.error(`   ⚠️  ${check.warningMessage}`);
    }
    console.error(
      `   This operation cannot be undone. In production, you would be prompted for confirmation.`
    );
    // For now, return true (allow operation)
    // In Phase 5, this will require explicit user confirmation
    return true;
  }

  /**
   * Creates a permission check for a READ operation
   */
  static createReadCheck(resource: string, identifier?: string): PermissionCheck {
    return {
      operation: OperationType.READ,
      resource,
      identifier,
      requiresConfirmation: false,
    };
  }

  /**
   * Creates a permission check for a WRITE operation
   */
  static createWriteCheck(
    resource: string,
    identifier?: string,
    warningMessage?: string
  ): PermissionCheck {
    return {
      operation: OperationType.WRITE,
      resource,
      identifier,
      requiresConfirmation: true,
      warningMessage,
    };
  }

  /**
   * Creates a permission check for a DELETE operation
   */
  static createDeleteCheck(
    resource: string,
    identifier: string,
    impactDescription: string,
    warningMessage?: string
  ): PermissionCheck {
    return {
      operation: OperationType.DELETE,
      resource,
      identifier,
      requiresConfirmation: true,
      impactDescription,
      warningMessage,
    };
  }

  /**
   * Validates that a permission check passes, throwing an error if not
   * @throws {PermissionError} If the permission check fails
   */
  static requirePermission(check: PermissionCheck): void {
    if (!this.checkPermission(check)) {
      throw new PermissionError(
        `Permission denied for ${check.operation} operation on ${check.resource}`,
        check
      );
    }
  }
}
