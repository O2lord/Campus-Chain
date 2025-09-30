import { ComponentType } from 'react';
import { ProtectedRoute } from './ProtectedRoute';

export function withRoleProtection<P extends object>(
  Component: ComponentType<P>,
  allowedRoles: ('student' | 'lecturer' | 'admin' | 'HOD')[],
  redirectTo?: string
) {
  return function ProtectedComponent(props: P) {
    return (
      <ProtectedRoute allowedRoles={allowedRoles} redirectTo={redirectTo}>
        <Component {...props} />
      </ProtectedRoute>
    );
  };
}
