import { useEffect, useState } from 'react';
import { useSupabaseClient, useUser } from '@supabase/auth-helpers-react';
import { Profile, getProfileById } from '@/services/profileService';

export const useAuth = () => {
  const user = useUser();
  const supabase = useSupabaseClient();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      getProfileById(user.id, supabase)
        .then(setProfile)
        .catch(console.error)
        .finally(() => setLoading(false));
    } else {
      setProfile(null);
      setLoading(false);
    }
  }, [user, supabase]);

  return {
    user,
    profile,
    loading,
    isAuthenticated: !!user,
    role: profile?.role,
  };
};