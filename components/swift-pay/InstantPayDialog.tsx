// InstantPayDialog.tsx
"use client";
import React, { useCallback, useState, useEffect, useMemo, useRef } from "react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import useSwiftPay from "@/hooks/swift-pay/useSwiftPay";
import { Zap, DollarSign, InfoIcon, Loader2, CreditCard, ChevronDown, ArrowLeft, QrCode, Building2, CheckCircle, AlertCircle, TrendingUp } from "lucide-react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import {PublicKey } from "@solana/web3.js";
import { z } from 'zod';
import {  createQR } from '@solana/pay';
import { BN } from '@coral-xyz/anchor';
import { Connection } from '@solana/web3.js';


const InstantPaySchema = z.object({
  currency: z.string().length(3, "Currency must be exactly 3 characters"),
  fiatAmount: z.coerce.number().positive("Fiat amount must be positive"),
  payoutDetails: z.object({
    type: z.enum(["bank_transfer", "mobile_money", "flutterwave_wallet"]),
    account_number: z.string().min(1, "Account number is required"),
    bank_code: z.string().optional(),
    beneficiary_name: z.string().min(1, "Beneficiary name is required"),
    phone_number: z.string().optional(),
    network: z.string().optional(),
  }),
}).refine((data) => {

  if (data.payoutDetails.type === "bank_transfer") {
    return data.payoutDetails.bank_code && data.payoutDetails.bank_code.length > 0;
  }
  return true;
}, {
  message: "Bank selection is required for bank transfers",
  path: ["payoutDetails", "bank_code"],
});

type InstantPaySchemaType = z.infer<typeof InstantPaySchema>;

type Props = {
  trigger: React.ReactNode;
};

interface Bank {
  id: number;
  code: string;
  name: string;
}
type AccountData = {
  publicKey: PublicKey;
  account: {
    seed: BN;
    maker: PublicKey;
    mint: PublicKey;
    currency: number[]; 
    escrowType: number; 
    feePercentage: number; 
    feeDestination: PublicKey;
    reservedFee: BN; 
    amount: BN; 
    pricePerToken: BN; 
    paymentInstructions: string;
    reservedAmounts: {
      taker: PublicKey;
      amount: BN; 
      fiatAmount: BN; 
      timestamp: BN; 
      sellerInstructions: string | null; 
      status: number; 
      disputeReason: string | null; 
      disputeId: string | null; 
      payoutDetails: string | null; 
      payoutReference: string | null; 
    }[];
    bump: number; 
  };
};

const InstantPayDialog: React.FC<Props> = ({ trigger }) => {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [showCurrencySelector, setShowCurrencySelector] = useState(true);
  const { instantReserve, getSwiftPayAccounts, getMintInfo } = useSwiftPay();
  const [availableAccounts, setAvailableAccounts] = useState<AccountData[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<AccountData | null>(null); 
  const [selectedLPAccount, setSelectedLPAccount] = useState<AccountData | null>(null); 
  const [tokenDecimals, setTokenDecimals] = useState<number>(9); 
  const [loading, setLoading] = useState(false);
  const [payoutType, setPayoutType] = useState<"bank_transfer" | "mobile_money" | "flutterwave_wallet">("bank_transfer");
  const [selectedCurrency, setSelectedCurrency] = useState<string>("");
  const fetchedCurrenciesRef = useRef<Set<string>>(new Set())
  
  
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  const [showQrCode, setShowQrCode] = useState(false);
  const [generatingQr, setGeneratingQr] = useState(false);
  const [showAvailableRates, setShowAvailableRates] = useState(false);
  const qrRef = useRef<HTMLDivElement>(null);
  
  const [subscriptionId, setSubscriptionId] = useState<number | null>(null);
  const [isVerifyingAccount, setIsVerifyingAccount] = useState(false);
  const [verifiedAccountName, setVerifiedAccountName] = useState<string | null>(null);
  const [verificationStatus, setVerificationStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [lastVerifiedDetails, setLastVerifiedDetails] = useState<{accountNumber: string, bankCode: string} | null>(null);
  const [verificationError, setVerificationError] = useState<string | null>(null);

  
  const currentLP = selectedLPAccount || selectedAccount;

  
  const currencyToCountryMap = useMemo(() => ({
    'NGN': 'NG',
    'GHS': 'GH', 
    'KES': 'KE',
    'UGX': 'UG',
    'TZS': 'TZ',
    'ZAR': 'ZA',
  }), []);

  // Fetch banks based on selected currency
  const { data: banksData, isLoading: banksLoading, error: banksError } = useQuery({
    queryKey: ['banks', selectedCurrency],
    queryFn: async () => {
      if (!selectedCurrency) return null;
      
      const country = currencyToCountryMap[selectedCurrency as keyof typeof currencyToCountryMap];
      if (!country) return null;

      const response = await fetch(`/api/flutterwave/banks?country=${country}`);
      if (!response.ok) {
        throw new Error('Failed to fetch banks');
      }
      return response.json();
    },
    enabled: !!selectedCurrency && payoutType === 'bank_transfer' && !showCurrencySelector,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    retry: 2,
  });

const availableBanks: Bank[] = useMemo(() => banksData?.banks || [], [banksData?.banks]);

  useEffect(() => {
    if (banksError) {
      toast.error("Failed to load banks. Please try again.");
    }
  }, [banksError]);

  // Available currencies
  const availableCurrencies = useMemo(() => [
    { code: "USD", name: "US Dollar", symbol: "$" },
    { code: "NGN", name: "Nigerian Naira", symbol: "₦" },
    { code: "KES", name: "Kenyan Shilling", symbol: "KSh" },
    { code: "GHS", name: "Ghanaian Cedi", symbol: "₵" },
    { code: "ZAR", name: "South African Rand", symbol: "R" },
  ], []);

  const defaultValues = useMemo(() => ({
    currency: "",
    fiatAmount: 0,
    payoutDetails: {
      type: "bank_transfer" as const,
      account_number: "",
      bank_code: "",
      beneficiary_name: "",
      phone_number: "",
      network: "",
    },
  }), []);

  const form = useForm<InstantPaySchemaType>({
    resolver: zodResolver(InstantPaySchema),
    defaultValues,
  });

  const fiatAmount = form.watch("fiatAmount");
  const watchedAccountNumber = form.watch("payoutDetails.account_number");
  const watchedBankCode = form.watch("payoutDetails.bank_code");

  // Account verification function
const verifyBankAccount = useCallback(async (accountNumber: string, bankCode: string) => {
  if (!accountNumber || !bankCode || payoutType !== 'bank_transfer') {
    return;
  }

  if (lastVerifiedDetails && 
      lastVerifiedDetails.accountNumber === accountNumber && 
      lastVerifiedDetails.bankCode === bankCode) {
    return;
  }

  console.log("Starting verification:", {
    accountNumber,
    bankCode,
    selectedBank: availableBanks.find(bank => bank.code === bankCode)
  });

  setIsVerifyingAccount(true);
  setVerificationStatus('loading');
  setVerificationError(null);

  try {
    const requestBody = {
      account_number: accountNumber.trim(),
      account_bank: bankCode.trim(),
    };
    
    console.log("Sending request:", requestBody);

    const response = await fetch('/api/flutterwave/verify-account', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    console.log("Response status:", response.status, response.statusText);
    
    const data = await response.json();
    console.log("Response data:", data);

    if (data.success && data.account_name) {
      setVerifiedAccountName(data.account_name);
      setVerificationStatus('success');
      setLastVerifiedDetails({ accountNumber, bankCode });
      
      
      const currentBeneficiaryName = form.getValues("payoutDetails.beneficiary_name");
      if (!currentBeneficiaryName) {
        form.setValue("payoutDetails.beneficiary_name", data.account_name);
      }
      
      
      if (data.is_test_mode) {
        toast.success(`Test Account Verified: ${data.account_name}`);
      } else {
        toast.success(`Account verified: ${data.account_name}`);
      }
      
    } else {
      setVerificationStatus('error');
      let errorMessage = data.error || 'Could not verify account';
      
      
      if (errorMessage.includes('044 is allowed') || errorMessage.includes('test mode')) {
        errorMessage = "Demo mode active: Account verification simulated. In production, real accounts will be verified.";
      }
      
      setVerificationError(errorMessage);
      setVerifiedAccountName(null);
      
      console.error("Verification failed:", errorMessage);
      toast.error(errorMessage);
    }
  } catch (error) {
    console.error('Account verification error:', error);
    setVerificationStatus('error');
    setVerificationError('Network error. Please try again.');
    setVerifiedAccountName(null);
    toast.error('Network error. Please try again.');
  } finally {
    setIsVerifyingAccount(false);
  }
}, [payoutType, lastVerifiedDetails, form, availableBanks]);

  
  useEffect(() => {
    if (watchedAccountNumber && watchedBankCode && payoutType === 'bank_transfer') {
      
      const timeoutId = setTimeout(() => {
        verifyBankAccount(watchedAccountNumber, watchedBankCode);
      }, 1000);

      return () => clearTimeout(timeoutId);
    } else {
      
      setVerificationStatus('idle');
      setVerifiedAccountName(null);
      setVerificationError(null);
    }
  }, [watchedAccountNumber, watchedBankCode, verifyBankAccount, payoutType]);

  
  useEffect(() => {
    if (payoutType !== 'bank_transfer') {
      setVerificationStatus('idle');
      setVerifiedAccountName(null);
      setVerificationError(null);
      setLastVerifiedDetails(null);
    }
  }, [payoutType]);

  
  const calculatedTokenAmount = useMemo(() => {
    if (!currentLP || !fiatAmount || fiatAmount <= 0) return 0;
    
    const pricePerToken = currentLP.account.pricePerToken ? 
      Number(currentLP.account.pricePerToken.toString()) : 0;
    
    if (pricePerToken === 0) return 0;
    
    
    const tokenAmountNeeded = fiatAmount / pricePerToken;
    
    
    return tokenAmountNeeded;
  }, [currentLP, fiatAmount]);

  
  const displayTokenAmount = useMemo(() => {
    return calculatedTokenAmount; 
  }, [calculatedTokenAmount]);

  
  const getTokenSymbol = useCallback(() => {
    // TODO: Implement proper lookup based on currentLP.account.mint
    return "USDC";
  }, []);

  const startTransactionMonitoring = useCallback((swiftPayAddress: string) => {
  const connection = new Connection(
    process.env.NEXT_PUBLIC_RPC_URL || 'https://api.devnet.solana.com'
  );

  const swiftPayPubkey = new PublicKey(swiftPayAddress);
  
  // Subscribe to account changes
  const subId = connection.onAccountChange(
    swiftPayPubkey,
    async (accountInfo) => {
      console.log('Swift pay account changed, checking for completion...');
      
      // Refetch accounts to get updated data
      await queryClient.invalidateQueries({
        queryKey: ["get-trust-express-accounts"],
      });
      
      toast.success("Payment completed successfully!");
      setOpen(false);
      form.reset(defaultValues);
      setShowCurrencySelector(true);
      setShowQrCode(false);
      setQrCodeUrl(null);
      
      // Unsubscribe
      if (subscriptionId !== null) {
        connection.removeAccountChangeListener(subscriptionId);
        setSubscriptionId(null);
      }
    },
    'confirmed'
  );

  setSubscriptionId(subId);
  
  // Cleanup function
  return () => {
    if (subId) {
      connection.removeAccountChangeListener(subId);
    }
  };
}, [queryClient, form, defaultValues, subscriptionId]);



useEffect(() => {
  if (!selectedCurrency || showCurrencySelector) return;
  if (!getSwiftPayAccounts.data) return;

  if (fetchedCurrenciesRef.current.has(selectedCurrency)) return;
  
  const fetchAccountsForCurrency = async () => {
    setLoading(true);
    
    fetchedCurrenciesRef.current.add(selectedCurrency);
    
    try {
      const allAccounts = getSwiftPayAccounts.data;
      
      const swiftPayAccounts = allAccounts.filter((account: AccountData) => {
        const currencyStr = String.fromCharCode(...account.account.currency).trim();
        const hasAmount = account.account.amount && Number(account.account.amount.toString()) > 0;
        
        return (
          account.account.escrowType === 1 && 
          currencyStr === selectedCurrency &&
          hasAmount
        );
      });

      if (swiftPayAccounts.length === 0) {
        toast.error(`No liquidity providers available for ${selectedCurrency}`);
        setShowCurrencySelector(true);
        return;
      }

      // Sort by price per token (lowest first) and select the best one
      const sortedAccounts = swiftPayAccounts.sort((a, b) => {
        const priceA = a.account.pricePerToken ? Number(a.account.pricePerToken.toString()) : Infinity;
        const priceB = b.account.pricePerToken ? Number(b.account.pricePerToken.toString()) : Infinity;
        return priceA - priceB;
      });

      setAvailableAccounts(sortedAccounts);
      const bestAccount = sortedAccounts[0];
      setSelectedAccount(bestAccount);
        
      // Get token decimals from the mint info
      if (bestAccount) {
        try {
          const mintInfo = await getMintInfo(bestAccount.account.mint);
          setTokenDecimals(mintInfo.decimals);
        } catch (error) {
          console.warn("Could not fetch mint info, using default decimals:", error);
          setTokenDecimals(9);
        }
      }
      
    } catch (error) {
      console.error("Error fetching swift pay accounts:", error);
      toast.error("Failed to load available liquidity providers");
      setShowCurrencySelector(true);
      fetchedCurrenciesRef.current.delete(selectedCurrency);
    } finally {
      setLoading(false);
    }
  };

  const timeoutId = setTimeout(() => {
    fetchAccountsForCurrency();
  }, 100);

  return () => clearTimeout(timeoutId);
}, [selectedCurrency, showCurrencySelector, getMintInfo, getSwiftPayAccounts.data]);
useEffect(() => {

  const currentQrElement = qrRef.current;
  
  if (qrCodeUrl && currentQrElement) {

    currentQrElement.innerHTML = '';
    
    const qrCodeInstance = createQR(qrCodeUrl, 256, 'white', 'black');
    qrCodeInstance.append(currentQrElement);
  }
  
  return () => {
    if (currentQrElement) {
      currentQrElement.innerHTML = '';
    }
  };
}, [qrCodeUrl]);

  // Direct payment submission
  const onSubmit = useCallback(
  async (values: InstantPaySchemaType) => {
    if (!currentLP) {
      toast.error("No liquidity provider selected.");
      return;
    }

    
    if (payoutType === 'bank_transfer' && verificationStatus !== 'success') {
      toast.error("Please wait for account verification to complete.");
      return;
    }

    try {
      // Prepare payout details as JSON string
      const payoutDetailsJson = JSON.stringify(values.payoutDetails);

      await instantReserve.mutateAsync({
        swiftPay: currentLP.publicKey,
        amount: calculatedTokenAmount, 
        fiatAmount: values.fiatAmount,
        currency: values.currency,
        payoutDetails: payoutDetailsJson,
      });

      toast.success("Payment processed successfully!");
      
      form.reset(defaultValues);
      queryClient.invalidateQueries({
        queryKey: ["get-trust-express-accounts"],
      });
      setOpen(false);

    } catch (error) {
      console.error("Error processing payment:", error);
      toast.error(error instanceof Error ? error.message : "Failed to process payment");
    }
  },
  [instantReserve, currentLP, calculatedTokenAmount, form, queryClient, defaultValues, payoutType, verificationStatus]
);

  // Generate QR Code for merchant payment
const handleGenerateQrCode = useCallback(async () => {
  if (!currentLP) {
    toast.error("No liquidity provider selected.");
    return;
  }

  const isValid = await form.trigger();
  if (!isValid) {
    toast.error("Please fill in all required fields.");
    return;
  }

  if (payoutType === 'bank_transfer' && verificationStatus !== 'success') {
    toast.error("Please wait for account verification to complete.");
    return;
  }

  const formData = form.getValues();
  setGeneratingQr(true);

  try {
    // Use environment variable for ngrok URL, fallback to window.location.origin for production
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
    const apiUrl = new URL('/api/solana-pay/instant-reserve', baseUrl);
    
    // Add query parameters
    apiUrl.searchParams.set('swiftPayAddress', currentLP.publicKey.toString());
    apiUrl.searchParams.set('tokenAmount', calculatedTokenAmount.toString());
    apiUrl.searchParams.set('fiatAmount', formData.fiatAmount.toString());
    apiUrl.searchParams.set('currency', formData.currency);
    apiUrl.searchParams.set('payoutDetails', JSON.stringify(formData.payoutDetails));

    // Convert URL object to string
    const solanaPay = apiUrl.toString();

    console.log("Generated Solana Pay URL:", solanaPay);
    setQrCodeUrl(solanaPay);
    setShowQrCode(true);

    startTransactionMonitoring(currentLP.publicKey.toString());
    
    toast.success("QR Code generated! Customers can scan to pay.");
  } catch (error) {
    console.error("Error generating QR code:", error);
    toast.error("Failed to generate QR code");
  } finally {
    setGeneratingQr(false);
  }
}, [form, currentLP, calculatedTokenAmount, payoutType, verificationStatus]);
  // Handle back to form from QR code view
  const handleBackToForm = useCallback(() => {
    setShowQrCode(false);
    setQrCodeUrl(null);
  }, []);

 
const handleCurrencySelect = useCallback((currency: string) => {
  setSelectedCurrency(currency);
  form.setValue("currency", currency);
  setShowCurrencySelector(false);
  
  
  setAvailableAccounts([]);
  setSelectedAccount(null);
  setSelectedLPAccount(null);
  
  
  fetchedCurrenciesRef.current.delete(currency);
}, [form]);

  // Memoize payout options to prevent re-renders
  const payoutOptions = useMemo(() => [
    { value: "bank_transfer" as const, label: "Bank Transfer", icon: "🏦" },
    { value: "mobile_money" as const, label: "Mobile Money", icon: "📱" },
    { value: "flutterwave_wallet" as const, label: "Flutterwave", icon: "💳" },
  ], []);

  const isSubmitting = instantReserve.isPending;

  // Handle dialog close
const handleDialogClose = useCallback((newOpen: boolean) => {
  setOpen(newOpen);
  
  if (subscriptionId !== null) {
  const connection = new Connection(
    process.env.NEXT_PUBLIC_RPC_URL || 'https://api.devnet.solana.com'
  );
  connection.removeAccountChangeListener(subscriptionId);
  setSubscriptionId(null);
}

  if (!newOpen) {

    
    
    form.reset(defaultValues);
    setShowCurrencySelector(true);
    setPayoutType("bank_transfer");
    setSelectedCurrency("");
    setSelectedAccount(null);
    setAvailableAccounts([]);
    setTokenDecimals(9);
    setShowQrCode(false);
    setQrCodeUrl(null);
    setSelectedLPAccount(null);
    setShowAvailableRates(false);
    setVerificationStatus('idle');
    setVerifiedAccountName(null);
    setVerificationError(null);
    setLastVerifiedDetails(null);
    fetchedCurrenciesRef.current.clear();
  }
}, [form, defaultValues]);

  const handleCancel = useCallback(() => {
    form.reset(defaultValues);
    setShowCurrencySelector(true);
    setPayoutType("bank_transfer");
    setSelectedCurrency("");
    setSelectedAccount(null);
    setAvailableAccounts([]);
    setTokenDecimals(9);
    setShowQrCode(false);
    setQrCodeUrl(null);
    setSelectedLPAccount(null); 
    setShowAvailableRates(false); 
    setVerificationStatus('idle');
    setVerifiedAccountName(null);
    setVerificationError(null);
    setLastVerifiedDetails(null);
    setOpen(false);
  }, [form, defaultValues]);

  // Get currency symbol
  const getCurrencySymbol = useCallback((currencyCode: string) => {
    const currency = availableCurrencies.find(c => c.code === currencyCode);
    return currency?.symbol || currencyCode;
  }, [availableCurrencies]);

  // Get formatted price per token
  const getFormattedPrice = useCallback((account: AccountData | null) => {
    if (!account || !account.account.pricePerToken) return "0";
    const price = Number(account.account.pricePerToken.toString());
    return price.toFixed(2);
  }, []);

  // Get truncated public key for LP display
  const getTruncatedKey = useCallback((publicKey: PublicKey) => {
    const keyStr = publicKey.toString();
    return `${keyStr.slice(0, 4)}...${keyStr.slice(-4)}`;
  }, []);

  // Get available amount for LP
  const getAvailableAmount = useCallback((account: AccountData) => {
    if (!account.account.amount) return "0";
    const amount = Number(account.account.amount.toString());
    return (amount / Math.pow(10, tokenDecimals)).toFixed(2);
  }, [tokenDecimals]);

  const showTestModeInfo = useCallback(() => {
  return (
    <div className="rounded-xl bg-yellow-900/20 border border-yellow-800 p-4 mb-4">
      <div className="flex items-start gap-3">
        <InfoIcon className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-yellow-200">
          <div className="font-medium mb-1">Demo Mode Active</div>
          <div className="text-xs text-yellow-300">
            You&apos;re currently in test mode. Account verification is simulated. 
            In production, real bank account details will be verified through Flutterwave.
          </div>
        </div>
      </div>
    </div>
  );
}, []);

  return (
    <Dialog open={open} onOpenChange={handleDialogClose}>
      <DialogTrigger asChild>{trigger}</DialogTrigger> 
      <DialogContent className="max-h-[90vh] overflow-y-auto bg-gray-900 border-gray-700">
        <DialogHeader className="relative"> 
          <div className="flex items-center space-x-3">
            <div className="relative">
              <div className="relative bg-gradient-to-r from-blue-500 to-cyan-600 p-2.5 rounded-lg">
                <Zap className="w-5 h-5 text-white" />
              </div>
            </div>
            <div>
              <DialogTitle className="text-xl font-bold text-white">
                Instant Pay
              </DialogTitle>
              <DialogDescription className="text-gray-400">
                {showCurrencySelector 
                  ? "Select your preferred currency to get started"
                  : showQrCode
                  ? "QR Code generated - customers can scan to pay"
                  : "Complete your payment details for instant processing"
                }
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        
       {/* Test Mode Info */}
        {process.env.NODE_ENV === 'development' && showTestModeInfo()}

        {/* Main Content Container - Fixed Height */}
        <div className="relative h-[500px] overflow-hidden">
          {/* Currency Selection Layer */}
          <div className={`absolute inset-0 transition-all duration-300 ease-in-out ${
            showCurrencySelector 
              ? 'opacity-100 translate-x-0' 
              : 'opacity-0 -translate-x-4 pointer-events-none'
          }`}>
            <div className="space-y-4 h-full overflow-y-auto">
              <div className="flex items-center gap-2 text-gray-300">
                <DollarSign className="w-4 h-4 text-green-400"/>
                <span className="text-sm font-medium">Select Currency</span>
              </div>
              
              <div className="relative rounded-xl border border-gray-600 bg-gray-800 focus-within:border-green-500">
                <select
                  className="w-full bg-transparent border-0 p-4 text-white text-lg focus:outline-none appearance-none cursor-pointer"
                  value=""
                  onChange={(e) => e.target.value && handleCurrencySelect(e.target.value)}
                >
                  <option value="" disabled className="bg-gray-800 text-gray-400">
                    Choose your currency
                  </option>
                  {availableCurrencies.map((currency) => (
                    <option 
                      key={currency.code} 
                      value={currency.code}
                      className="bg-gray-800 text-white"
                    >
                      {currency.symbol} {currency.name} ({currency.code})
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
              </div>

              <div className="rounded-xl bg-blue-900/20 border border-blue-800 p-4">
                <div className="flex items-start gap-3">
                  <InfoIcon className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-blue-200">
                    <div className="font-medium mb-1">Best Rates Automatically Selected</div>
                    <div className="text-xs text-blue-300">
                      We&apos;ll automatically find the liquidity provider with the best exchange rates for your selected currency.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Payment Form Layer */}
          <div className={`absolute inset-0 transition-all duration-300 ease-in-out ${
            !showCurrencySelector && !showQrCode
              ? 'opacity-100 translate-x-0'
              : 'opacity-0 translate-x-4 pointer-events-none'
          }`}>
            <div className="h-full overflow-y-auto">
              {/* Loading Overlay */}
              {loading && (
                <div className="absolute inset-0 bg-gray-900/80 backdrop-blur-sm z-10 flex items-center justify-center">
                  <div className="flex items-center gap-3">
                    <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
                    <span className="text-white">Finding best rates for {selectedCurrency}...</span>
                  </div>
                </div>
              )}
              
              {/* Form Content - Always Rendered */}
              <div className={`transition-opacity duration-200 ${loading ? 'opacity-30' : 'opacity-100'}`}>
                {selectedCurrency && (
                <Form {...form}>
                  <form className="space-y-6" onSubmit={form.handleSubmit(onSubmit)}>
                    
                    {/* Selected Currency Display with Compact Change */}
                    <div className="rounded-xl bg-green-900/20 border border-green-800 p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-green-400 font-medium">Currency:</span>
                          <div className="relative">
                            <select
                              className="bg-transparent border-0 text-white font-medium focus:outline-none appearance-none cursor-pointer pr-6"
                              value={selectedCurrency}
                              onChange={(e) => e.target.value !== selectedCurrency && handleCurrencySelect(e.target.value)}
                            >
                              <option value={selectedCurrency} className="bg-gray-800 text-white">
                                {getCurrencySymbol(selectedCurrency)} {selectedCurrency}
                              </option>
                              {availableCurrencies
                                .filter(c => c.code !== selectedCurrency)
                                .map((currency) => (
                                  <option 
                                    key={currency.code} 
                                    value={currency.code}
                                    className="bg-gray-800 text-white"
                                  >
                                    {currency.symbol} {currency.code}
                                  </option>
                                ))}
                            </select>
                            <ChevronDown className="absolute right-0 top-1/2 transform -translate-y-1/2 w-3 h-3 text-green-400 pointer-events-none" />
                          </div>
                        </div>
                      </div>
                      {currentLP && (
                        <div className="text-xs text-green-300 mt-1">
                          Current Rate: {getFormattedPrice(currentLP)} {selectedCurrency} per token
                        </div>
                      )}
                    </div>

                    {/* Fiat Amount Input */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-gray-300">
                        <span className="w-4 h-4 text-purple-400">💱</span>
                        <span className="text-sm font-medium">Amount</span>
                      </div>
                      <FormItem>
                        <FormControl>
                          <div className="relative rounded-xl border border-gray-600 p-4 bg-gray-800 focus-within:border-purple-500">
                            <div className="flex items-center gap-2">
                              <span className="text-gray-400 text-lg font-medium">
                                {getCurrencySymbol(selectedCurrency)}
                              </span>
                              <input
                                type="number"
                                step="0.01"
                                placeholder="0.00"
                                className="flex-1 bg-transparent text-white text-lg outline-none placeholder:text-gray-500"
                                {...form.register("fiatAmount", { 
                                  valueAsNumber: true,
                                })}
                              />
                            </div>
                            <div className="text-xs text-gray-400 mt-1">
                              Enter the amount in {selectedCurrency}
                            </div>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    </div>

                    {/* Collapsible Liquidity Provider Selection */}
                    {availableAccounts.length > 1 && (
                      <div className="space-y-3">
                        <button
                          type="button"
                          onClick={() => setShowAvailableRates(!showAvailableRates)}
                          className="flex items-center justify-between w-full p-3 rounded-xl border border-gray-600 bg-gray-800 hover:border-gray-500 transition-colors text-left"
                        >
                          <div className="flex items-center gap-2">
                            <TrendingUp className="w-4 h-4 text-blue-400"/>
                            <span className="text-gray-300 text-sm font-medium">Available Rates</span>
                            <div className="text-xs text-gray-400">({availableAccounts.length} providers)</div>
                          </div>
                          <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${showAvailableRates ? 'rotate-180' : ''}`} />
                        </button>
                        
                        {showAvailableRates && (
                          <div className="space-y-2 pl-4 border-l-2 border-gray-700">
                            {availableAccounts.map((account) => {
                              const isSelected = selectedLPAccount?.publicKey.equals(account.publicKey) || 
                                              (!selectedLPAccount && selectedAccount?.publicKey.equals(account.publicKey));
                              const isBestRate = selectedAccount?.publicKey.equals(account.publicKey);
                              
                              return (
                                <button
                                  key={account.publicKey.toString()}
                                  type="button"
                                  onClick={() => setSelectedLPAccount(account)}
                                  className={`w-full p-3 rounded-lg border text-left transition-colors ${
                                    isSelected
                                      ? "border-blue-500 bg-blue-500/20 text-blue-300"
                                      : "border-gray-600 bg-gray-800 text-gray-300 hover:border-gray-500"
                                  }`}
                                >
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                      <div className="text-xs text-gray-400">
                                        LP {getTruncatedKey(account.publicKey)}
                                      </div>
                                      {isBestRate && (
                                        <div className="px-2 py-1 rounded-full bg-green-500/20 text-green-400 text-xs font-medium">
                                          Best Rate
                                        </div>
                                      )}
                                    </div>
                                    <div className="text-right">
                                      <div className="text-sm font-medium">
                                        {getFormattedPrice(account)} {selectedCurrency}
                                      </div>
                                      <div className="text-xs text-gray-400">
                                        Available: {getAvailableAmount(account)} {getTokenSymbol()}
                                      </div>
                                    </div>
                                  </div>
                                </button>
                              );
                            })}

                            
                            <div className="rounded-xl bg-blue-900/20 border border-blue-800 p-3 mt-3">
                              <div className="flex items-start gap-2">
                                <InfoIcon className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                                <div className="text-xs text-blue-300">
                                  Select a different rate or stick with the automatically chosen best rate. 
                                  Lower rates mean better value for your money.
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Token Amount Display */}
                    {displayTokenAmount > 0 && currentLP && (
                      <div className="rounded-xl bg-gray-800 border border-gray-600 p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="text-gray-300 text-sm">Tokens:</div>
                          <div className="text-white font-mono text-lg">
                            {displayTokenAmount.toFixed(2)} {getTokenSymbol()}
                          </div>
                        </div>
                        <div className="text-xs text-gray-400">
                          This amount will be deducted from your wallet at {getFormattedPrice(currentLP)} {selectedCurrency} per token
                        </div>
                      </div>
                    )}

                    {/* Payout Type Selection */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 text-gray-300">
                        <CreditCard className="w-4 h-4 text-orange-400"/>
                        <span className="text-sm font-medium">Payout Method</span>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-2">
                        {payoutOptions.map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => {
                              setPayoutType(option.value);
                              form.setValue("payoutDetails.type", option.value);
                              // Reset verification state when changing payout type
                              if (option.value !== 'bank_transfer') {
                                setVerificationStatus('idle');
                                setVerifiedAccountName(null);
                                setVerificationError(null);
                                setLastVerifiedDetails(null);
                              }
                            }}
                            className={`p-3 rounded-lg border text-sm font-medium transition-colors ${
                              payoutType === option.value
                                ? "border-orange-500 bg-orange-500/20 text-orange-300"
                                : "border-gray-600 bg-gray-800 text-gray-300 hover:border-gray-500"
                            }`}
                          >
                            <div className="flex flex-col items-center gap-1">
                              <span className="text-lg">{option.icon}</span>
                              <span>{option.label}</span>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Payout Details Form */}
                    <div className="space-y-4">
                      {/* Account Number */}
                      <FormItem>
                        <FormLabel className="text-gray-300 text-sm">
                          {payoutType === "mobile_money" ? "Phone Number" : "Account Number"}
                        </FormLabel>
                        <FormControl>
                          <div className="relative rounded-xl border border-gray-600 p-4 bg-gray-800 focus-within:border-orange-500">
                            <input
                              type="text"
                              placeholder={payoutType === "mobile_money" ? "+234XXXXXXXXXX" : "1234567890"}
                              className="w-full bg-transparent text-white text-lg outline-none placeholder:text-gray-500"
                              {...form.register("payoutDetails.account_number")}
                            />
                            {/* Verification status indicator for account number */}
                            {payoutType === 'bank_transfer' && watchedAccountNumber && (
                              <div className="absolute right-4 top-1/2 transform -translate-y-1/2">
                                {isVerifyingAccount ? (
                                  <Loader2 className="w-5 h-5 text-orange-400 animate-spin" />
                                ) : verificationStatus === 'success' ? (
                                  <CheckCircle className="w-5 h-5 text-green-400" />
                                ) : verificationStatus === 'error' ? (
                                  <AlertCircle className="w-5 h-5 text-red-400" />
                                ) : null}
                              </div>
                            )}
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>

                      {/* Bank Selection (for bank transfers) */}
                      {payoutType === "bank_transfer" && (
                        <FormItem>
                          <FormLabel className="text-gray-300 text-sm flex items-center gap-2">
                            <Building2 className="w-4 h-4" />
                            Select Bank
                          </FormLabel>
                          <FormControl>
                            <div className="relative rounded-xl border border-gray-600 bg-gray-800 focus-within:border-orange-500">
                              {banksLoading ? (
                                <div className="flex items-center justify-center p-4">
                                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                  <span className="text-gray-400 text-sm">Loading banks...</span>
                                </div>
                              ) : banksError ? (
                                <div className="p-4">
                                  <div className="text-red-400 text-sm mb-2">Failed to load banks</div>
                                  <button
                                    type="button"
                                    onClick={() => queryClient.invalidateQueries({ queryKey: ['banks', selectedCurrency] })}
                                    className="text-orange-400 hover:text-orange-300 text-xs underline"
                                  >
                                    Retry
                                  </button>
                                </div>
                              ) : (
                                <select
                                  className="w-full bg-transparent border-0 p-4 text-white text-lg focus:outline-none appearance-none cursor-pointer"
                                  {...form.register("payoutDetails.bank_code")}
                                  defaultValue=""
                                >
                                  <option value="" disabled className="bg-gray-800 text-gray-400">
                                    Choose your bank
                                  </option>
                                  {availableBanks.map((bank) => (
                                    <option 
                                      key={bank.code} 
                                      value={bank.code}
                                      className="bg-gray-800 text-white"
                                    >
                                      {bank.name}
                                    </option>
                                  ))}
                                </select>
                              )}
                              <ChevronDown className="absolute right-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
                            </div>
                          </FormControl>
                          <FormMessage />
                          {availableBanks.length > 0 && !banksLoading && (
                            <div className="text-xs text-gray-400 mt-1">
                              {availableBanks.length} banks available for {selectedCurrency}
                            </div>
                          )}
                        </FormItem>
                      )}

                      {/* Account Verification Status Display */}
                      {payoutType === 'bank_transfer' && watchedAccountNumber && watchedBankCode && (
                        <div className={`rounded-xl border p-4 ${
                          verificationStatus === 'success' 
                            ? 'bg-green-900/20 border-green-800' 
                            : verificationStatus === 'error'
                            ? 'bg-red-900/20 border-red-800'
                            : 'bg-orange-900/20 border-orange-800'
                        }`}>
                          <div className="flex items-start gap-3">
                            {verificationStatus === 'loading' ? (
                              <Loader2 className="w-5 h-5 text-orange-400 animate-spin flex-shrink-0 mt-0.5" />
                            ) : verificationStatus === 'success' ? (
                              <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                            ) : verificationStatus === 'error' ? (
                              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                            ) : (
                              <InfoIcon className="w-5 h-5 text-orange-400 flex-shrink-0 mt-0.5" />
                            )}
                            <div className="text-sm">
                              {verificationStatus === 'loading' ? (
                                <div className="text-orange-200">
                                  <div className="font-medium mb-1">Verifying Account...</div>
                                  <div className="text-xs text-orange-300">
                                    Please wait while we verify your account details
                                  </div>
                                </div>
                              ) : verificationStatus === 'success' && verifiedAccountName ? (
                                <div className="text-green-200">
                                  <div className="font-medium mb-1">Account Verified ✓</div>
                                  <div className="text-xs text-green-300">
                                    Account Name: <span className="font-medium">{verifiedAccountName}</span>
                                  </div>
                                </div>
                              ) : verificationStatus === 'error' ? (
                                <div className="text-red-200">
                                  <div className="font-medium mb-1">Verification Failed</div>
                                  <div className="text-xs text-red-300">
                                    {verificationError || 'Could not verify account details'}
                                  </div>
                                </div>
                              ) : (
                                <div className="text-orange-200">
                                  <div className="font-medium mb-1">Account Verification</div>
                                  <div className="text-xs text-orange-300">
                                    Account will be verified automatically when you complete both fields
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Network (for mobile money) */}
                      {payoutType === "mobile_money" && (
                        <FormItem>
                          <FormLabel className="text-gray-300 text-sm">Mobile Network</FormLabel>
                          <FormControl>
                            <div className="relative rounded-xl border border-gray-600 bg-gray-800 focus-within:border-orange-500">
                              <select
                                className="w-full bg-transparent border-0 p-4 text-white text-lg focus:outline-none appearance-none cursor-pointer"
                                {...form.register("payoutDetails.network")}
                                defaultValue=""
                              >
                                <option value="" disabled className="bg-gray-800 text-gray-400">
                                  Select Network
                                </option>
                                <option value="MTN" className="bg-gray-800 text-white">MTN</option>
                                <option value="AIRTEL" className="bg-gray-800 text-white">Airtel</option>
                                <option value="GLO" className="bg-gray-800 text-white">Glo</option>
                                <option value="9MOBILE" className="bg-gray-800 text-white">9Mobile</option>
                              </select>
                              <ChevronDown className="absolute right-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}

                      {/* Beneficiary Name */}
                      <FormItem>
                        <FormLabel className="text-gray-300 text-sm">Beneficiary Name</FormLabel>
                        <FormControl>
                          <div className="relative rounded-xl border border-gray-600 p-4 bg-gray-800 focus-within:border-orange-500">
                            <input
                              type="text"
                              placeholder="John Doe"
                              className="w-full bg-transparent text-white text-lg outline-none placeholder:text-gray-500"
                              {...form.register("payoutDetails.beneficiary_name")}
                            />
                            {/* Show auto-fill indicator for verified accounts */}
                            {payoutType === 'bank_transfer' && verifiedAccountName && 
                             form.watch("payoutDetails.beneficiary_name") === verifiedAccountName && (
                              <div className="absolute right-4 top-1/2 transform -translate-y-1/2">
                                <CheckCircle className="w-5 h-5 text-green-400" />
                              </div>
                            )}
                          </div>
                        </FormControl>
                        <FormMessage />
                        {payoutType === 'bank_transfer' && verifiedAccountName && 
                         form.watch("payoutDetails.beneficiary_name") !== verifiedAccountName && (
                          <div className="text-xs text-orange-400 mt-1">
                            Verified name: {verifiedAccountName}
                          </div>
                        )}
                      </FormItem>
                    </div>

                    {/* Info Section */}
                    <div className="rounded-xl bg-blue-900/20 border border-blue-800 p-4">
                      <div className="flex items-start gap-3">
                        <InfoIcon className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                        <div className="text-sm text-blue-200">
                          <div className="font-medium mb-1">Instant Processing</div>
                          <div className="text-xs text-blue-300">
                            Your payment will be processed instantly through automated systems. 
                            {payoutType === 'bank_transfer' && 
                             ' Bank account verification ensures accurate delivery of funds.'}
                          </div>
                        </div>
                      </div>
                    </div>

                    <FormMessage />
                  </form>
                </Form>
                )}
              </div>
            </div>
          </div>

          {/* QR Code Layer */}
          <div className={`absolute inset-0 transition-all duration-300 ease-in-out ${
            showQrCode
              ? 'opacity-100 translate-x-0'
              : 'opacity-0 translate-x-4 pointer-events-none'
          }`}>
            <div className="h-full overflow-y-auto">
              <div className="space-y-6">
                <div className="text-center space-y-4">
                  <div className="flex justify-center">
                    <div className="bg-white p-4 rounded-xl">
                      <div ref={qrRef} className="flex justify-center items-center min-h-[256px]" />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <h3 className="text-lg font-semibold text-white">
                      Payment Request Generated
                    </h3>
                    <div className="text-gray-300">
                      <div>Amount: {getCurrencySymbol(selectedCurrency)}{fiatAmount}</div>
                      <div>Tokens: {displayTokenAmount.toFixed(2)} {getTokenSymbol()}</div>
                    </div>
                  </div>

                  <div className="rounded-xl bg-green-900/20 border border-green-800 p-4">
                    <div className="flex items-start gap-3">
                      <InfoIcon className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                      <div className="text-sm text-green-200">
                        <div className="font-medium mb-1">Instructions for Customer</div>
                        <div className="text-xs text-green-300">
                          1. Open your Solana wallet app<br/>
                          2. Scan this QR code<br/>
                          3. Review and approve the transaction<br/>
                          4. Payment will be processed instantly
                        </div>
                      </div>
                    </div>
                  </div>

                  <Button
                    variant="outline"
                    onClick={handleBackToForm}
                    className="w-full"
                  >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Edit Details
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
        <DialogFooter className="flex gap-3 pt-4">
          <DialogClose asChild>
            <Button
              variant={"secondary"}
              type="button"
              onClick={handleCancel}
              disabled={isSubmitting || generatingQr}
            >
              Cancel
            </Button>
          </DialogClose>
          
          {!showCurrencySelector && !showQrCode && (
            <>
              <Button
                type="button"
                onClick={handleGenerateQrCode}
                disabled={
                  isSubmitting || 
                  loading || 
                  !currentLP || 
                  displayTokenAmount <= 0 || 
                  generatingQr ||
                  (payoutType === 'bank_transfer' && verificationStatus !== 'success')
                }
                className="bg-purple-700 hover:bg-purple-800 text-white border border-black p-2 disabled:opacity-50"
              >
                {generatingQr ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <QrCode className="mr-2 h-4 w-4" />
                    Generate QR Code
                  </>
                )}
              </Button>
              <Button
                onClick={form.handleSubmit(onSubmit)}
                disabled={
                  isSubmitting || 
                  loading || 
                  !currentLP || 
                  displayTokenAmount <= 0 || 
                  generatingQr ||
                  (payoutType === 'bank_transfer' && verificationStatus !== 'success')
                }
                className="bg-blue-700 hover:bg-blue-800 text-white border border-black p-2 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Zap className="mr-2 h-4 w-4" />
                    Pay {getCurrencySymbol(selectedCurrency)}{fiatAmount || 0}
                  </>
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default InstantPayDialog;