import { useRouter, usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: ('student' | 'lecturer' | 'admin' | 'HOD')[];
  redirectTo?: string;
}

export const ProtectedRoute = ({ 
  children, 
  allowedRoles = [], 
  redirectTo 
}: ProtectedRouteProps) => {
  const { isAuthenticated, role, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading) {
      if (!isAuthenticated) {
        const loginUrl = `/auth/login?redirectedFrom=${encodeURIComponent(pathname)}`;
        router.push(loginUrl);
        return;
      }

      if (allowedRoles.length > 0 && role && !allowedRoles.includes(role)) {
        const defaultRedirect = getDefaultRedirectByRole(role);
        router.push(redirectTo || defaultRedirect);
        return;
      }
    }
  }, [isAuthenticated, role, loading, router, allowedRoles, redirectTo, pathname]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin" />
        <span className="ml-2">Loading...</span>
      </div>
    );
  }

  if (!isAuthenticated || (allowedRoles.length > 0 && role && !allowedRoles.includes(role))) {
    return null;
  }

  return <>{children}</>;
};

const getDefaultRedirectByRole = (role: string) => {
  switch (role) {
    case 'student':
      return '/student';
    case 'lecturer':
      return '/admin';
    case 'admin':
      return '/admin';
    default:
      return '/';
  }
};