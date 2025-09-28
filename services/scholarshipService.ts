import { supabase } from './supabase';
import { PostgrestError } from '@supabase/supabase-js';

// Interface for scholarship application data
export interface ScholarshipApplication {
  id: string;
  scholarship_id: string;
  student_id: string;
  matric_no: string;
  attendance: number;
  latest_score: number | null;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  lecturer_response: string | null;
  created_at: string;
  updated_at: string;
}

// Interface for creating a new scholarship application
export interface CreateScholarshipApplicationData {
  scholarship_id: string;
  student_id: string;
  matric_no: string;
  attendance: number;
  latest_score?: number | null;
  reason: string;
}

// Interface for updating scholarship application (lecturer response)
export interface UpdateScholarshipApplicationData {
  status?: 'pending' | 'approved' | 'rejected';
  lecturer_response?: string;
}

// Interface for scholarship application with student details
export interface ScholarshipApplicationWithStudent extends ScholarshipApplication {
  student: {
    id: string;
    name: string; 
    wallet: string | null; 
  };
}


/**
 * Create a new scholarship application
 */
export const createScholarshipApplication = async (
  applicationData: CreateScholarshipApplicationData
): Promise<{ data: ScholarshipApplication | null; error: PostgrestError | null }> => {
  try {
    const { data, error } = await supabase
      .from('scholarship_applications')
      .insert([applicationData])
      .select()
      .single();

    return { data, error };
  } catch (error) {
    console.error('Error creating scholarship application:', error);
    return { data: null, error: error as PostgrestError };
  }
};

/**
 * Get scholarship applications by student ID
 */
export const getScholarshipApplicationsByStudent = async (
  studentId: string
): Promise<{ data: ScholarshipApplication[] | null; error: PostgrestError | null }> => {
  try {
    const { data, error } = await supabase
      .from('scholarship_applications')
      .select('*')
      .eq('student_id', studentId)
      .order('created_at', { ascending: false });

    return { data, error };
  } catch (error) {
    console.error('Error fetching student scholarship applications:', error);
    return { data: null, error: error as PostgrestError };
  }
};

/**
 * Get all scholarship applications for a specific scholarship (for lecturers)
 */
export const getScholarshipApplicationsByScholarshipId = async (
  scholarshipId: string
): Promise<{ data: ScholarshipApplicationWithStudent[] | null; error: PostgrestError | null }> => {
  try {
    const { data, error } = await supabase
      .from('scholarship_applications')
      .select(`
        *,
        student:students!scholarship_applications_student_id_fkey( 
          id,
          name,
          wallet
        )
      `)
      .eq('scholarship_id', scholarshipId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching scholarship applications:', error);
      return { data: null, error };
    }

    // Map the raw data to match the ScholarshipApplicationWithStudent interface
    // The embedded student data will now be under a property named 'student' from the Supabase response
    const mappedData = data?.map(app => {
      const studentDetails = app.student ? { // Access app.student now
        id: app.student.id,
        name: app.student.name,
        wallet: app.student.wallet,
      } : null;

      // Create a new object from 'app' and then delete the original embedded 'student' property
      // to avoid duplication, as we're re-assigning it.
      const appWithoutOriginalStudent = { ...app };
      delete appWithoutOriginalStudent.student; // Delete the original embedded 'student' property

      return {
        ...appWithoutOriginalStudent,
        student: studentDetails,
      };
    }) || [];

    return { data: mappedData as ScholarshipApplicationWithStudent[], error: null };
  } catch (error) {
    console.error('Error fetching scholarship applications:', error);
    return { data: null, error: error as PostgrestError };
  }
};

/**
 * Get all scholarship applications (for admin/lecturer overview)
 */
export const getAllScholarshipApplications = async (): Promise<{
  data: ScholarshipApplicationWithStudent[] | null;
  error: PostgrestError | null;
}> => {
  try {
    const { data, error } = await supabase
      .from('scholarship_applications')
      .select(`
        *,
        student:students!student_id (
          id,
          full_name,
          email
        )
      `)
      .order('created_at', { ascending: false });

    return { data, error };
  } catch (error) {
    console.error('Error fetching all scholarship applications:', error);
    return { data: null, error: error as PostgrestError };
  }
};

/**
 * Get a single scholarship application by ID
 */
export const getScholarshipApplicationById = async (
  applicationId: string
): Promise<{ data: ScholarshipApplicationWithStudent | null; error: PostgrestError | null }> => {
  try {
    const { data, error } = await supabase
      .from('scholarship_applications')
      .select(`
        *,
        student:students!student_id (
          id,
          full_name,
          email
        )
      `)
      .eq('id', applicationId)
      .single();

    return { data, error };
  } catch (error) {
    console.error('Error fetching scholarship application:', error);
    return { data: null, error: error as PostgrestError };
  }
};

/**
 * Update scholarship application (typically used by lecturers to respond)
 */
export const updateScholarshipApplication = async (
  applicationId: string,
  updateData: UpdateScholarshipApplicationData
): Promise<{ data: ScholarshipApplication | null; error: PostgrestError | null }> => {
  try {
    const { data, error } = await supabase
      .from('scholarship_applications')
      .update(updateData)
      .eq('id', applicationId)
      .select()
      .single();

    return { data, error };
  } catch (error) {
    console.error('Error updating scholarship application:', error);
    return { data: null, error: error as PostgrestError };
  }
};

/**
 * Delete a scholarship application (if needed)
 */
export const deleteScholarshipApplication = async (
  applicationId: string
): Promise<{ error: PostgrestError | null }> => {
  try {
    const { error } = await supabase
      .from('scholarship_applications')
      .delete()
      .eq('id', applicationId);

    return { error };
  } catch (error) {
    console.error('Error deleting scholarship application:', error);
    return { error: error as PostgrestError };
  }
};

/**
 * Get applications by status
 */
export const getScholarshipApplicationsByStatus = async (
  status: 'pending' | 'approved' | 'rejected'
): Promise<{ data: ScholarshipApplicationWithStudent[] | null; error: PostgrestError | null }> => {
  try {
    const { data, error } = await supabase
      .from('scholarship_applications')
      .select(`
        *,
        student:students!student_id (
          id,
          full_name,
          email
        )
      `)
      .eq('status', status)
      .order('created_at', { ascending: false });

    return { data, error };
  } catch (error) {
    console.error('Error fetching applications by status:', error);
    return { data: null, error: error as PostgrestError };
  }
};

/**
 * Check if student has already applied for a specific scholarship
 */
export const checkExistingApplication = async (
  scholarshipId: string,
  studentId: string
): Promise<{ data: ScholarshipApplication | null; error: PostgrestError | null }> => {
  try {
    const { data, error } = await supabase
      .from('scholarship_applications')
      .select('*')
      .eq('scholarship_id', scholarshipId)
      .eq('student_id', studentId)
      .single();

    return { data, error };
  } catch (error) {
    // If no application found, this is not an error for our use case
    if (error instanceof Error && 'code' in error && error.code === 'PGRST116') {
      return { data: null, error: null };
    }
    console.error('Error checking existing application:', error);
    return { data: null, error: error as PostgrestError };
  }
};

/**
 * Get application statistics
 */
export const getScholarshipApplicationStats = async (
  scholarshipId?: string
): Promise<{
  data: {
    total: number;
    pending: number;
    approved: number;
    rejected: number;
  } | null;
  error: PostgrestError | null;
}> => {
  try {
    let query = supabase
      .from('scholarship_applications')
      .select('status');

    if (scholarshipId) {
      query = query.eq('scholarship_id', scholarshipId);
    }

    const { data, error } = await query;

    if (error) throw error;

    const stats = {
      total: data.length,
      pending: data.filter(app => app.status === 'pending').length,
      approved: data.filter(app => app.status === 'approved').length,
      rejected: data.filter(app => app.status === 'rejected').length,
    };

    return { data: stats, error: null };
  } catch (error) {
    console.error('Error fetching application stats:', error);
    return { data: null, error: error as PostgrestError };
  }
};