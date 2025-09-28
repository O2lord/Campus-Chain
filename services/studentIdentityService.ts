import { supabase } from './supabase';
import { SupabaseClient } from '@supabase/supabase-js';

export interface Student {
  id?: string;
  set: string;
  name: string;
  matric_no: string;
  wallet: string | null;
  attendance: number;
  eligible: boolean | null;
  created_at?: string;
  updated_at?: string;
}

export async function addStudent(student: Omit<Student, 'id' | 'created_at' | 'updated_at' | 'eligible'>) {
  // Determine eligibility based on attendance (example logic)
  const eligible = student.attendance >= 75; // Example: 75% attendance for eligibility

  const { data, error } = await supabase
    .from('students')
    .insert({ ...student, eligible })
    .select();

  if (error) {
    console.error('Error adding student:', error);
    throw error;
  }
  return data[0];
}

// New function to update existing student
export async function updateStudent(id: string, updates: Partial<Omit<Student, 'id' | 'created_at' | 'updated_at'>>) {
  // Recalculate eligibility if attendance is being updated
  const updateData = { ...updates };
  if (updates.attendance !== undefined) {
    updateData.eligible = updates.attendance >= 75;
  }

  const { data, error } = await supabase
    .from('students')
    .update(updateData)
    .eq('id', id)
    .select();

  if (error) {
    console.error('Error updating student:', error);
    throw error;
  }
  return data[0];
}

export async function getStudents(): Promise<Student[]> {
  const { data, error } = await supabase
    .from('students')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching students:', error);
    return [];
  }
  return data;
}

export async function getDistinctSets(): Promise<string[]> {
  const { data, error } = await supabase
    .from('students')
    .select('set')
    .order('set');

  if (error) {
    console.error('Error fetching distinct sets:', error);
    return ['SET_100', 'SET_200', 'SET_300', 'SET_400', 'SET_500', 'SET_600']; // Default sets
  }
  
  // Get unique sets and add default ones if none exist
  const uniqueSets = [...new Set(data.map(item => item.set))];
  if (uniqueSets.length === 0) {
    return ['SET_100', 'SET_200', 'SET_300', 'SET_400', 'SET_500', 'SET_600'];
  }
  
  return uniqueSets;
}

export async function updateStudentWallet(id: string, wallet: string | null) {
  const { data, error } = await supabase
    .from('students')
    .update({ wallet })
    .eq('id', id)
    .select();

  if (error) {
    console.error('Error updating student wallet:', error);
    throw error;
  }
  return data[0];
}

export async function getStudentById(id: string, supabaseClient: SupabaseClient): Promise<Student | null> {
  const { data, error } = await supabaseClient
    .from('students')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') { // No rows returned
      return null;
    }
    console.error('Error fetching student by ID:', error);
    throw error;
  }
  return data;
}

