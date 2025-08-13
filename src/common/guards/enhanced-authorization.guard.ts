import { Injectable, CanActivate, ExecutionContext, ForbiddenException, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

export interface AuthorizationContext {
  user: any;
  resource?: any;
  action: string;
  resourceType?: string;
}

export interface RolePermission {
  role: string;
  permissions: string[];
  conditions?: (context: AuthorizationContext) => boolean;
}

// Role-based permissions configuration
const ROLE_PERMISSIONS: RolePermission[] = [
  {
    role: 'admin',
    permissions: ['*'], // Admin has all permissions
  },
  {
    role: 'manager',
    permissions: [
      'task:read',
      'task:create',
      'task:update',
      'task:delete',
      'task:assign',
      'user:read',
      'reports:read',
    ],
  },
  {
    role: 'user',
    permissions: [
      'task:read',
      'task:create',
      'task:update',
      'profile:read',
      'profile:update',
    ],
    conditions: (context) => {
      // Users can only access their own resources
      if (context.resource && context.resource.userId) {
        return context.resource.userId === context.user.id;
      }
      return true;
    },
  },
];

@Injectable()
export class EnhancedAuthorizationGuard implements CanActivate {
  private readonly logger = new Logger(EnhancedAuthorizationGuard.name);

  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Get required permissions from decorator
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>('permissions', [
      context.getHandler(),
      context.getClass(),
    ]);

    const requiredRoles = this.reflector.getAllAndOverride<string[]>('roles', [
      context.getHandler(),
      context.getClass(),
    ]);

    // If no permissions or roles are required, allow access
    if (!requiredPermissions && !requiredRoles) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    // Check role-based access
    if (requiredRoles && !this.checkRoles(user, requiredRoles)) {
      this.logger.warn(`Access denied for user ${user.email}. Required roles: ${requiredRoles}, User role: ${user.role}`);
      throw new ForbiddenException('Insufficient role privileges');
    }

    // Check permission-based access
    if (requiredPermissions && !this.checkPermissions(user, requiredPermissions, request)) {
      this.logger.warn(`Access denied for user ${user.email}. Required permissions: ${requiredPermissions}`);
      throw new ForbiddenException('Insufficient permissions');
    }

    return true;
  }

  private checkRoles(user: any, requiredRoles: string[]): boolean {
    return requiredRoles.some(role => user.role === role);
  }

  private checkPermissions(user: any, requiredPermissions: string[], request: any): boolean {
    const userRolePermissions = ROLE_PERMISSIONS.find(rp => rp.role === user.role);
    
    if (!userRolePermissions) {
      return false;
    }

    // Check if user has admin permissions (wildcard)
    if (userRolePermissions.permissions.includes('*')) {
      return true;
    }

    // Check each required permission
    for (const permission of requiredPermissions) {
      if (!this.hasPermission(userRolePermissions, permission, user, request)) {
        return false;
      }
    }

    return true;
  }

  private hasPermission(userRolePermissions: RolePermission, permission: string, user: any, request: any): boolean {
    // Check if user has the specific permission
    if (!userRolePermissions.permissions.includes(permission)) {
      return false;
    }

    // Check additional conditions if they exist
    if (userRolePermissions.conditions) {
      const authContext: AuthorizationContext = {
        user,
        resource: request.params.id ? { id: request.params.id, userId: request.body?.userId || request.query?.userId } : null,
        action: this.extractAction(request),
        resourceType: this.extractResourceType(request),
      };

      return userRolePermissions.conditions(authContext);
    }

    return true;
  }

  private extractAction(request: any): string {
    const method = request.method?.toLowerCase();
    switch (method) {
      case 'get': return 'read';
      case 'post': return 'create';
      case 'put':
      case 'patch': return 'update';
      case 'delete': return 'delete';
      default: return 'unknown';
    }
  }

  private extractResourceType(request: any): string {
    const path = request.route?.path || request.url;
    if (path.includes('/tasks')) return 'task';
    if (path.includes('/users')) return 'user';
    return 'unknown';
  }
}

// Permissions decorator
export const RequirePermissions = (...permissions: string[]) => {
  return (target: any, key?: string, descriptor?: any) => {
    Reflect.defineMetadata('permissions', permissions, descriptor?.value || target);
    return descriptor;
  };
};

// Enhanced roles decorator with better type safety
export const RequireRoles = (...roles: string[]) => {
  return (target: any, key?: string, descriptor?: any) => {
    Reflect.defineMetadata('roles', roles, descriptor?.value || target);
    return descriptor;
  };
};
