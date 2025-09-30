"use client";
import { BN, ProgramAccount } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import React, { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ellipsify } from "@/lib/utils";
import {
  CircleUser,
  Coins,
  Ellipsis,
  RedoDot,
  RefreshCcw,
  Clock,
  Bell,
  RefreshCwOff,
  SendToBack,
  DollarSign,
  ExternalLink,
  ShieldAlert,
  Info
} from "lucide-react";
import { Separator } from "@/components/ui/separator";
import ExplorerLink from "@/components/ExplorerLink";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useWallet } from "@solana/wallet-adapter-react";
import useSwiftPay from "@/hooks/swift-pay/useSwiftPay";
import { useSwiftBalance } from "@/hooks/swift-pay/useSwiftPayBalance";
import UpdatePriceForm from "./PriceUpdate";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useTokenMetadata } from "@/hooks/useTokenMetadata";
import TokenDisplay from "@/components/swift-pay/TokenDisplay";

const SWIFT_PAY = 1;

// Type definitions 
interface ReservationData {
  taker: PublicKey;
  amount: BN;
  fiatAmount: BN;
  timestamp: BN;
  status: number;
}

interface Props {
  data: ProgramAccount<{
    seed: BN;
    maker: PublicKey;
    mint: PublicKey;
    currency: number[];
    escrowType: number;
    amount: BN;
    pricePerToken: BN;
    paymentInstructions: string;
    reservedAmounts: Array<ReservationData>;
    bump: number;
    createdAt?: BN; 
  }>;
}


const BuyOrderCard: React.FC<Props> = ({ data }) => {
 
  const { publicKey } = useWallet();
  const { cancelOrReduceBuyOrder, getMintInfo  } = useSwiftPay();
  const queryClient = useQueryClient();
  const [hasPendingReservations, setHasPendingReservations] = useState(false);
  const [newAmount, setNewAmount] = useState<string>("");
  const [hasDispute, setHasDispute] = useState(false);
  const [confirmCancelOpen, setConfirmCancelOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { metadata: tokenMetadata } = useTokenMetadata(data.account.mint);

  
const shouldFetchBalance = useMemo(() => {
  
  if (data.account.escrowType === SWIFT_PAY) {
    return true;
  }
  
  return publicKey && (
    data.account.maker.equals(publicKey) || 
    data.account.reservedAmounts.some(
      (reservation: ReservationData) => reservation.taker.equals(publicKey) && (reservation.status === 0 || reservation.status === 1)
    )
  );
}, [publicKey, data.account.maker, data.account.reservedAmounts, data.account.escrowType]);

const { 
  totalBalance, 
  availableBalance, 
  escrowType
} = useSwiftBalance(
  shouldFetchBalance ? data.publicKey : undefined,
  shouldFetchBalance ? data.account.mint : undefined
);
  
  const isValidSwiftPay = useMemo(() => {
    if (!data || !data.account) {
      return null;
    }
    
    return data.account.escrowType === SWIFT_PAY;
  }, [data]);

  const isSameWallet = useMemo(() => {
    return publicKey && data.account.maker.equals(publicKey);
  }, [publicKey, data.account.maker]);
  
  const isTaker = useMemo(() => {
    return publicKey && data.account.reservedAmounts.some(
      (reservation: ReservationData) => reservation.taker.equals(publicKey) && (reservation.status === 0 || reservation.status === 1)
    );
  }, [publicKey, data.account.reservedAmounts]);

  // Use cached balance data instead of making additional calls
  const vaultBalance = shouldFetchBalance ? totalBalance : null;

  const currencyStr = useMemo(() => {
    return String.fromCharCode(...data.account.currency).trim();
  }, [data.account.currency]);
  
  
  const pricePerToken = useMemo(() => {
    return data.account.pricePerToken.toString();
  }, [data.account.pricePerToken]);
  
  // Helper function to log reservation details for debugging
  const logReservationDetails = useCallback((reservations: Array<ReservationData>) => {
    if (process.env.NODE_ENV === 'development') {
     
      reservations.forEach((res: ReservationData, index: number) => {
        // Check if taker exists before trying to use it
        const takerDisplay = res.taker ? 
          res.taker.toString().substring(0, 8) + '...' : 
          'N/A';
          
       
      });
    }
  }, []);

  // Fixed calculateAvailableTokens function matching the Rust backend logic
  const calculateAvailableTokens = useCallback((vaultBalance: number | null, reservedAmounts: Array<ReservationData>) => {
    if (vaultBalance === null) return null;
    
    // Log reservation details for debugging
    if (process.env.NODE_ENV === 'development') {
      logReservationDetails(reservedAmounts);
    }
    
    let totalReserved = 0;

    // Filter to only PENDING, PAYMENT_SENT, and DISPUTED statuses
    const lockedReservations = reservedAmounts.filter((r: ReservationData) => r.status === 0 || r.status === 1 || r.status === 4);
  
    for (const reservation of lockedReservations) {
      try {
        const amountStr = reservation.amount.toString();
        const amountNum = parseInt(amountStr, 10);
          
        
        totalReserved += amountNum / 100;
      } catch (error) {
        console.error("Error converting BN to number:", error);
        
        const amountStr = reservation.amount.toString();
        totalReserved += parseInt(amountStr, 10) / 100;
      }
    }
    
    
    // Available tokens = vault balance - total reserved
    const available = vaultBalance - totalReserved;
  
    return Math.max(0, available); 
  }, [logReservationDetails]);
  
  // Calculate available tokens with memoization
  const availableTokens = useMemo(() => 
    calculateAvailableTokens(vaultBalance, data.account.reservedAmounts),
    [vaultBalance, data.account.reservedAmounts, calculateAvailableTokens]
  );

  // Calculate the total amount of tokens in the order
  const totalOrderAmount = useMemo(() => {
    const amountBN = data.account.amount;
    return (amountBN.toNumber() / 100).toFixed(0);
  }, [data.account.amount]);

 const yetToBeFilled = useMemo(() => {

  if (escrowType === SWIFT_PAY && availableBalance !== null) {
    return availableBalance;
  }
  
  
  const med = Number(totalOrderAmount);
  return med - (totalBalance ?? 0);
}, [escrowType, availableBalance, totalOrderAmount, totalBalance]);



  
  // Reduced refresh frequency and only for essential data
  useEffect(() => {
    if (!shouldFetchBalance) return;
    
    // Increase interval to reduce API calls
    const intervalId = setInterval(() => {

      if (document.hasFocus() && (isSameWallet || isTaker)) {
        queryClient.invalidateQueries({
          queryKey: ["get-trust-vault-accounts"],
          refetchType: 'active'
        });
      }
    }, 60000); 
    
    return () => clearInterval(intervalId);
  }, [queryClient, shouldFetchBalance, isSameWallet, isTaker]);

const handleCancelOrReduceBuyOrder = useCallback(async () => {
  if (isSubmitting) return;
  
  const parsedAmount = parseFloat(newAmount);

  if (isNaN(parsedAmount) || parsedAmount <= 0) {
    toast.error("Please enter a valid withdrawal amount.");
    return;
  }

  if (yetToBeFilled === null) {
    toast.error("Available balance calculation is unavailable.");
    return;
  }

  
  if (parsedAmount > yetToBeFilled) {
    toast.error(`Withdrawal amount (${parsedAmount}) exceeds available tokens (${yetToBeFilled}).`);
    return;
  }
  
  setIsSubmitting(true);
  
  try {
    toast.loading("Reducing buy order...");
    
    
    const mintAddress = new PublicKey(data.account.mint);
    const mintInfo = await getMintInfo(mintAddress); 
    
    
    const currentTotalDecimal = data.account.amount.toNumber() / Math.pow(10, mintInfo.decimals);
    
    // Determine the final amount
    let finalAmount: number;
    
    if (parsedAmount >= currentTotalDecimal) {
      // User wants to cancel the entire order
      finalAmount = 0;
      toast.loading("Cancelling buy order...");
    } else {
      // User wants to reduce the order
      finalAmount = currentTotalDecimal - parsedAmount;
      toast.loading("Reducing buy order...");
    }
    
    // Pass the decimal amount to the mutation - let the mutation handle the scaling
    await cancelOrReduceBuyOrder.mutateAsync({ 
      swiftPay: data.publicKey,
      newAmount: finalAmount, // Pass 0 for complete cancellation, otherwise the reduced amount
    });
    
    toast.dismiss();
    toast.success("Buy order reduced successfully");
    
    // Refetch data to update UI
    queryClient.invalidateQueries({
      queryKey: ["get-swiftPay-accounts"],
    });
    
    setNewAmount("");
    setConfirmCancelOpen(false);
  } catch (error) {
    toast.dismiss();
    toast.error("Failed to reduce buy order");
    console.error("Error reducing buy order:", error);
  } finally {
    setIsSubmitting(false);
  }
}, [newAmount, yetToBeFilled, cancelOrReduceBuyOrder, data.publicKey, data.account.amount, queryClient, isSubmitting, getMintInfo]);


  const handleHalfRefund = useCallback(() => {
    if (yetToBeFilled !== null) {
      // Use available tokens (after reservations) instead of vault balance
      const halfBalance = Math.floor((yetToBeFilled / 2) * 100) / 100; // Round to 2 decimal places
      setNewAmount(halfBalance.toString());
    }
  }, [yetToBeFilled]);

  const handleMaxRefund = useCallback(() => {
    if (yetToBeFilled !== null) {
      // Use available tokens (after reservations) instead of vault balance
      setNewAmount(yetToBeFilled.toString());
    }
  }, [yetToBeFilled]);

  // Price update success handler
  const handlePriceUpdateSuccess = () => {
    queryClient.invalidateQueries({
      queryKey: ["get-trust-Express-accounts"],
    });
    toast.success("Price updated successfully");
  };

  // Check for pending reservations effect
  useEffect(() => {
    // Check if there are any pending or payment sent reservations
    const activeReservations = data.account.reservedAmounts.filter(
      (reservation: ReservationData) => reservation.status === 0 || reservation.status === 1
    );
    
    const newValue = activeReservations.length > 0;
    setHasPendingReservations(prev => {
      if (prev === newValue) return prev; 
      return newValue;
    });
  }, [data.account.reservedAmounts]);

  useEffect(() => {
    //check for dispute
    const activeDispute = data.account.reservedAmounts.filter(
      (reservation: ReservationData) => reservation.status === 4
    );
    const newValue = activeDispute.length > 0;
    setHasDispute(prev => {
      if (prev === newValue) return prev; // Prevent unnecessary updates
      return newValue;
    });
  }, [data.account.reservedAmounts]);

  // Get card border class based on user role
  const getCardBorderClass = () => {
    if (isTaker) {
      return "border-amber-500 dark:border-amber-600";
    } else if (isSameWallet) {
      return "border-blue-500 dark:border-blue-600";
    }
    return "";
  };
  
  // Only after all hooks are called, you can have conditional returns
  if (!isValidSwiftPay) {
    return null;
  }

  return (
    <Card className={`group cursor-pointer ${getCardBorderClass()}`}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <RefreshCcw className="text-primary/70 group-hover:animate-spin" />
            Swift Pay
            {isSameWallet && (
              <Badge variant="outline" className="ml-2 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-300">
                You are the Buyer
              </Badge>
            )}
            {isTaker && (
              <Badge variant="outline" className="ml-2 bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-300">
                <Link href="/express/dashboard?tab=pending-reservations">
                You have a Reservation
                </Link>
              </Badge>
            )}
           {publicKey && data.account.maker.equals(publicKey) && hasPendingReservations && (
              <div className="relative ml-2 flex items-center">
                <Link href="/express/dashboard?tab=pending-confirmations" className="flex items-center">
                  <Bell className="h-5 w-5 text-amber-500 animate-pulse cursor-pointer" />
                  <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] text-white">
                    {data.account.reservedAmounts.filter((r: ReservationData) => r.status === 0 || r.status === 1).length}
                  </span>
                </Link>
              </div>
            )}
            {publicKey && data.account.maker.equals(publicKey) && hasDispute && ( 
              <div className="relative ml-2 flex items-center">
                <Link href="/express/dashboard?tab=pending-confirmations" className="flex items-center">
                  <ShieldAlert className="h-5 w-5 text-red-500 animate-pulse cursor-pointer" />
                  <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] text-white">
                    {data.account.reservedAmounts.filter((r: ReservationData) => r.status === 4).length}
                  </span>
                </Link>
              </div>
            )}
          </div>
          
          {isSameWallet && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size={"icon"} variant={"ghost"} className="h-6 w-6 p-0">
                  <span className="sr-only">Open menu</span>
                  <Ellipsis />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-gray-900/80 rounded-lg p-4 border border-gray-600">
                <DropdownMenuLabel>Buyer Actions</DropdownMenuLabel>
                <DropdownMenuSeparator />
                
                {/* Cancel Buy Order option */}
                <AlertDialog open={confirmCancelOpen} onOpenChange={setConfirmCancelOpen}>
                  <AlertDialogTrigger asChild>
                    <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-red-500">
                      <RefreshCwOff className="w-4 h-4 mr-2" />
                      Reduce Buy Order
                    </DropdownMenuItem>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="bg-gray-900/80 rounded-lg p-4 border border-gray-600">
                    <AlertDialogHeader>
                      <AlertDialogTitle className="text-slate-100">Reduce Buy Order</AlertDialogTitle>
                      <AlertDialogDescription className="text-slate-300">
                      You can withdraw a portion of your available tokens from this buy order. This will reduce the total amount available for sellers.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    {/* Display vault balance and available balance */}
                    <div className="mt-4 w-full p-2 border rounded text-slate-100 bg-slate-700 border-slate-600 placeholder-slate-400 focus:border-slate-500 focus:ring-slate-500">
                      <div className="flex justify-between font-medium">
                        <span>Available to reduce:</span>
                        <span className="text-green-600 dark:text-green-400">
                          <TokenDisplay 
                          amount={yetToBeFilled} 
                          symbol={tokenMetadata?.symbol} 
                          logoURI={tokenMetadata?.logoURI}
                        />
                        </span>
                      </div>
                      {hasPendingReservations && (
                        <div className="flex justify-between text-amber-600 dark:text-amber-400">
                          <span>orders filled by sellers:</span>
                          <span>
                            <TokenDisplay 
                              amount={vaultBalance !== null && availableTokens !== null ? 
                                  `${vaultBalance - availableTokens} ` : "Loading..."}
                              symbol={tokenMetadata?.symbol} 
                              logoURI={tokenMetadata?.logoURI}
                            />
                            
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Add Half and Max buttons */}
                    <div className="flex gap-4 mt-4">
                      <Button 
                        variant="outline" 
                        onClick={handleHalfRefund}
                        disabled={yetToBeFilled === null || yetToBeFilled <= 0}
                      >
                        Half
                      </Button>
                      <Button 
                        variant="outline" 
                        onClick={handleMaxRefund}
                        disabled={yetToBeFilled === null || yetToBeFilled <= 0}
                      >
                        Max
                      </Button>
                    </div>

                    <input
                      type="number"
                      value={newAmount}
                      onChange={(e) => setNewAmount(e.target.value)}
                      placeholder="Enter withdrawal amount"
                      className="mt-4 w-full p-2 border rounded text-slate-100 bg-slate-700 border-slate-600 placeholder-slate-400 focus:border-slate-500 focus:ring-slate-500"
                      disabled={yetToBeFilled === null || yetToBeFilled <= 0}
                    />

                    <AlertDialogFooter>
                      <AlertDialogCancel>No, keep it</AlertDialogCancel>
                      <Button 
                        onClick={handleCancelOrReduceBuyOrder} 
                        className={`border border-transparent rounded-md shadow-sm text-sm font-medium text-white 
                          ${
                          isSubmitting || newAmount.trim() === "" || yetToBeFilled === null || yetToBeFilled <= 0
                            ? "bg-slate-600  cursor-not-allowed" 
                            : "bg-red-600 hover:bg-red-700"
                        }`}
                        disabled={isSubmitting || newAmount.trim() === "" || yetToBeFilled === null || yetToBeFilled <= 0}
                      >
                        {isSubmitting ? "Processing..." : "Yes, cancel order"}
                      </Button>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
                
                 {/* Price Update AlertDialog */}
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                        <DollarSign className="w-4 h-4 mr-2 text-green-400"  />
                        Update Token Price
                      </DropdownMenuItem>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Update Token Price</AlertDialogTitle>
                        <AlertDialogDescription>
                          Set a new price per token for your vault. Current price is {pricePerToken} {currencyStr}.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
  
                      <div className="py-4">
                        <UpdatePriceForm 
                          swiftPay={data.publicKey.toString()} 
                          currentPrice={pricePerToken}
                          currency={currencyStr}
                          onSuccess={handlePriceUpdateSuccess} 
                        />
                      </div>
  
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                {hasPendingReservations && (
                  <DropdownMenuItem>
                    <Link href="/express/dashboard?tab=pending-reservations" className="flex items-center">
                      <SendToBack className="w-4 h-4 mr-2" />
                      Manage Reservations
                    </Link>
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </CardTitle>
        <CardDescription className="space-y-2 flex justify-between">
          <div>
            <span className="block">
              <span className="text-gray-500">Seed:</span>
              <span className="text-primary/70 ml-2">
                {ellipsify(data.account.seed.toString())}
              </span>
            </span>
            <span className="flex items-center">
              <span className="text-gray-500">pda:</span>
              <ExplorerLink type="address" value={data.publicKey.toString()}>
                <span className="text-primary/70 text-sm ml-2 flex items-center">
                  {ellipsify(data.publicKey.toString(), 4)}
                  <ExternalLink className="h-3 w-3 ml-1" />
                </span>
              </ExplorerLink>
            </span>
          </div>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Separator />
          <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <CircleUser className="w-4 h-4" />
                  Buyer:
                </div>
                <ExplorerLink type="address" value={data.account.maker.toString()}>
                  <Avatar>
                    <AvatarFallback>
                      {ellipsify(data.account.maker.toString(), 1)}
                    </AvatarFallback>
                  </Avatar>
                </ExplorerLink>
              </div>
        <Separator />

         <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <RedoDot className="w-4 h-4" />
                  Token Address:
                </div>
                <ExplorerLink type="address" value={data.account.mint.toString()}>
                  <span className="text-primary/70 text-sm flex items-center">
                    {ellipsify(data.account.mint.toString(), 4)}
                    <ExternalLink className="h-3 w-3 ml-1" />
                  </span>
                </ExplorerLink>
              </div>
        {/* Available Balance - shown to all users */}
       <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Coins className="w-4 h-4 text-green-600 dark:text-green-400" />
            Available to Fill:
          </div>
          <span className="text-green-600 dark:text-green-400">
            <TokenDisplay 
            amount={availableBalance} 
            symbol={tokenMetadata?.symbol} 
            logoURI={tokenMetadata?.logoURI}
             />
          </span>
        </div>

        
        {/* Only show reserved info to the swift pay maker/owner */}
        {isSameWallet && hasPendingReservations && vaultBalance !== null && availableTokens !== null && (
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-500" />
              Filled Orders:
            </div>
            <span className="text-amber-500 font-medium">
              <TokenDisplay 
            amount={`${vaultBalance - availableTokens}`} 
            symbol={tokenMetadata?.symbol} 
            logoURI={tokenMetadata?.logoURI}
             />
              
            </span>
          </div>
        )}
        
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-green-400" />
            Price per Token:
          </div>
          <span className="font-semibold text-lg">
            {`${pricePerToken} ${currencyStr}`}
          </span>
        </div>
        {isTaker ? (
          <div className="flex flex-col gap-2">
            <Link href="/express/dashboard?tab=pending-reservations">
              <div className="text-center text-sm p-2 bg-amber-100 dark:bg-amber-900 rounded-md cursor-pointer hover:bg-amber-200 dark:hover:bg-amber-800 transition-colors">
                You have a pending reservation for this vault
              </div>
            </Link>
            
          </div>
        ) : isSameWallet ? (
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <span>Protocol Fee Reserve:</span>
              <div className="relative inline-block">
                <Info className="w-3 h-3 text-gray-400 cursor-help hover:text-gray-300 peer" />
                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-64 p-2 bg-gray-800 text-white text-xs rounded opacity-0 invisible peer-hover:opacity-100 peer-hover:visible transition-all duration-200 z-10 pointer-events-none">
                  Fee is charged on successful trades. Refunded if you close the vault early.
                </div>
              </div>
            </div>
            <span className="text-blue-600 dark:text-blue-400 font-medium">
               <TokenDisplay 
                         amount={`${(yetToBeFilled * 0.0005).toFixed(3)}`} 
                         symbol={tokenMetadata?.symbol} 
                          logoURI={tokenMetadata?.logoURI}
                           />
            </span>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
export default BuyOrderCard;