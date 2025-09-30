"use client";
import React, { useState, useMemo, useEffect } from 'react';
import { Search, Filter, DollarSign, FileText, Send, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { RefreshCw } from 'lucide-react';
import { PublicKey } from '@solana/web3.js';
import { BN } from '@coral-xyz/anchor';
import useScholarshipProgram from '@/hooks/useScholarship';
import { getStudentById } from '@/services/studentIdentityService';
import { getAttemptsByStudent } from '@/services/attemptService';
import { 
  createScholarshipApplication, 
  checkExistingApplication 
} from '@/services/scholarshipService';
import { useUser, useSupabaseClient } from '@supabase/auth-helpers-react';
import { ScholarshipRequestStatus } from '@/hooks/useScholarship';
import { useQuery } from '@tanstack/react-query';
// Type definitions that match the hook exactly
interface ProgramAccount<T> {
  publicKey: PublicKey;
  account: T;
}


// Use the exact same interfaces as defined in the hook
interface ScholarshipRequest {
  student: PublicKey;
  amount: BN;
  approvedAmount: BN;
  timestamp: BN;
  scholarshipReason: string;
  status: number;
  lecturerResponse: string;
}

interface ScholarshipAccount {
  seed: BN;
  lecturer: PublicKey;
  mint: PublicKey;
  totalAmount: BN;
  availableAmount: BN;
  scholarshipPurpose: string;
  scholarshipRequests: ScholarshipRequest[];
  maxRequestAmount: BN;
  bump: number;
}

type ScholarshipProgramAccount = ProgramAccount<ScholarshipAccount>;

// Interface for token metadata including decimals
interface TokenMetadata {
  decimals: number;
}

const StudentScholarshipPage = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all'); // all, available, closed
  const [selectedScholarship, setSelectedScholarship] = useState<ScholarshipProgramAccount | null>(null);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'browse' | 'myRequests'>('browse');
  const [requestForm, setRequestForm] = useState({
    amount: '',
    reason: ''
  });
  const [mintMetadata, setMintMetadata] = useState<Record<string, TokenMetadata>>({});
  const { 
    getScholarshipAccounts, 
    requestScholarship,
    ScholarshipRequestStatus: hookScholarshipRequestStatus,
    getMintInfo
  } = useScholarshipProgram();
  const { data: scholarships = [], isLoading, isError, error } = getScholarshipAccounts;
  
  // Add a manual refresh function
  const refreshScholarships = () => {
    if (getScholarshipAccounts.refetch) {
      getScholarshipAccounts.refetch();
    }
  };

  // Auto-refresh every 10 seconds to catch blockchain updates
  useEffect(() => {
    const interval = setInterval(() => {
      refreshScholarships();
    }, 10000);

    return () => clearInterval(interval);
  }, []);
  const supabaseClient = useSupabaseClient();
  const user = useUser();
  // Fetch mint metadata for a given mint address
  const fetchMintMetadata = async (mintAddress: string): Promise<TokenMetadata> => {
    // Check cache first
    if (mintMetadata[mintAddress]) {
      return mintMetadata[mintAddress];
    }

    try {
      const mintInfo = await getMintInfo(new PublicKey(mintAddress));
      const metadata: TokenMetadata = {
        decimals: mintInfo.decimals
      };
      
      // Cache the result
      setMintMetadata(prev => ({
        ...prev,
        [mintAddress]: metadata
      }));
      
      return metadata;
    } catch (error) {
      console.error(`Error fetching mint metadata for ${mintAddress}:`, error);
      // Return default values
      const defaultMetadata: TokenMetadata = {
        decimals: 6 // Default fallback
      };
      
      setMintMetadata(prev => ({
        ...prev,
        [mintAddress]: defaultMetadata
      }));
      
      return defaultMetadata;
    }
  };


  // Fetch student data using React Query
const { data: studentData, isLoading: isLoadingStudent } = useQuery({
  queryKey: ['studentData', user?.id],
  queryFn: () => getStudentById(user!.id, supabaseClient),
  enabled: !!user?.id && !!supabaseClient,
});

// Fetch student attempts to get latest score
const { data: attempts, isLoading: isLoadingAttempts } = useQuery({
  queryKey: ['student-attempts', user?.id],
  queryFn: () => getAttemptsByStudent(user!.id, supabaseClient),
  enabled: !!user?.id && !!supabaseClient
});

// Calculate latest score from attempts
const latestScore = useMemo(() => {
  if (!attempts) return null;
  
  const gradedAttempts = attempts.filter(attempt => 
    attempt.status === 'graded' && attempt.final_score !== null
  );

  if (gradedAttempts.length > 0) {
    // Get the most recent graded attempt
    const latestAttempt = gradedAttempts.sort((a, b) => 
      new Date(b.updated_at || b.created_at || 0).getTime() - 
      new Date(a.updated_at || a.created_at || 0).getTime()
    )[0];
    
    return latestAttempt.final_score;
  }
  
  return null;
}, [attempts]);

// Get all scholarship requests for the current user across all scholarships
const userRequests = useMemo(() => {
  if (!user?.id || !scholarships) return [];
  
  const requests: Array<{
    scholarship: ScholarshipProgramAccount;
    request: ScholarshipRequest;
    requestIndex: number;
  }> = [];
  
  scholarships.forEach(scholarship => {
    scholarship.account.scholarshipRequests.forEach((request, index) => {

      requests.push({
        scholarship,
        request,
        requestIndex: index
      });
    });
  });
  
  return requests;
}, [scholarships, user?.id]);

  // Fixed formatTokenAmount function that properly uses decimals
  const formatTokenAmount = async (amount: BN | number, mintAddress: string): Promise<string> => {
    try {
      if (!amount) return '0';
      const numAmount = typeof amount === 'object' && 'toNumber' in amount && typeof amount.toNumber === 'function' 
        ? amount.toNumber() 
        : Number(amount);
      
      const metadata = await fetchMintMetadata(mintAddress);
      const num = numAmount / (10 ** metadata.decimals);
      return num.toLocaleString(undefined, { 
        minimumFractionDigits: 0, 
        maximumFractionDigits: Math.min(metadata.decimals, 6) // Cap display decimals at 6
      });
    } catch (error) {
      console.error('Error formatting token amount:', error);
      // Fallback to 6 decimals
      const numAmount = typeof amount === 'object' && 'toNumber' in amount && typeof amount.toNumber === 'function' 
        ? amount.toNumber() 
        : Number(amount);
      const num = numAmount / (10 ** 6);
      return num.toLocaleString(undefined, { 
        minimumFractionDigits: 0, 
        maximumFractionDigits: 6
      });
    }
  };

  // Component to display formatted token amounts
  const FormattedTokenAmount = ({ 
    amount, 
    mintAddress, 
    className = "" 
  }: { 
    amount: BN | number; 
    mintAddress: string; 
    className?: string;
  }) => {
    const [formattedAmount, setFormattedAmount] = useState<string>('Loading...');

    useEffect(() => {
      formatTokenAmount(amount, mintAddress).then(setFormattedAmount);
    }, [amount, mintAddress]);

    return (
      <span className={className}>
        {formattedAmount}
      </span>
    );
  };

  // Component for input with async max value calculation
  const FormattedMaxInput = ({ 
    selectedScholarship, 
    requestForm, 
    setRequestForm 
  }: { 
    selectedScholarship: ScholarshipProgramAccount;
    requestForm: { amount: string; reason: string };
    setRequestForm: (form: { amount: string; reason: string }) => void;
  }) => {
    const [maxAmount, setMaxAmount] = useState<string>('Loading...');

    useEffect(() => {
      formatTokenAmount(selectedScholarship.account.maxRequestAmount, selectedScholarship.account.mint.toString())
        .then(setMaxAmount);
    }, [selectedScholarship]);

    return (
      <>
        <input
          type="number"
          step="any" 
          placeholder="Enter amount"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          value={requestForm.amount}
          onChange={(e) => setRequestForm({...requestForm, amount: e.target.value})}
          max={maxAmount !== 'Loading...' ? parseFloat(maxAmount) : undefined}
        />
        <p className="text-xs text-gray-500 mt-1">
          Maximum allowed per student: {maxAmount} tokens
        </p>
      </>
    );
  };

  // Helper function to get request status text
  const getRequestStatusText = (status: number): string => {
    switch (status) {
      case ScholarshipRequestStatus.PENDING:
        return 'Pending';
      case ScholarshipRequestStatus.APPROVED:
        return 'Approved';
      case ScholarshipRequestStatus.REJECTED:
        return 'Rejected';
      default:
        return 'Unknown';
    }
  };

  // Filter and search scholarships
  const filteredScholarships = useMemo(() => {
    if (!scholarships || scholarships.length === 0) return [];
    
    return scholarships.filter((scholarship) => {
      const matchesSearch = scholarship.account.scholarshipPurpose
        .toLowerCase()
        .includes(searchTerm.toLowerCase());
      
      const isAvailable = scholarship.account.availableAmount.gt(new BN(0));
      
      if (filterStatus === 'available' && !isAvailable) return false;
      if (filterStatus === 'closed' && isAvailable) return false;
      
      return matchesSearch;
    });
  }, [scholarships, searchTerm, filterStatus]);

const handleRequestScholarship = async () => {
  if (!selectedScholarship || !requestForm.amount || !requestForm.reason || !studentData || !user?.id) {
    alert('Please fill in all required fields and ensure student data is loaded');
    return;
  }

  try {
    // Check if student has already applied for this scholarship
    const { data: existingApp } = await checkExistingApplication(
      selectedScholarship.publicKey.toString(),
      user.id
    );

    if (existingApp) {
      alert('You have already applied for this scholarship.');
      return;
    }

    // Create scholarship application in Supabase
    const { data: application, error: appError } = await createScholarshipApplication({
      scholarship_id: selectedScholarship.publicKey.toString(),
      student_id: user.id,
      matric_no: studentData.matric_no,
      attendance: studentData.attendance,
      latest_score: latestScore,
      reason: requestForm.reason
    });

    if (appError) {
      throw new Error(`Failed to create application: ${appError.message}`);
    }

    // Submit the on-chain scholarship request (without matric_no, attendance, score)
    const signature = await requestScholarship.mutateAsync({
      scholarship: selectedScholarship.publicKey,
      amount: parseFloat(requestForm.amount),
      scholarshipReason: requestForm.reason
    });
    
    setShowRequestModal(false);
    setRequestForm({ amount: '', reason: '' });
    setSelectedScholarship(null);
    alert(`Scholarship request submitted successfully! Application ID: ${application?.id}, Transaction: ${signature}`);
  } catch (err: unknown) {
    console.error('Error submitting request:', err);
    const errorMessage = err instanceof Error ? err.message : 'Please try again.';
    alert(`Failed to submit request: ${errorMessage}`);
  }
};


  const getStatusColor = (availableAmount: BN): string => {
    try {
      const hasAmount = availableAmount && 
        typeof availableAmount.gt === 'function' && 
        availableAmount.gt(new BN(0));
      return hasAmount ? 'text-green-600' : 'text-red-600';
    } catch {
      return 'text-red-600';
    }
  };

  const getStatusText = (availableAmount: BN): string => {
    try {
      const hasAmount = availableAmount && 
        typeof availableAmount.gt === 'function' && 
        availableAmount.gt(new BN(0));
      return hasAmount ? 'Available' : 'Fully Allocated';
    } catch {
      return 'Fully Allocated';
    }
  };

  const getStatusIcon = (availableAmount: BN) => {
    try {
      const hasAmount = availableAmount && 
        typeof availableAmount.gt === 'function' && 
        availableAmount.gt(new BN(0));
      return hasAmount ? CheckCircle : XCircle;
    } catch {
      return XCircle;
    }
  };

if (isLoading || isLoadingStudent || isLoadingAttempts) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
        <p className="text-gray-600">
          {isLoading ? 'Loading scholarships...' : 'Loading student data...'}
        </p>
      </div>
    </div>
  );
}


  if (isError) {
    const errorMessage = error instanceof Error ? error.message : 'There was an error loading the scholarship data.';
    
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Failed to load scholarships</h3>
          <p className="text-gray-600 mb-4">
            {errorMessage}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!user) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
        <p className="text-gray-600">Loading user data...</p>
      </div>
    </div>
  );
}


  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                Available Scholarships
              </h1>
              <p className="text-gray-600">
                Browse and apply for scholarship opportunities that match your needs
              </p>
            </div>
            <button
              onClick={refreshScholarships}
              disabled={isLoading}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 hover:scale-105 disabled:opacity-50 disabled:hover:scale-100 transition-all duration-200 active:scale-95"
            >
              <RefreshCw className={`h-4 w-4 transition-transform duration-500 ${isLoading ? 'animate-spin' : 'hover:rotate-180'}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Search and Filter Bar */}
        {/* Tab Navigation */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-8">
          <div className="border-b border-gray-200">
            <nav className="flex space-x-8 px-6">
              <button
                onClick={() => setActiveTab('browse')}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'browse'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Browse Scholarships
              </button>
              <button
                onClick={() => setActiveTab('myRequests')}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'myRequests'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                My Requests
                {userRequests.length > 0 && (
                  <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-600 text-xs rounded-full">
                    {userRequests.length}
                  </span>
                )}
              </button>
            </nav>
          </div>
          
          {/* Search and Filter - only show on browse tab */}
          {activeTab === 'browse' && (
            <div className="p-6">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search scholarships by purpose or description..."
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <div className="relative">
                  <Filter className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <select
                    className="pl-10 pr-8 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none bg-white"
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                  >
                    <option value="all">All Scholarships</option>
                    <option value="available">Available Only</option>
                    <option value="closed">Fully Allocated</option>
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Tab Content */}
        {activeTab === 'browse' && (
          <>
            {/* Scholarship Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              {filteredScholarships.map((scholarship) => {
                const StatusIcon = getStatusIcon(scholarship.account.availableAmount);
                
                // Safe calculation for utilization
                let utilization = 0;
                try {
                  const totalNum = scholarship.account.totalAmount.toNumber();
                  const availableNum = scholarship.account.availableAmount.toNumber();
                  utilization = totalNum > 0 ? ((totalNum - availableNum) / totalNum) * 100 : 0;
                } catch (error) {
                  console.error('Error calculating utilization:', error);
                  utilization = 0;
                }

                const isAvailable = scholarship.account.availableAmount.gt(new BN(0));
                
                return (
                  <div
                    key={scholarship.publicKey.toString()}
                    className="bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow duration-200"
                  >
                    <div className="p-6">
                      {/* Status Badge */}
                      <div className="flex items-center justify-between mb-4">
                        <div className={`flex items-center gap-2 ${getStatusColor(scholarship.account.availableAmount)}`}>
                          <StatusIcon className="h-4 w-4" />
                          <span className="text-sm font-medium">
                            {getStatusText(scholarship.account.availableAmount)}
                          </span>
                        </div>
                        <span className="text-xs text-gray-500">
                          ID: {scholarship.account.seed.toString()}
                        </span>
                      </div>

                      {/* Scholarship Details */}
                      <div className="space-y-3">
                          <div className="flex items-start gap-3">
                          <FileText className="h-4 w-4 text-gray-400 mt-1 flex-shrink-0" />
                          <div>
                            <p className="text-sm text-gray-700 line-clamp-3">
                              {scholarship.account.scholarshipPurpose}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <DollarSign className="h-4 w-4 text-gray-400 flex-shrink-0" />
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              <FormattedTokenAmount 
                                amount={scholarship.account.availableAmount}
                                mintAddress={scholarship.account.mint.toString()}
                              /> / <FormattedTokenAmount 
                                amount={scholarship.account.totalAmount}
                                mintAddress={scholarship.account.mint.toString()}
                              />
                            </p>
                            <p className="text-xs text-gray-600">Available / Total</p>
                          </div>
                        </div>
                        {/* Progress Bar */}
                        <div className="space-y-1">
                          <div className="flex justify-between text-xs text-gray-600">
                            <span>Utilization</span>
                            <span>{utilization.toFixed(1)}%</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full transition-all duration-300 ${
                                utilization === 100 ? 'bg-red-500' : utilization > 80 ? 'bg-yellow-500' : 'bg-green-500'
                              }`}
                              style={{ width: `${utilization}%` }}
                            ></div>
                          </div>
                        </div>
                      </div>

                      {/* Action Button */}
                      <div>
                        <button
                          onClick={() => {
                            setSelectedScholarship(scholarship);
                            setShowRequestModal(true);
                          }}
                          disabled={!isAvailable}
                          className={`w-full mt-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                            !isAvailable
                              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                              : 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2'
                          }`}
                        >
                          {!isAvailable ? 'Fully Allocated' : 'Apply Now'}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Empty State for Browse */}
            {filteredScholarships.length === 0 && (
              <div className="text-center py-12">
                <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No scholarships found</h3>
                <p className="text-gray-600">
                  {searchTerm || filterStatus !== 'all' 
                    ? 'Try adjusting your search or filter criteria'
                    : 'No scholarship opportunities are currently available'}
                </p>
              </div>
            )}
          </>
        )}

        {/* My Requests Tab Content */}
        {activeTab === 'myRequests' && (
          <div className="space-y-6">
            {userRequests.length === 0 ? (
              <div className="text-center py-12">
                <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No requests submitted yet</h3>
                <p className="text-gray-600 mb-4">
                  You haven&apos;t submitted any scholarship requests yet.
                </p>
                <button
                  onClick={() => setActiveTab('browse')}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Browse Scholarships
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {userRequests.map(({ scholarship, request, requestIndex }) => (
                  <div
                    key={`${scholarship.publicKey.toString()}-${requestIndex}`}
                    className="bg-white rounded-lg shadow-sm border border-gray-200"
                  >
                    <div className="p-6">
                      {/* Status Badge */}
                      <div className="flex items-center justify-between mb-4">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          request.status === ScholarshipRequestStatus.PENDING ? 'bg-yellow-100 text-yellow-800' :
                          request.status === ScholarshipRequestStatus.APPROVED ? 'bg-green-100 text-green-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {getRequestStatusText(request.status)}
                        </span>
                        <span className="text-xs text-gray-500">
                          ID: {scholarship.account.seed.toString()}
                        </span>
                      </div>

                      {/* Request Details */}
                      <div className="space-y-3">
                        <div>
                          <p className="text-sm text-gray-600">Scholarship Purpose</p>
                          <p className="text-sm font-medium text-gray-900 line-clamp-2">
                            {scholarship.account.scholarshipPurpose}
                          </p>
                        </div>
                        
                        {/* Only show approved amount if request is approved and amount > 0 */}
                        {request.status === ScholarshipRequestStatus.APPROVED && request.approvedAmount && request.approvedAmount.gt(new BN(0)) && (
                          <div>
                            <p className="text-sm text-gray-600">Approved Amount</p>
                            <p className="text-lg font-semibold text-green-600">
                              <FormattedTokenAmount 
                                amount={request.approvedAmount}
                                mintAddress={scholarship.account.mint.toString()}
                              />
                            </p>
                            {/* Show comparison if approved amount differs from requested */}
                            {!request.approvedAmount.eq(request.amount) && (
                              <p className="text-xs text-gray-500">
                                (Requested: <FormattedTokenAmount 
                                  amount={request.amount}
                                  mintAddress={scholarship.account.mint.toString()}
                                />)
                              </p>
                            )}
                          </div>
                        )}

                        <div>
                          <p className="text-sm text-gray-600">Request Date</p>
                          <p className="text-sm text-gray-900">
                            {new Date(request.timestamp.toNumber() * 1000).toLocaleDateString()}
                          </p>
                        </div>

                        <div>
                          <p className="text-sm text-gray-600">Your Reason</p>
                          <p className="text-sm text-gray-900 bg-gray-50 p-2 rounded border line-clamp-3">
                            {request.scholarshipReason}
                          </p>
                        </div>

                        {request.lecturerResponse && (
                          <div>
                            <p className="text-sm text-gray-600">Lecturer Response</p>
                            <p className="text-sm text-gray-900 bg-blue-50 p-2 rounded border">
                              {request.lecturerResponse}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Request Modal - simplified since we removed the tabs */}
        {showRequestModal && selectedScholarship && (
          <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
              <h3 className="text-xl font-bold text-gray-900 mb-4">
                Apply for Scholarship
              </h3>
              
              <div className="space-y-4">
                {/* Scholarship Info */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm text-gray-600 mb-2">Available Amount:</p>
                  <p className="text-lg font-semibold text-green-600">
                    <FormattedTokenAmount 
                      amount={selectedScholarship.account.availableAmount}
                      mintAddress={selectedScholarship.account.mint.toString()}
                    /> tokens
                  </p>
                  <p className="text-xs text-gray-500 mt-2">
                    Scholarship ID: {selectedScholarship.account.seed.toString()}
                  </p>
                </div>

                {/* Current Student Info */}
                {studentData && (
                  <div className="bg-blue-50 rounded-lg p-4">
                    <p className="text-sm font-medium text-blue-900 mb-2">Your Information:</p>
                    <div className="space-y-1 text-xs text-blue-700">
                      <div className="flex justify-between">
                        <span>Matric No:</span>
                        <span className="font-medium">{studentData.matric_no}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Attendance:</span>
                        <span className="font-medium">{studentData.attendance}%</span>
                      </div>
                      {latestScore !== null && (
                        <div className="flex justify-between">
                          <span>Latest Score:</span>
                          <span className="font-medium">{latestScore}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Request Form */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Requested Amount *
                  </label>
                  <FormattedMaxInput 
                    selectedScholarship={selectedScholarship}
                    requestForm={requestForm}
                    setRequestForm={setRequestForm}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Reason for Request *
                  </label>
                  <textarea
                    rows={4}
                    placeholder="Explain why you need this scholarship and how you plan to use it..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                    value={requestForm.reason}
                    onChange={(e) => setRequestForm({...requestForm, reason: e.target.value})}
                    maxLength={300}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {requestForm.reason.length}/300 characters
                  </p>
                </div>
              </div>

              {/* Modal Actions */}
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    setShowRequestModal(false);
                    setRequestForm({ amount: '', reason: '' });
                    setSelectedScholarship(null);
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  disabled={requestScholarship.isPending}
                >
                  Cancel
                </button>
                <button
                  onClick={handleRequestScholarship}
                  disabled={requestScholarship.isPending || !requestForm.amount || !requestForm.reason}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                >
                  {requestScholarship.isPending ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Submitting...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      Submit Request
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default StudentScholarshipPage;