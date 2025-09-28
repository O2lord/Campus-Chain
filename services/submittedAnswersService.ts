import { supabase } from './supabase';

export interface SubmittedAnswer {
  id?: string;
  exam_pubkey: string;
  student_pubkey: string;
  sba_answers_data: number[]; // JSONB type
  short_answers_data: string[]; // JSONB type
  submitted_at?: string;
  created_at?: string;
  updated_at?: string;
}

export async function addSubmittedAnswers(answers: Omit<SubmittedAnswer, 'id' | 'created_at' | 'updated_at' | 'submitted_at'>) {
  const { data, error } = await supabase
    .from('submitted_answers')
    .insert({ ...answers, submitted_at: new Date().toISOString() })
    .select();

  if (error) {
    console.error('Error adding submitted answers:', error);
    throw error;
  }
  return data[0];
}

export async function getSubmittedAnswersForAttempt(examPubkey: string, studentPubkey: string): Promise<SubmittedAnswer | null> {
  const { data, error } = await supabase
    .from('submitted_answers')
    .select('*')
    .eq('exam_pubkey', examPubkey)
    .eq('student_pubkey', studentPubkey)
    .single();

  if (error && error.code !== 'PGRST116') { // PGRST116 means no rows found
    console.error('Error fetching submitted answers:', error);
    return null;
  }
  return data;
}

export async function getAllSubmittedAnswersForExam(examPubkey: string): Promise<SubmittedAnswer[]> {
  const { data, error } = await supabase
    .from('submitted_answers')
    .select('*')
    .eq('exam_pubkey', examPubkey)
    .order('submitted_at', { ascending: false });

  if (error) {
    console.error('Error fetching submitted answers for exam:', error);
    return [];
  }
  return data;
}