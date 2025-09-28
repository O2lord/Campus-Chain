import { SupabaseClient } from '@supabase/supabase-js';

export interface PollCandidateMetadata {
  id?: string;
  poll_pubkey: string;
  position_index: number;
  candidate_index: number;
  image_url: string;
  created_at?: string;
  updated_at?: string;
}

export async function addCandidateImageMetadata(
  metadata: Omit<PollCandidateMetadata, 'id' | 'created_at' | 'updated_at'>[],
  supabase: SupabaseClient
): Promise<PollCandidateMetadata[]> {
  const { data, error } = await supabase
    .from('poll_candidates_metadata')
    .insert(metadata)
    .select();

  if (error) {
    console.error('Error adding candidate image metadata:', error);
    throw new Error(`Failed to add candidate image metadata: ${error.message}`);
  }
  return data;
}

export async function getCandidateImageMetadataForPoll(
  pollPubkey: string,
  supabase: SupabaseClient
): Promise<PollCandidateMetadata[]> {
  const { data, error } = await supabase
    .from('poll_candidates_metadata')
    .select('*')
    .eq('poll_pubkey', pollPubkey)
    .order('position_index', { ascending: true })
    .order('candidate_index', { ascending: true });

  if (error) {
    console.error('Error fetching candidate image metadata:', error);
    throw new Error(`Failed to fetch candidate image metadata: ${error.message}`);
  }
  return data || [];
}
