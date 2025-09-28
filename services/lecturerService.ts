// src/services/lecturerService.ts
import { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from './supabase';

// Interface for the complete Lecturer data structure
export interface Lecturer {
  id: string;
  department: string;
  wallet: string | null; // ADDED: Wallet address
  created_at: string;
  updated_at: string;
}

// Interface for creating a new lecturer (including the required id field)
export interface CreateLecturerData {
  id: string; // MODIFIED: Made required to match Supabase user.id
  department: string;
  wallet?: string | null; // ADDED: Wallet address, made optional
}

// Interface for the response from Supabase operations
interface LecturerServiceResponse<T> {
  data: T | null;
  error: string | null;
}

/**
 * Creates a new lecturer record in the lecturers table
 * @param lecturerData - The lecturer data to insert (must include id that matches Supabase user.id)
 * @param client - Optional Supabase client instance (defaults to the global supabase instance)
 * @returns Promise with the created lecturer data or error
 */
export async function createLecturerDetails(
  lecturerData: CreateLecturerData,
  client: SupabaseClient = supabase
): Promise<LecturerServiceResponse<Lecturer>> {
  try {
    // Validate that required fields are provided
    if (!lecturerData.id || lecturerData.id.trim() === '') {
      return {
        data: null,
        error: 'Lecturer ID is required and must match the Supabase user ID'
      };
    }

    if (!lecturerData.department || lecturerData.department.trim() === '') {
      return {
        data: null,
        error: 'Department is required'
      };
    }

    const { data, error } = await client
      .from('lecturers')
      .insert([lecturerData])
      .select()
      .single();

    if (error) {
      console.error('Error creating lecturer:', error);
      
      // Handle specific error cases
      if (error.code === '23505') { // Unique constraint violation
        return {
          data: null,
          error: 'A lecturer with this ID already exists'
        };
      }

      return {
        data: null,
        error: `Failed to create lecturer: ${error.message}`
      };
    }

    return {
      data: data as Lecturer,
      error: null
    };
  } catch (error) {
    console.error('Unexpected error creating lecturer:', error);
    return {
      data: null,
      error: 'An unexpected error occurred while creating the lecturer'
    };
  }
}


/**
 * Fetches a single lecturer record by ID from the lecturers table
 * @param id - The UUID of the lecturer to fetch
 * @param client - Optional Supabase client instance (defaults to the global supabase instance)
 * @returns Promise with the lecturer data or error
 */

export async function getLecturerDetailsById(
  id: string,
  client: SupabaseClient = supabase
): Promise<LecturerServiceResponse<Lecturer>> {
  try {
    console.log(`[DEBUG] Fetching lecturer with ID: ${id}`);
    console.log(`[DEBUG] Client URL: ${process.env.NEXT_PUBLIC_SUPABASE_URL}`);

    
    // Validate that ID is provided
    if (!id || id.trim() === '') {
      console.error('[DEBUG] No lecturer ID provided');
      return {
        data: null,
        error: 'Lecturer ID is required'
      };
    }

    // First, let's check if the table exists and we can query it at all
    console.log('[DEBUG] Testing table access...');
    const { data: testData, error: testError } = await client
      .from('lecturers')
      .select('count')
      .limit(1);
    
    if (testError) {
      console.error('[DEBUG] Cannot access lecturers table:', testError);
      return {
        data: null,
        error: `Cannot access lecturers table: ${testError.message}`
      };
    }
    
    console.log('[DEBUG] Table accessible, proceeding with query...');

    // Query for the specific lecturer
    const { data, error } = await client
      .from('lecturers')
      .select('*')
      .eq('id', id);

    console.log(`[DEBUG] Query executed. Data:`, data);
    console.log(`[DEBUG] Query error:`, error);

    if (error) {
      console.error('[DEBUG] Database query failed:', error);
      return {
        data: null,
        error: `Database query failed: ${error.message}`
      };
    }

    // Check if any results were returned
    if (!data || data.length === 0) {
      console.warn(`[DEBUG] No lecturer found with ID: ${id}`);
      
      // Additional debugging: try to find any lecturers
      const { data: allLecturers } = await client
        .from('lecturers')
        .select('id, name')
        .limit(5);
      
      console.log('[DEBUG] Sample of available lecturers:', allLecturers);
      
      return {
        data: null,
        error: 'Lecturer not found'
      };
    }

    console.log(`[DEBUG] Successfully found lecturer:`, data[0]);
    
    return {
      data: data[0] as Lecturer,
      error: null
    };
  } catch (error) {
    console.error('[DEBUG] Unexpected error fetching lecturer:', error);
    return {
      data: null,
      error: 'An unexpected error occurred while fetching the lecturer'
    };
  }
}


/**
 * Updates a lecturer's wallet address
 * @param lecturerId - The UUID of the lecturer to update
 * @param walletAddress - The new wallet address
 * @param client - Optional Supabase client instance (defaults to the global supabase instance)
 * @returns Promise with the updated lecturer data or error
 */
export async function updateLecturerWallet(
  lecturerId: string,
  walletAddress: string,
  client: SupabaseClient = supabase
): Promise<LecturerServiceResponse<Lecturer>> {
  try {
    // Validate inputs
    if (!lecturerId || lecturerId.trim() === '') {
      return {
        data: null,
        error: 'Lecturer ID is required'
      };
    }

    if (!walletAddress || walletAddress.trim() === '') {
      return {
        data: null,
        error: 'Wallet address is required'
      };
    }

    const { data, error } = await client
      .from('lecturers')
      .update({ wallet: walletAddress, updated_at: new Date().toISOString() })
      .eq('id', lecturerId)
      .select()
      .single();

    if (error) {
      console.error('Error updating lecturer wallet:', error);
      
      // Handle specific error cases
      if (error.code === 'PGRST116') {
        return {
          data: null,
          error: 'Lecturer not found'
        };
      }

      return { 
        data: null, 
        error: `Failed to update lecturer wallet: ${error.message}` 
      };
    }

    return { data: data as Lecturer, error: null };
  } catch (error) {
    console.error('Unexpected error updating lecturer wallet:', error);
    return { 
      data: null, 
      error: 'An unexpected error occurred while updating the lecturer wallet' 
    };
  }
}