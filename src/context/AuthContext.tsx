import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { User, Session, AuthError } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

interface Profile {
  id: string;
  full_name: string;
  role: 'student' | 'teacher' | 'admin';
  avatar_url?: string;
  bio?: string;
  created_at?: string;
  updated_at?: string;
  mentor_id?: string;
}

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Use refs to track if we're already fetching to prevent infinite loops
  const fetchingProfile = useRef(false);
  const initializedRef = useRef(false);
  const redirectingRef = useRef(false);

  const createDefaultProfile = async (userId: string, userEmail: string, user: User) => {
    console.log('🔍 AuthContext: Creating default profile for user:', userId);
    
    try {
      // Determine role from email or use default
      let initialRole: 'student' | 'teacher' | 'admin' = 'student';
      
      // Check user metadata first
      if (user.user_metadata?.role) {
        console.log('🔍 AuthContext: Found role in user_metadata:', user.user_metadata.role);
        initialRole = user.user_metadata.role;
      } else if (user.app_metadata?.role) {
        console.log('🔍 AuthContext: Found role in app_metadata:', user.app_metadata.role);
        initialRole = user.app_metadata.role;
      } else {
        // Determine role based on email for demo purposes
        if (userEmail.includes('teacher')) {
          initialRole = 'teacher';
        } else if (userEmail.includes('admin')) {
          initialRole = 'admin';
        } else {
          initialRole = 'student';
        }
        console.log('🔍 AuthContext: Determined role from email:', initialRole);
      }

      const defaultProfile = {
        id: userId,
        full_name: userEmail.split('@')[0] || 'User',
        role: initialRole,
        avatar_url: null,
        bio: null
      };

      console.log('🔍 AuthContext: Inserting default profile:', defaultProfile);

      const { data, error } = await supabase
        .from('profiles')
        .insert(defaultProfile)
        .select()
        .single();

      if (error) {
        console.error('❌ AuthContext: Error creating default profile:', error);
        return null;
      }

      console.log('✅ AuthContext: Default profile created:', data);
      return data;
    } catch (error) {
      console.error('❌ AuthContext: Exception creating default profile:', error);
      return null;
    }
  };

  const fetchProfile = async (userId: string, userEmail?: string, user?: User, force = false) => {
    // Prevent multiple simultaneous fetches
    if (fetchingProfile.current && !force) {
      console.log('🔍 AuthContext: Profile fetch already in progress, skipping');
      return null;
    }

    fetchingProfile.current = true;
    console.log('🔍 AuthContext: Fetching profile for user:', userId);
    
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('❌ AuthContext: Error fetching profile:', error);
        
        // If profile doesn't exist (PGRST116), create a default one
        if (error.code === 'PGRST116' && userEmail && user) {
          console.log('🔍 AuthContext: Profile not found, creating default profile');
          const newProfile = await createDefaultProfile(userId, userEmail, user);
          fetchingProfile.current = false;
          return newProfile;
        }
        
        fetchingProfile.current = false;
        return null;
      }

      console.log('✅ AuthContext: Profile fetched successfully:', data);
      fetchingProfile.current = false;
      return data;
    } catch (error) {
      console.error('❌ AuthContext: Exception fetching profile:', error);
      fetchingProfile.current = false;
      return null;
    }
  };

  const refreshProfile = async () => {
    if (user) {
      console.log('🔍 AuthContext: Refreshing profile for user:', user.id);
      const profileData = await fetchProfile(user.id, user.email, user, true);
      setProfile(profileData);
    }
  };

  const clearAuthState = () => {
    console.log('🔍 AuthContext: Clearing auth state');
    setUser(null);
    setProfile(null);
    setSession(null);
    fetchingProfile.current = false;
  };

  const redirectToLogin = () => {
    if (redirectingRef.current) {
      console.log('🔍 AuthContext: Already redirecting, skipping');
      return;
    }
    
    redirectingRef.current = true;
    console.log('🔍 AuthContext: Redirecting to login due to session expiry');
    
    // Clear all auth state
    clearAuthState();
    setLoading(false);
    
    // Clear storage
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch (error) {
      console.warn('⚠️ AuthContext: Could not clear storage:', error);
    }
    
    // Force redirect to login
    setTimeout(() => {
      window.location.href = '/';
      redirectingRef.current = false;
    }, 100);
  };

  const handleAuthStateChange = async (event: string, session: Session | null) => {
    console.log('🔍 AuthContext: Auth state changed:', event, 'Session:', !!session);
    
    // Handle session expiry or failed refresh
    if (event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED' && !session) {
      console.log('🔍 AuthContext: Session expired or refresh failed');
      
      if (event === 'TOKEN_REFRESHED' && !session) {
        console.log('🔍 AuthContext: Token refresh failed, redirecting to login');
        toast.error('Your session has expired. Please sign in again.');
        redirectToLogin();
        return;
      }
      
      if (event === 'SIGNED_OUT') {
        console.log('🔍 AuthContext: User signed out');
        clearAuthState();
        setLoading(false);
        return;
      }
    }

    // Handle successful authentication
    if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && session) {
      console.log('🔍 AuthContext: User authenticated successfully');
      setSession(session);
      setUser(session.user);
      
      if (session.user) {
        console.log('🔍 AuthContext: Fetching profile for authenticated user');
        const profileData = await fetchProfile(session.user.id, session.user.email, session.user);
        console.log('🔍 AuthContext: Profile data received:', profileData);
        setProfile(profileData);
      }
    }
    
    // Handle initial session check
    if (event === 'INITIAL_SESSION') {
      if (session) {
        console.log('🔍 AuthContext: Initial session found');
        setSession(session);
        setUser(session.user);
        
        if (session.user) {
          const profileData = await fetchProfile(session.user.id, session.user.email, session.user);
          setProfile(profileData);
        }
      } else {
        console.log('🔍 AuthContext: No initial session found');
      }
    }
    
    setLoading(false);
  };

  useEffect(() => {
    // Prevent multiple initializations
    if (initializedRef.current) {
      console.log('🔍 AuthContext: Already initialized, skipping');
      return;
    }

    console.log('🔍 AuthContext: Initializing auth state');
    initializedRef.current = true;
    
    // Get initial session
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      console.log('🔍 AuthContext: Initial session check:', !!session, error);
      
      if (error) {
        console.error('❌ AuthContext: Error getting initial session:', error);
        setLoading(false);
        return;
      }
      
      // Trigger initial session handling
      handleAuthStateChange('INITIAL_SESSION', session);
    });

    // Listen for auth changes with enhanced error handling
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('🔍 AuthContext: Auth state change event:', event, 'Session valid:', !!session);
      
      // Special handling for token refresh failures
      if (event === 'TOKEN_REFRESHED' && !session) {
        console.error('❌ AuthContext: Token refresh failed - session is null');
        toast.error('Your session has expired. Please sign in again.');
        redirectToLogin();
        return;
      }
      
      handleAuthStateChange(event, session);
    });

    return () => {
      console.log('🔍 AuthContext: Cleaning up auth subscription');
      subscription.unsubscribe();
      initializedRef.current = false;
      fetchingProfile.current = false;
      redirectingRef.current = false;
    };
  }, []); // Empty dependency array to run only once

  const signIn = async (email: string, password: string) => {
    console.log('🔍 AuthContext: Attempting sign in for:', email);
    
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error('❌ AuthContext: Sign in error:', error);
        toast.error(error.message);
      } else {
        console.log('✅ AuthContext: Sign in successful');
        toast.success('Successfully signed in!');
      }

      return { error };
    } catch (error) {
      console.error('❌ AuthContext: Sign in exception:', error);
      const authError = error as AuthError;
      toast.error('An unexpected error occurred');
      return { error: authError };
    }
  };

  const signOut = async () => {
    console.log('🔍 AuthContext: Attempting comprehensive sign out');
    
    try {
      // Clear local state immediately
      clearAuthState();
      
      // Sign out from Supabase (this clears session and refresh tokens)
      const { error } = await supabase.auth.signOut({
        scope: 'global' // Sign out from all sessions
      });
      
      if (error) {
        console.error('❌ AuthContext: Sign out error:', error);
        toast.error(error.message);
      } else {
        console.log('✅ AuthContext: Sign out successful');
        toast.success('Successfully signed out!');
      }

      // Clear all local storage items (including Supabase auth tokens)
      try {
        // Clear specific Supabase keys
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && (key.startsWith('sb-') || key.includes('supabase'))) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach(key => localStorage.removeItem(key));
        
        // Clear session storage as well
        sessionStorage.clear();
        
        console.log('✅ AuthContext: Storage cleared successfully');
      } catch (storageError) {
        console.warn('⚠️ AuthContext: Could not clear storage:', storageError);
      }

      // Force page reload to ensure clean state
      setTimeout(() => {
        console.log('🔍 AuthContext: Forcing page reload for clean state');
        window.location.href = '/';
      }, 100);

    } catch (error) {
      console.error('❌ AuthContext: Sign out exception:', error);
      toast.error('Error signing out');
      
      // Even if there's an error, clear local state and reload
      clearAuthState();
      setTimeout(() => {
        window.location.href = '/';
      }, 100);
    }
  };

  const value = {
    user,
    profile,
    session,
    loading,
    signIn,
    signOut,
    refreshProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};