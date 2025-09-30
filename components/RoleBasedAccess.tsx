import { useAuth } from '@/hooks/useAuth';

interface RoleBasedAccessProps {
  children: React.ReactNode;
  allowedRoles: ('student' | 'lecturer' | 'admin')[];
  fallback?: React.ReactNode;
}

export const RoleBasedAccess = ({ 
  children, 
  allowedRoles, 
  fallback = null 
}: RoleBasedAccessProps) => {
  const { role } = useAuth();

  if (!role || !allowedRoles.includes(role)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
};