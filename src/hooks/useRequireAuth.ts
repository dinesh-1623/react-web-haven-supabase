import { useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';

interface UseRequireAuthOptions {
  redirectTo?: string;
  requiredRole?: 'student' | 'teacher' | 'admin';
  onUnauthorized?: () => void;
}

export const useRequireAuth = (options: UseRequireAuthOptions = {}) => {
  const { user, profile, loading, session } = useAuth();
  const { requiredRole, onUnauthorized } = options;

  useEffect(() => {
    console.log('🔍 useRequireAuth: Checking authentication state');
    console.log('🔍 useRequireAuth: Loading:', loading);
    console.log('🔍 useRequireAuth: User:', user);
    console.log('🔍 useRequireAuth: Profile:', profile);
    console.log('🔍 useRequireAuth: Session:', session);
    console.log('🔍 useRequireAuth: Required role:', requiredRole);

    // Don't check auth while still loading
    if (loading) {
      console.log('🔍 useRequireAuth: Still loading, skipping auth check');
      return;
    }

    // Check if user is authenticated
    if (!user || !session) {
      console.log('❌ useRequireAuth: User not authenticated');
      
      if (onUnauthorized) {
        onUnauthorized();
      }
      return;
    }

    // Check if profile exists
    if (!profile) {
      console.log('❌ useRequireAuth: Profile not found, user may need to complete setup');
      toast.error('User profile not found. Please contact support.');
      return;
    }

    // Check role requirements
    if (requiredRole && profile.role !== requiredRole) {
      console.log(`❌ useRequireAuth: Insufficient permissions. Required: ${requiredRole}, Current: ${profile.role}`);
      toast.error(`Access denied. This page requires ${requiredRole} privileges.`);
      
      if (onUnauthorized) {
        onUnauthorized();
      }
      return;
    }

    console.log('✅ useRequireAuth: Authentication check passed');
  }, [user, profile, loading, session, requiredRole, onUnauthorized]);

  return {
    user,
    profile,
    loading,
    isAuthenticated: !!user && !!session && !!profile,
    hasRequiredRole: !requiredRole || profile?.role === requiredRole
  };
};