'use client';

import { useState, useEffect } from 'react';
import { useUser } from '@supabase/auth-helpers-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Loader2, User, Hash, Save, Wallet, } from 'lucide-react';
import { useWallet } from '@solana/wallet-adapter-react';
import { supabase } from '@/services/supabase';
import { getStudentById, updateStudent } from '@/services/studentIdentityService';

// Validation schema
const profileSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100, 'Name is too long'),
  matric_no: z.string().min(3, 'Matric number must be at least 3 characters').max(20, 'Matric number is too long'),
  wallet: z.string().optional().refine(
    (val) => !val || val.length === 0 || /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(val),
    'Wallet address must be a valid Solana address'
  ),
});

type ProfileFormData = z.infer<typeof profileSchema>;

export default function StudentProfilePage() {
  const user = useUser();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const { publicKey, connected, connect, connecting } = useWallet();

  // Fetch student data
  const { data: student, isLoading, error } = useQuery({
    queryKey: ['student', user?.id],
    queryFn: () => {
      if (!user?.id) throw new Error('No user ID');
      return getStudentById(user.id, supabase);
    },
    enabled: !!user?.id,
  });

  // Form setup
  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isDirty },
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: student?.name || '',
      matric_no: student?.matric_no || '',
      wallet: student?.wallet || '',
    },
  });

  const walletValue = watch('wallet');

  // Reset form when student data changes
  useEffect(() => {
    if (student) {
      reset({
        name: student.name,
        matric_no: student.matric_no,
        wallet: student.wallet || '',
      });
    }
  }, [student, reset]);

  // Handle wallet connection
  const handleWalletConnect = async () => {
    try {
      if (connected && publicKey) {
        // If already connected, use the current wallet
        setValue('wallet', publicKey.toBase58());
        toast.success('Wallet address added successfully!');
      } else {
        // Connect wallet
        await connect();
      }
    } catch (error) {
      console.error('Wallet connection error:', error);
      toast.error('Failed to connect wallet');
    }
  };

  // Update form when wallet connects
  useEffect(() => {
    if (connected && publicKey) {
      setValue('wallet', publicKey.toBase58());
      toast.success('Wallet connected successfully!');
    }
  }, [connected, publicKey, setValue]);

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: (data: ProfileFormData) => {
      if (!user?.id) throw new Error('No user ID');
      return updateStudent(user.id, {
        name: data.name,
        matric_no: data.matric_no,
        wallet: data.wallet || null,
      });
    },
    onSuccess: () => {
      toast.success('Profile updated successfully!');
      setIsEditing(false);
      queryClient.invalidateQueries({ queryKey: ['student', user?.id] });
    },
    onError: (error) => {
      console.error('Update error:', error);
      toast.error('Failed to update profile. Please try again.');
    },
  });

  const onSubmit = (data: ProfileFormData) => {
    updateMutation.mutate(data);
  };

  const handleCancel = () => {
    reset({
      name: student?.name || '',
      matric_no: student?.matric_no || '',
      wallet: student?.wallet || '',
    });
    setIsEditing(false);
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading user data...</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading profile...</p>
        </div>
      </div>
    );
  }

  if (error || !student) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md">
            <h2 className="text-red-800 font-semibold mb-2">Profile Not Found</h2>
            <p className="text-red-600 text-sm">
              We couldn&apos;t find your student profile. Please contact support if this issue persists.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-2xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow-sm border">
          {/* Header */}
          <div className="border-b border-gray-200 px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                  <User className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h1 className="text-xl font-semibold text-gray-900">Student Profile</h1>
                  <p className="text-sm text-gray-600">Manage your personal information</p>
                </div>
              </div>
              {!isEditing && (
                <button
                  onClick={() => setIsEditing(true)}
                  className="px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                >
                  Edit Profile
                </button>
              )}
            </div>
          </div>

          {/* Student Info Banner */}
          <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-700">Set: {student.set}</p>
                <p className="text-sm text-gray-600">Attendance: {student.attendance}%</p>
              </div>
              <div className="text-right">
                <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                  student.eligible 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-red-100 text-red-800'
                }`}>
                  {student.eligible ? 'Eligible' : 'Not Eligible'}
                </div>
              </div>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-6">
            {/* Name Field */}
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                <User className="w-4 h-4 inline mr-1" />
                Full Name
              </label>
              <input
                {...register('name')}
                type="text"
                id="name"
                disabled={!isEditing}
                className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                  !isEditing ? 'bg-gray-50 cursor-not-allowed' : ''
                } ${errors.name ? 'border-red-300 focus:ring-red-500 focus:border-red-500' : ''}`}
                placeholder="Enter your full name"
              />
              {errors.name && (
                <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>
              )}
            </div>

            {/* Matric Number Field */}
            <div>
              <label htmlFor="matric_no" className="block text-sm font-medium text-gray-700 mb-2">
                <Hash className="w-4 h-4 inline mr-1" />
                Matric Number
              </label>
              <input
                {...register('matric_no')}
                type="text"
                id="matric_no"
                disabled={!isEditing}
                className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                  !isEditing ? 'bg-gray-50 cursor-not-allowed' : ''
                } ${errors.matric_no ? 'border-red-300 focus:ring-red-500 focus:border-red-500' : ''}`}
                placeholder="Enter your matric number"
              />
              {errors.matric_no && (
                <p className="mt-1 text-sm text-red-600">{errors.matric_no.message}</p>
              )}
            </div>

            {/* Wallet Address Field */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label htmlFor="wallet" className="block text-sm font-medium text-gray-700">
                  <Wallet className="w-4 h-4 inline mr-1" />
                  Solana Wallet Address (Optional)
                </label>
                {isEditing && (
                  <button
                    type="button"
                    onClick={handleWalletConnect}
                    disabled={connecting}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-purple-50 text-purple-700 border border-purple-200 rounded-lg hover:bg-purple-100 focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {connecting ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Wallet className="w-3 h-3" />
                    )}
                    {connected ? 'Use Connected Wallet' : 'Connect & Use Wallet'}
                  </button>
                )}
              </div>

              
              <input
                {...register('wallet')}
                type="text"
                id="wallet"
                disabled={!isEditing}
                className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                  !isEditing ? 'bg-gray-50 cursor-not-allowed' : ''
                } ${errors.wallet ? 'border-red-300 focus:ring-red-500 focus:border-red-500' : ''}`}
                placeholder="Solana wallet address (e.g., 7xKXtg2CW87d9wDpxhCXzL1bkz...)"
              />
              {errors.wallet && (
                <p className="mt-1 text-sm text-red-600">{errors.wallet.message}</p>
              )}
              <div className="mt-1 space-y-1">
                <p className="text-xs text-gray-500">
                  You can either connect your Solana wallet using the button above or manually enter the address
                </p>
                {walletValue && (
                  <p className="text-xs text-green-600">
                    ✓ Current address: {walletValue.slice(0, 8)}...{walletValue.slice(-6)}
                  </p>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            {isEditing && (
              <div className="flex items-center gap-3 pt-4 border-t border-gray-200">
                <button
                  type="submit"
                  disabled={updateMutation.isPending || !isDirty}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {updateMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
                </button>
                <button
                  type="button"
                  onClick={handleCancel}
                  disabled={updateMutation.isPending}
                  className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Cancel
                </button>
              </div>
            )}
          </form>
        </div>

        {/* Additional Info */}
        <div className="mt-6 text-center text-xs text-gray-500">
          <p>Your profile information is used for identification and transactions.</p>
          <p>Contact support if you need help updating your details.</p>
        </div>
      </div>
    </div>
  );
}