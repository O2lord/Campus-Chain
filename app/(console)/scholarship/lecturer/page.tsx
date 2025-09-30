"use client";

import React, { useState, useEffect } from 'react';
import { PublicKey, Connection } from '@solana/web3.js';
import { useWallet } from '@solana/wallet-adapter-react';
import { 
  Card, 
  CardContent,
  CardDescription, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { 
  Button 
} from '@/components/ui/button';
import { 
  Input 
} from '@/components/ui/input';
import { 
  Textarea 
} from '@/components/ui/textarea';
import { 
  Badge 
} from '@/components/ui/badge';
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from '@/components/ui/tabs';
import { toast } from 'sonner';
import { 
  Plus, 
  Check, 
  X, 
  DollarSign, 
  Clock, 
  Wallet,
  BookOpen
} from 'lucide-react';
import { TokenSelect, TokenInfo } from '@/components/ui/token-select';
import useScholarshipProgram from '@/hooks/useScholarship';
import { BN } from '@coral-xyz/anchor';
import { 
  getScholarshipApplicationsByScholarshipId,
  updateScholarshipApplication,
  ScholarshipApplicationWithStudent 
} from '@/services/scholarshipService';
import { useSupabaseClient, useUser } from '@supabase/auth-helpers-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';


interface LoadingStates {
  creating?: boolean;
  [key: string]: boolean | undefined;
}

// Interface for token metadata including decimals
interface TokenMetadata {
  symbol?: string;
  decimals: number;
  name?: string;
}

export default function LecturerScholarshipDashboard() {
  const { publicKey, connected } = useWallet();
  const {
    createScholarshipPool,
    approveScholarship,
    rejectScholarship,
    withdrawFunds,
    getScholarshipAccounts,
    getGlobalScholarshipState,
    ScholarshipRequestStatus,
    getMintInfo,
    program
  } = useScholarshipProgram();

  const [activeTab, setActiveTab] = useState('create');
  const supabaseClient = useSupabaseClient();
  const user = useUser();
  const queryClient = useQueryClient();
  // Create scholarship form state
  const [createForm, setCreateForm] = useState({
    amount: '',
    maxRequestAmount: '',
    selectedToken: null as TokenInfo | null,
    scholarshipPurpose: ''
  });

  // Response forms for approve/reject
  const [responseForm, setResponseForm] = useState({
    scholarshipId: '',
    requestIndex: -1,
    supabaseApplicationId: '',
    approvedAmount: '',
    response: '',
    action: ''
  });

  //withdraw form
  const [withdrawForm, setWithdrawForm] = useState({
    scholarshipId: '',
    amount: ''
  });

  const [showWithdrawModal, setShowWithdrawModal] = useState(false);

  const [showResponseModal, setShowResponseModal] = useState(false);
  const [loadingStates, setLoadingStates] = useState<LoadingStates>({});
  const [tokens, setTokens] = useState<TokenInfo[]>([]);
  
  // Store mint metadata to avoid repeated fetches
  const [mintMetadata, setMintMetadata] = useState<Record<string, TokenMetadata>>({});
  
  const allowedMints = process.env.NEXT_PUBLIC_ALLOWED_MINTS?.split(",") || [];
  const scholarships = getScholarshipAccounts?.data || [];
  const globalState = getGlobalScholarshipState?.data;

  // Filter scholarships created by current lecturer
  const lecturerScholarships = scholarships.filter(
    scholarship => scholarship.account.lecturer.equals(publicKey || new PublicKey('11111111111111111111111111111111'))
  );

  // Get all pending requests for lecturer's scholarships
 const { data: allApplications = [], isLoading: isLoadingApplications } = useQuery({
  queryKey: ['scholarship-applications', lecturerScholarships.map(s => s.publicKey.toString())],
  queryFn: async () => {
    const applications = [];
    for (const scholarship of lecturerScholarships) {
      const { data } = await getScholarshipApplicationsByScholarshipId(scholarship.publicKey.toString());
      if (data) {
        applications.push(...data.map(app => ({
          ...app,
          scholarshipPubkey: scholarship.publicKey
        })));
      }
    }
    return applications;
  },
  enabled: lecturerScholarships.length > 0 && !!supabaseClient
});

// Filter pending applications
const pendingApplications = allApplications.filter(app => app.status === 'pending');

const { data: approvedApplications, isLoading: loadingApproved } = useQuery({
  queryKey: ['approved-scholarships', lecturerScholarships.map(s => s.publicKey.toString())],
  queryFn: async () => {
    console.log('Fetching approved applications...');
    console.log('lecturerScholarships:', lecturerScholarships);
    
    const applications = [];
    for (const scholarship of lecturerScholarships) {
      const { data } = await getScholarshipApplicationsByScholarshipId(scholarship.publicKey.toString());
      if (data) {
        applications.push(...data.map(app => ({
          ...app,
          scholarshipPubkey: scholarship.publicKey
        })));
      }
    }
    
    console.log('All applications for lecturer:', applications);
    
    // Filter for approved applications only
    const approvedApps = applications.filter(app => app.status === 'approved');
    console.log('Approved applications:', approvedApps);
    
    return approvedApps;
  },
  enabled: lecturerScholarships.length > 0 && !!supabaseClient
});

  const fetchMintMetadata = async (mintAddress: string): Promise<TokenMetadata> => {
    // Check cache first
    if (mintMetadata[mintAddress]) {
      return mintMetadata[mintAddress];
    }

    try {
      const mintInfo = await getMintInfo(new PublicKey(mintAddress));
      const metadata: TokenMetadata = {
        decimals: mintInfo.decimals,
        symbol: '' // Don't use truncated address as symbol
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
        decimals: 6, // Default fallback
        symbol: '' // Don't use truncated address as symbol
      };
      
      setMintMetadata(prev => ({
        ...prev,
        [mintAddress]: defaultMetadata
      }));
      
      return defaultMetadata;
    }
  };

  const formatTokenAmount = async (amount: number, mintAddress: string): Promise<string> => {
    try {
      const metadata = await fetchMintMetadata(mintAddress);
      const num = amount / (10 ** metadata.decimals);
      return num.toLocaleString(undefined, { 
        minimumFractionDigits: 0, 
        maximumFractionDigits: Math.min(metadata.decimals, 6) // Cap display decimals at 6
      });
    } catch (error) {
      console.error('Error formatting token amount:', error);
      // Fallback to 6 decimals
      const num = amount / (10 ** 6);
      return num.toLocaleString(undefined, { 
        minimumFractionDigits: 0, 
        maximumFractionDigits: 6
      });
    }
  };

  
  const FormattedTokenAmount = ({ 
    amount, 
    mintAddress, 
    className = "" 
  }: { 
    amount: number; 
    mintAddress: string; 
    className?: string;
  }) => {
    const [formattedAmount, setFormattedAmount] = useState<string>('Loading...');

    useEffect(() => {
      formatTokenAmount(amount, mintAddress).then(setFormattedAmount);
    }, [amount, mintAddress]);

    const symbol = getTokenSymbol(mintAddress);

    return (
      <span className={className}>
        {formattedAmount}{symbol ? ` ${symbol}` : ''}
      </span>
    );
  };

 const formatDate = (timestamp: string | number): string => {
  if (typeof timestamp === 'string') {
    // Handle ISO string from Supabase
    return new Date(timestamp).toLocaleDateString();
  } else {
    // Handle Unix timestamp
    return new Date(timestamp * 1000).toLocaleString();
  }
};

  const handleCreateFormChange = (field: keyof typeof createForm, value: string | TokenInfo | null) => {
    setCreateForm(prev => ({ ...prev, [field]: value }));
  };

  const handleTokenChange = (token: TokenInfo | null) => {
    handleCreateFormChange('selectedToken', token);
  };

  const handleMaxClick = (balance: number) => {
    handleCreateFormChange('amount', balance.toString());
  };

  const handleHalfClick = (balance: number) => {
    handleCreateFormChange('amount', (balance / 2).toString());
  };

  const handleCreateScholarship = async () => {
    if (!createForm.amount || !createForm.scholarshipPurpose || !createForm.selectedToken) {
      return;
    }

    try {
      setLoadingStates(prev => ({ ...prev, creating: true }));
      
      await createScholarshipPool.mutateAsync({
        amount: parseFloat(createForm.amount),
        maxRequestAmount: parseFloat(createForm.maxRequestAmount),
        mint: createForm.selectedToken.mint,
        scholarshipPurpose: createForm.scholarshipPurpose
      });

      // Reset form
      setCreateForm({
        amount: '',
        maxRequestAmount: '', 
        selectedToken: null,
        scholarshipPurpose: ''
      });
      
      setActiveTab('manage');
    } catch (error) {
      console.error('Failed to create scholarship:', error);
    } finally {
      setLoadingStates(prev => ({ ...prev, creating: false }));
    }
  };

 const handleRequestAction = async (application: ScholarshipApplicationWithStudent, action: string) => { 
  let solanaScholarshipAccount;
  try {
    solanaScholarshipAccount = await program.account.scholarship.fetch(new PublicKey(application.scholarship_id));
  } catch (error) {
    console.error("Error fetching Solana scholarship account:", error);
    toast.error("Could not fetch scholarship details from blockchain. Please try again.");
    return;
  }

  if (!solanaScholarshipAccount) {
    console.error("Solana scholarship account not found for application:", application);
    toast.error("Could not find scholarship details on blockchain.");
    return;
  }

  // Find the index of the request within the Solana scholarship's requests array
  const solanaRequestIndex = solanaScholarshipAccount.scholarshipRequests.findIndex(
    (req) => req.student.toString() === application.student?.wallet && req.scholarshipReason === application.reason
  );

  if (solanaRequestIndex === -1) {
    console.error("Matching Solana scholarship request not found for application:", application);
    toast.error("Matching request not found on blockchain. It might have been processed already or student wallet/reason mismatch.");
    return;
  }

  // Verify the status of the found request on-chain
  const onChainRequest = solanaScholarshipAccount.scholarshipRequests[solanaRequestIndex];
  if (onChainRequest.status !== ScholarshipRequestStatus.PENDING) {
    console.error("On-chain request is not in pending status:", onChainRequest.status);
    toast.error("This request has already been processed on the blockchain.");
    return;
  }

    const requestedAmount = onChainRequest.amount.toNumber() / (10 ** (await getMintInfo(solanaScholarshipAccount.mint)).decimals);


  setResponseForm({
    scholarshipId: application.scholarship_id,
    requestIndex: solanaRequestIndex,
    supabaseApplicationId: application.id,
    approvedAmount: requestedAmount.toString(),
    response: '',
    action
  });
  setShowResponseModal(true);
};


  const handleSubmitResponse = async () => {
    if (!responseForm.response.trim()) return;

    if (responseForm.action === 'approve' && (!responseForm.approvedAmount || parseFloat(responseForm.approvedAmount) <= 0)) {
    alert('Please enter a valid approved amount');
    return;
  }


    const scholarshipPubkey = new PublicKey(responseForm.scholarshipId);
    
    try {
      setLoadingStates(prev => ({ 
        ...prev, 
        [`${responseForm.scholarshipId}-${responseForm.requestIndex}`]: true 
      }));

      // Find the corresponding Supabase application
      const application = allApplications.find(app => 
        app.scholarship_id === responseForm.scholarshipId && 
        app.status === 'pending'
      );

      if (responseForm.action === 'approve') {
        // Update Supabase first
        if (application) {
          await updateScholarshipApplication(application.id, {
            status: 'approved',
            lecturer_response: responseForm.response
          });
        }

        // Then update blockchain
        await approveScholarship.mutateAsync({
          scholarship: scholarshipPubkey,
          requestIndex: responseForm.requestIndex,
          approvedAmount: parseFloat(responseForm.approvedAmount), 
          lecturerResponse: responseForm.response
        });
      } else {
        // Update Supabase first
        if (application) {
          await updateScholarshipApplication(application.id, {
            status: 'rejected',
            lecturer_response: responseForm.response
          });
        }

        // Then update blockchain
        await rejectScholarship.mutateAsync({
          scholarship: scholarshipPubkey,
          requestIndex: responseForm.requestIndex,
          lecturerResponse: responseForm.response
        });
      }

      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ 
        queryKey: ['scholarship-applications'] 
      });

      setShowResponseModal(false);
      setResponseForm({ scholarshipId: '', requestIndex: -1, supabaseApplicationId: '', response: '', approvedAmount: '', action: '' });

    } catch (error) {
      console.error(`Failed to ${responseForm.action} scholarship:`, error);
    } finally {
      setLoadingStates(prev => ({ 
        ...prev, 
        [`${responseForm.scholarshipId}-${responseForm.requestIndex}`]: false 
      }));
    }
  };

  const handleWithdrawFunds = (scholarshipPubkey: PublicKey) => {
    setWithdrawForm({
      scholarshipId: scholarshipPubkey.toString(),
      amount: ''
    });
    setShowWithdrawModal(true);
  };

  // Also add validation before attempting withdrawal
  const handleSubmitWithdraw = async () => {
    if (!withdrawForm.amount || parseFloat(withdrawForm.amount) <= 0) return;

    const scholarshipPubkey = new PublicKey(withdrawForm.scholarshipId);
    const scholarship = lecturerScholarships.find(s => s.publicKey.equals(scholarshipPubkey));
    
    if (!scholarship) return;

    try {
      
      const availableForWithdrawal = scholarship.account.availableAmount;
      const mintInfo = await getMintInfo(scholarship.account.mint);
      const requestedAmountBN = new BN(Math.floor(parseFloat(withdrawForm.amount) * (10 ** mintInfo.decimals)));
      
      if (requestedAmountBN.gt(availableForWithdrawal)) {
        alert(`Cannot withdraw ${withdrawForm.amount}. Available: ${availableForWithdrawal.toNumber() / (10 ** mintInfo.decimals)}`);
        return;
      }

      setLoadingStates(prev => ({ 
        ...prev, 
        [`withdraw-${withdrawForm.scholarshipId}`]: true 
      }));

      await withdrawFunds.mutateAsync({
        scholarship: scholarshipPubkey,
        seed: scholarship.account.seed.toString(), // Use string to avoid BN conversion issues
        withdrawAmount: parseFloat(withdrawForm.amount)
      });

      setShowWithdrawModal(false);
      setWithdrawForm({ scholarshipId: '', amount: '' });
    } catch (error) {
      console.error('Failed to withdraw funds:', error);
    } finally {
      setLoadingStates(prev => ({ 
        ...prev, 
        [`withdraw-${withdrawForm.scholarshipId}`]: false 
      }));
    }
  };

  function shortenAddress(address: string) {
  if (!address) return "N/A";
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

  useEffect(() => {
    const fetchTokens = async () => {
      if (!publicKey) {
        // Still show allowed mints even without wallet connection for buy orders
        const tokensWithZeroBalance: TokenInfo[] = allowedMints.map(mint => ({
          mint,
          balance: 0
        }));
        setTokens(tokensWithZeroBalance);
        return;
      }

      try {
        const rpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com";
        const connection = new Connection(rpcUrl);

        // Import getAssociatedTokenAddress for direct token account lookups
        const { getAssociatedTokenAddress } = await import("@solana/spl-token");

        // Fetch specific token accounts for each allowed mint
        const tokenPromises = allowedMints.map(async (mint) => {
          try {
            // Try Token-2022 program first
            const ata2022 = await getAssociatedTokenAddress(
              new PublicKey(mint),
              publicKey,
              false, // allowOwnerOffCurve
              new PublicKey("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb") // Token-2022 program
            );
            
            const accountInfo2022 = await connection.getParsedAccountInfo(ata2022);
            if (accountInfo2022.value && 'parsed' in accountInfo2022.value.data) {
              const tokenData = accountInfo2022.value.data.parsed.info;
              return {
                mint: tokenData.mint,
                balance: tokenData.tokenAmount.uiAmount || 0,
              };
            }
          } catch (error) {
            console.log(error);
          }

          try {
            // Fallback to regular SPL token
            const ataRegular = await getAssociatedTokenAddress(
              new PublicKey(mint),
              publicKey,
              false, // allowOwnerOffCurve
              new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA") // Regular SPL Token program
            );
            
            const accountInfoRegular = await connection.getParsedAccountInfo(ataRegular);
            if (accountInfoRegular.value && 'parsed' in accountInfoRegular.value.data) {
              const tokenData = accountInfoRegular.value.data.parsed.info;
              return {
                mint: tokenData.mint,
                balance: tokenData.tokenAmount.uiAmount || 0,
              };
            }
          } catch (error) {
            console.log(error);
          }

          // If no account found, return with zero balance (user can still create buy orders)
          return {
            mint,
            balance: 0,
          };
        });

        // Wait for all token lookups to complete
        const userTokens = await Promise.all(tokenPromises);
        setTokens(userTokens);

      } catch (error) {
        console.error("Error fetching tokens:", error);
        
        // Ultimate fallback: show all allowed mints with zero balance
        const fallbackTokens: TokenInfo[] = allowedMints.map(mint => ({
          mint,
          balance: 0
        }));
        
        setTokens(fallbackTokens);
      }
    };

    fetchTokens();
  }, [publicKey]);

  const getTokenSymbol = (mint: string) => {
    const token = tokens.find(t => t.mint === mint);
    const cached = mintMetadata[mint];
    
    // Return the actual symbol if available, otherwise return empty string
    if (token?.tokenMetadata?.symbol) {
      return token.tokenMetadata.symbol;
    }
    if (cached?.symbol && !cached.symbol.includes('...')) {
      return cached.symbol;
    }
    
    // Return empty string instead of truncated mint address
    return '';
  };

  // Add a component to display the correct withdrawable amount
  const WithdrawableAmountDisplay = ({ scholarshipId }: { scholarshipId: string }) => {
    const [withdrawableAmount, setWithdrawableAmount] = useState<string>('Calculating...');

    useEffect(() => {
      const calculateAmount = async () => {
        try {
          const scholarship = lecturerScholarships.find(s => s.publicKey.toString() === scholarshipId);
          if (!scholarship) return;
          
         
          // Available = vault total - reserved
          const availableForWithdrawal = scholarship.account.availableAmount;
          const mintAddress = scholarship.account.mint.toString();
          
          // Format the amount properly
          const formatted = await formatTokenAmount(Math.max(0, availableForWithdrawal.toNumber()), mintAddress);
          const symbol = getTokenSymbol(mintAddress);
          setWithdrawableAmount(`${formatted}${symbol ? ` ${symbol}` : ''}`);
          
        } catch (error) {
          console.error('Error calculating withdrawable amount:', error);
          setWithdrawableAmount('Error calculating');
        }
      };

      calculateAmount();
    }, [scholarshipId]);

    return (
      <p className="text-sm text-gray-500 mt-1">
        Available for withdrawal: {withdrawableAmount}
      </p>
    );
  };

  if (!connected) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
        <div className="max-w-2xl mx-auto">
          <Card className="text-center">
            <CardContent className="pt-6">
              <Wallet className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <h2 className="text-xl font-semibold mb-2">Connect Your Wallet</h2>
              <p className="text-gray-600">Please connect your wallet to access the lecturer dashboard</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Scholarship Management</h1>
          <p className="text-gray-600">Create and manage scholarships for your students</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center">
                <BookOpen className="h-8 w-8 text-blue-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-white">My Scholarships</p>
                  <p className="text-2xl font-bold text-white">{lecturerScholarships.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center">
                <Clock className="h-8 w-8 text-yellow-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-white">Pending Requests</p>
                  <p className="text-2xl font-bold text-white">{pendingApplications.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center">
                <Check className="h-8 w-8 text-green-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-white">Total Approved</p>
                  <p className="text-2xl font-bold text-white">
                    {globalState?.totalRequestsApproved?.toString() || '0'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center">
                <DollarSign className="h-8 w-8 text-purple-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-white">Total Disbursed</p>
                  <p className="text-2xl font-bold text-white">
                    <FormattedTokenAmount 
                      amount={globalState?.totalVolumeDisbursed?.toNumber() || 0} 
                      mintAddress={lecturerScholarships[0]?.account.mint.toString() || allowedMints[0] || ''}
                    />
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="create">Create Scholarship</TabsTrigger>
            <TabsTrigger value="manage">Manage Scholarships</TabsTrigger>
            <TabsTrigger value="requests">Pending Requests</TabsTrigger>
             <TabsTrigger value="approved">Approved ({approvedApplications?.length || 0})</TabsTrigger>
          </TabsList>

          {/* Create Scholarship Tab */}
          <TabsContent value="create">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Plus className="h-5 w-5 mr-2" />
                  Create New Scholarship
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Token</label>
                      <div className="relative">
                        <TokenSelect
                          tokens={tokens}
                          onTokenChange={handleTokenChange}
                          onMaxClick={handleMaxClick}
                          onHalfClick={handleHalfClick}
                          className="w-full text-gray-900 bg-white border-gray-300 focus:border-blue-500"
                          ringColorClass="focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">Total Pool Amount</label>
                      <Input
                        type="number"
                        placeholder="Enter total amount"
                        value={createForm.amount}
                        onChange={(e) => handleCreateFormChange('amount', e.target.value)}
                        min="0"
                        step="0.000001"
                        max={createForm.selectedToken?.balance || undefined}
                      />
                      {createForm.selectedToken && (
                        <p className="text-sm text-gray-500 mt-1">
                          Available: {createForm.selectedToken.balance.toFixed(6)} {createForm.selectedToken.tokenMetadata?.symbol}
                        </p>
                      )}
                    </div>

                    {/* Max Request Amount Field */}
                    <div>
                      <label className="block text-sm font-medium mb-2">Max Request per Student</label>
                      <Input
                        type="number"
                        placeholder="Enter max request amount"
                        value={createForm.maxRequestAmount}
                        onChange={(e) => handleCreateFormChange('maxRequestAmount', e.target.value)}
                        min="0"
                        step="0.000001"
                        max={createForm.amount ? parseFloat(createForm.amount) : undefined}
                      />
                      <p className="text-sm text-gray-500 mt-1">
                        Maximum amount any single student can request
                      </p>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Scholarship Purpose</label>
                    <Textarea
                      placeholder="Describe the purpose and criteria for this scholarship..."
                      value={createForm.scholarshipPurpose}
                      onChange={(e) => handleCreateFormChange('scholarshipPurpose', e.target.value)}
                      rows={6}
                      maxLength={300}
                    />
                    <p className="text-sm text-gray-500 mt-1">
                      {createForm.scholarshipPurpose.length}/300 characters
                    </p>
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button 
                    onClick={handleCreateScholarship}
                    disabled={loadingStates.creating || !createForm.amount || !createForm.selectedToken || !createForm.scholarshipPurpose}
                    className="px-8"
                  >
                    {loadingStates.creating ? 'Creating...' : 'Create Scholarship'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Manage Scholarships Tab */}
          <TabsContent value="manage">
            <div className="space-y-6">
              {lecturerScholarships.length === 0 ? (
                <Card>
                  <CardContent className="pt-6 text-center">
                    <BookOpen className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                    <h3 className="text-lg font-medium mb-2">No scholarships created yet</h3>
                    <p className="text-gray-600 mb-4">Create your first scholarship to get started</p>
                    <Button onClick={() => setActiveTab('create')}>
                      <Plus className="h-4 w-4 mr-2" />
                      Create Scholarship
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                lecturerScholarships.map(scholarship => (
                  <Card key={scholarship.publicKey.toString()}>
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle className="text-lg">
                             Scholarship
                          </CardTitle>
                          <p className="text-sm text-gray-600 mt-1">
                            {scholarship.account.scholarshipPurpose}
                          </p>
                        </div>
                        <Badge variant="outline">
                          {scholarship.account.scholarshipRequests.length} requests
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <p className="text-sm text-gray-600">Total Amount</p>
                          <p className="text-lg font-semibold">
                            <FormattedTokenAmount 
                              amount={scholarship.account.totalAmount.toNumber()} 
                              mintAddress={scholarship.account.mint.toString()}
                            />
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Available</p>
                          <p className="text-lg font-semibold text-green-600">
                            <FormattedTokenAmount 
                              amount={scholarship.account.availableAmount.toNumber()} 
                              mintAddress={scholarship.account.mint.toString()}
                            />
                          </p>
                        </div>
                        {/* Disbursed amount */}
                        <div>
                          <p className="text-sm text-gray-600">Disbursed</p>
                          <p className="text-lg font-semibold text-blue-600">
                            <FormattedTokenAmount 
                              amount={scholarship.account.totalAmount.sub(scholarship.account.availableAmount).toNumber()} 
                              mintAddress={scholarship.account.mint.toString()}
                            />
                          </p>
                        </div>
                        {/* Withdrawal button */}
                        <div className="mt-4 pt-4 border-t">
                          <Button
                            onClick={() => handleWithdrawFunds(
                              scholarship.publicKey
                            )}
                            disabled={scholarship.account.availableAmount.toNumber() === 0}
                            variant="outline"
                            size="sm"
                          >
                            <DollarSign className="h-4 w-4 mr-2" />
                            Withdraw Funds
                          </Button>
                        </div>
                      </div>
                      
                      {scholarship.account.scholarshipRequests.length > 0 && (
                        <div className="mt-4">
                          <h4 className="font-medium mb-2">Recent Requests</h4>
                          <div className="space-y-2 max-h-40 overflow-y-auto">
                            {scholarship.account.scholarshipRequests.slice(-3).map((request, index) => (
                              <div key={index} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                                <div>
                                  <p className="text-sm font-medium text-black">
                                    {request.student.toString().slice(0, 8)}...
                                  </p>
                                  <p className="text-xs text-gray-600">
                                    <FormattedTokenAmount 
                                      amount={request.amount.toNumber()} 
                                      mintAddress={scholarship.account.mint.toString()}
                                    />
                                  </p>
                                </div>
                                <Badge 
                                  variant={
                                    request.status === ScholarshipRequestStatus.APPROVED ? "default" :
                                    request.status === ScholarshipRequestStatus.REJECTED ? "destructive" : "secondary"
                                  }
                                >
                                  {request.status === ScholarshipRequestStatus.APPROVED ? 'Approved' :
                                   request.status === ScholarshipRequestStatus.REJECTED ? 'Rejected' : 'Pending'}
                                </Badge>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>

          {/* Pending Requests Tab */}
          <TabsContent value="requests">
              <div className="space-y-6">
                {isLoadingApplications ? (
                  <Card>
                    <CardContent className="pt-6 text-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
                      <p>Loading applications...</p>
                    </CardContent>
                  </Card>
                ) : pendingApplications.length === 0 ? (
                  <Card>
                    <CardContent className="pt-6 text-center">
                      <Clock className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                      <h3 className="text-lg font-medium mb-2">No pending requests</h3>
                      <p className="text-gray-600">All scholarship requests have been processed</p>
                    </CardContent>
                  </Card>
                ) : (
                  pendingApplications.map((application) => (
                    <Card key={application.id}>
                      <CardHeader>
                        <div className="flex justify-between items-start">
                          <div>
                            <CardTitle className="text-lg">Scholarship Application</CardTitle>
                            <p className="text-sm text-gray-600">
                              From: {application.student.name} 
                            </p>
                          </div>
                          <Badge variant="secondary">Pending</Badge>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          {/* Student Academic Information */}
                          <div className="bg-blue-50 rounded-lg p-4">
                            <h4 className="font-medium text-blue-900 mb-2">Student Academic Information</h4>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                              <div>
                                <p className="text-blue-700 font-medium">Matriculation Number</p>
                                <p className="text-blue-800">{application.matric_no}</p>
                              </div>
                              <div>
                                <p className="text-blue-700 font-medium">Attendance Rate</p>
                                <p className="text-blue-800">{application.attendance}%</p>
                              </div>
                              <div>
                                <p className="text-blue-700 font-medium">Latest Exam Score</p>
                                <p className="text-blue-800">
                                  {application.latest_score !== null ? application.latest_score : 'No score available'}
                                </p>
                              </div>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <p className="text-sm text-gray-600">Student Wallet</p>
                              <p className="text-lg font-semibold">
                                {application.student.wallet ? shortenAddress(application.student.wallet) : 'N/A'}
                              </p>
                            </div>
                            <div>
                              <p className="text-sm text-gray-600">Application Date</p>
                              <p className="text-lg font-semibold">
                                {new Date(application.created_at).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          
                          <div>
                            <p className="text-sm text-white mb-2">Reason for Request</p>
                            <p className="text-sm bg-gray-50 text-black p-3 rounded border">
                              {application.reason}
                            </p>
                          </div>

                          <div className="flex space-x-3">
                          <Button
                          onClick={async () => await handleRequestAction( // Make onClick async
                            application,
                            'approve'
                          )}
                          className="bg-green-600 hover:bg-green-700"
                          disabled={loadingStates[`${application.scholarship_id}-${application.id}`]}
                        >
                          <Check className="h-4 w-4 mr-2" />
                          Approve
                        </Button>
                        <Button
                          variant="destructive"
                          onClick={async () => await handleRequestAction( // Make onClick async
                            application,
                            'reject'
                          )}
                          disabled={loadingStates[`${application.scholarship_id}-${application.id}`]}
                        >
                          <X className="h-4 w-4 mr-2" />
                          Reject
                        </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </TabsContent>

          {/* Approved Scholarships Tab */}
          <TabsContent value="approved">
            <Card>
              <CardHeader>
                <CardTitle>Approved Scholarships</CardTitle>
                <CardDescription>
                  History of approved scholarship applications
                </CardDescription>
              </CardHeader>
              <CardContent>
                {approvedApplications && approvedApplications.length > 0 ? (
                  <div className="space-y-4">
                    {approvedApplications.map((application) => (
                      <Card key={application.id}>
                        <CardContent className="pt-4">
                          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div>
                              <p className="text-sm text-gray-600">Student</p>
                              <p className="font-medium">{application.student?.name}</p>
                              <p className="text-xs text-gray-500">{application.matric_no}</p>
                            </div>
                            <div>
                              <p className="text-sm text-gray-600">Approved Date</p>
                              <p className="font-medium">
                                {formatDate(application.updated_at)}
                              </p>
                            </div>
                            <div>
                              <p className="text-sm text-gray-600">Score/Attendance</p>
                              <p className="font-medium">
                                {application.latest_score} / {application.attendance}%
                              </p>
                            </div>
                            <div>
                              <p className="text-sm text-gray-600">Response</p>
                              <p className="text-sm bg-green-50 text-green-800 p-2 rounded">
                                {application.lecturer_response}
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Check className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                    <p className="text-gray-500">No approved scholarships yet</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>  

        </Tabs>

        {/* Response Modal */}
      {showResponseModal && (
  <div className="fixed inset-0 bg-transparent bg-opacity-50 flex items-center justify-center p-4 z-50">
    <div className="bg-slate-700 rounded-lg p-6 w-full max-w-md">
      <h3 className="text-lg font-semibold mb-4">
        {responseForm.action === 'approve' ? 'Approve' : 'Reject'} Request
      </h3>
      <div className="space-y-4">
        {/* NEW: Approved Amount Input (only show for approve action) */}
          {responseForm.action === 'approve' && (
            <div>
              <label className="block text-sm font-medium mb-2">Approved Amount</label>
              <Input
                type="number"
                className='bg-white text-black'
                placeholder="Enter approved amount"
                value={responseForm.approvedAmount}
                onChange={(e) => setResponseForm(prev => ({ ...prev, approvedAmount: e.target.value }))}
                min="0"
                step="0.000001"
              />
              <p className="text-sm text-gray-400 mt-1">
                You can approve the full amount or reduce it
              </p>
            </div>
          )}
        <div>
          <label className="block text-sm font-medium mb-2">Your Response</label>
          <Textarea
            className='bg-white text-black'
            placeholder="Enter your response to the student..."
            value={responseForm.response}
            onChange={(e) => setResponseForm(prev => ({ ...prev, response: e.target.value }))}
            rows={4}
            maxLength={200}
          />
          <p className="text-sm text-gray-500 mt-1">
            {responseForm.response.length}/200 characters
          </p>
        </div>

                <div className="flex space-x-3">
                  <Button 
                    onClick={handleSubmitResponse}
                    disabled={!responseForm.response.trim()}
                    className={responseForm.action === 'approve' ? 'bg-green-600 hover:bg-green-700' : ''}
                    variant={responseForm.action === 'reject' ? 'destructive' : 'default'}
                  >
                    {responseForm.action === 'approve' ? 'Approve' : 'Reject'}
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => setShowResponseModal(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
          {/* Withdraw Modal */}
            {showWithdrawModal && (
              <div className="fixed inset-0 bg-transparent bg-opacity-50 flex items-center justify-center p-4 z-50">
                <div className="bg-white rounded-lg p-6 w-full max-w-md">
                  <h3 className="text-lg text-black font-semibold mb-4">Withdraw Funds</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm text-black font-medium mb-2">Amount to Withdraw</label>
                      <Input
                        type="number"
                        className='bg-white text-black border-gray-500' 
                        placeholder="Enter amount to withdraw"
                        value={withdrawForm.amount}
                        onChange={(e) => setWithdrawForm(prev => ({ ...prev, amount: e.target.value }))}
                        min="0"
                        step="0.000001"
                      />
                      {withdrawForm.scholarshipId && (
                       <WithdrawableAmountDisplay scholarshipId={withdrawForm.scholarshipId} />
                      )}
                    </div>
                    <div className="flex space-x-3">
                      <Button 
                        onClick={handleSubmitWithdraw}
                        disabled={!withdrawForm.amount || parseFloat(withdrawForm.amount) <= 0 || loadingStates[`withdraw-${withdrawForm.scholarshipId}`]}
                      >
                        {loadingStates[`withdraw-${withdrawForm.scholarshipId}`] ? 'Withdrawing...' : 'Withdraw'}
                      </Button>
                      <Button 
                        variant="outline" 
                        className='text-black bg-gray-500 border-gray-500'
                        onClick={() => setShowWithdrawModal(false)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}
      </div>
    </div>
  );
}