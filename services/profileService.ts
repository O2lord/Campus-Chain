import { SupabaseClient } from '@supabase/supabase-js';

export interface Profile {
  id: string;
  full_name: string;
  role: 'student' | 'lecturer' | 'admin';
  created_at?: string;
  updated_at?: string;
}

/**
 * Fetches a user's profile by their Supabase user ID.
 */
export async function getProfileById(userId: string, supabase: SupabaseClient): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, role, created_at, updated_at')
    .eq('id', userId)
    .single();

  if (error) {
    // If no rows are returned (e.g., profile not found), return null
    if (error.code === 'PGRST116') {
      return null;
    }
    console.error('Error fetching profile:', error.message, error);

    throw new Error(`Failed to fetch profile: ${error.message}`);
  }

  return data as Profile;
}