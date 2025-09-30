import { useEffect, useState, useCallback } from "react";
import { getAssociatedTokenAddressSync, getMint, TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { useConnection } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import useSwiftPay from "./useSwiftPay";
import { Connection } from '@solana/web3.js';

// Status enum 
enum ReservationStatus {
  PENDING = 0,
  PAYMENT_SENT = 1,
  COMPLETED = 2,
  CANCELLED = 3,
  DISPUTED = 4,
}

const TRUST_EXPRESS_TYPE_SELL_FIRST = 0;
const SWIFT_PAY = 1;


const BALANCE_BATCH_DELAY = 50; 


interface BatchedMintInfo {
  address: PublicKey;
  decimals: number;
  isToken2022: boolean;
  tokenProgram: PublicKey;
}

interface BatchedSwiftPayInfo {
  escrowType: number;
  reservedFee: { toNumber: () => number };
  amount: { toNumber: () => number };
  reservedAmounts: ReservationData[];
  maker: PublicKey;
  mint: PublicKey;
}

interface ReservationData {
  taker: PublicKey;
  amount: { toString: () => string };
  fiatAmount: { toString: () => string };
  timestamp: { toString: () => string };
  status: number;
  disputeReason?: string;
  disputeId?: string;
}

// Batch management for balance requests
const batchedBalanceRequests = new Map<string, {
  resolve: (value: number) => void;
  reject: (error: Error) => void;
}>();

let balanceBatchTimeout: NodeJS.Timeout | null = null;

// Helper function to batch balance requests
const getBatchedBalance = async (connection: Connection, tokenAccount: PublicKey, tokenProgram: PublicKey): Promise<number> => {
  const key = `${tokenAccount.toString()}-${tokenProgram.toString()}`;
  
  return new Promise((resolve, reject) => {
    batchedBalanceRequests.set(key, { resolve, reject });

    if (balanceBatchTimeout) {
      clearTimeout(balanceBatchTimeout);
    }

    balanceBatchTimeout = setTimeout(async () => {
      const requests = Array.from(batchedBalanceRequests.entries());
      batchedBalanceRequests.clear();

      if (requests.length === 0) return;

      try {
        
        const programGroups = new Map<string, Array<[string, { resolve: (value: number) => void; reject: (error: Error) => void }]>>();
        
        requests.forEach(([key, request]) => {
          const [, programId] = key.split('-');
          if (!programGroups.has(programId)) {
            programGroups.set(programId, []);
          }
          programGroups.get(programId)!.push([key, request]);
        });

        
    for (const [, groupRequests] of programGroups) {
  const pubkeys = groupRequests.map(([key]) => {
    const [accountAddress] = key.split('-');
    return new PublicKey(accountAddress);
  });

  const accounts = await connection.getMultipleAccountsInfo(pubkeys);

  groupRequests.forEach(([, { resolve, reject }], index) => {
    try {
      const accountInfo = accounts[index];
      if (!accountInfo) {
        resolve(0);
        return;
      }

      // Parse token account balance from raw data
      const balance = parseTokenAccountBalance(accountInfo.data);
      resolve(balance);
    } catch (error: unknown) {
      reject(error instanceof Error ? error : new Error(String(error)));
    }
  });
}

      } catch (error: unknown) {
        requests.forEach(([, { reject }]) => reject(error instanceof Error ? error : new Error(String(error))) );
      }
    }, BALANCE_BATCH_DELAY);
  });
};

// Helper function to parse token account balance from raw data
const parseTokenAccountBalance = (data: Buffer): number => {
  try {
    // Token account layout: 32 bytes mint + 32 bytes owner + 8 bytes amount + ...
    const amountOffset = 64;
    const amountBuffer = data.slice(amountOffset, amountOffset + 8);
    return Number(Buffer.from(amountBuffer).readBigUInt64LE());
  } catch {
    return 0;
  }
};

export const useSwiftBalance = (swiftPay: PublicKey | undefined, mintAddress: PublicKey | undefined) => {
  const { connection } = useConnection();
  const [totalBalance, setTotalBalance] = useState<number | null>(null);
  const [availableBalance, setAvailableBalance] = useState<number | null>(null);
  const [lockedBalance, setLockedBalance] = useState<number | null>(null);
  const [reservedFee, setReservedFee] = useState<number | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  // Additional state for buy-first trust vaults
  const [totalWanted, setTotalWanted] = useState<number | null>(null);
  const [totalReserved, setTotalReserved] = useState<number | null>(null);
  const [escrowType, setEscrowType] = useState<number | null>(null);
  
  const swiftPayProgram = useSwiftPay();

  
  const isToken2022 = useCallback(async (mint: PublicKey): Promise<boolean> => {
    try {
      // Use batched mint info if available
      if (swiftPayProgram.getBatchedMintInfo) {
        const mintInfo = await swiftPayProgram.getBatchedMintInfo(mint) as BatchedMintInfo;
        return mintInfo.isToken2022;
      }
      
      // Fallback to individual call
      const mintInfo = await connection.getAccountInfo(mint);
      return mintInfo?.owner.equals(TOKEN_2022_PROGRAM_ID) ?? false;
    } catch {
      return false;
    }
  }, [connection, swiftPayProgram]);



  
   const getMintInfo = useCallback(async (mint: PublicKey): Promise<BatchedMintInfo> => {
    try {
      // Use batched mint info if available
      if (swiftPayProgram.getBatchedMintInfo) {
        return await swiftPayProgram.getBatchedMintInfo(mint) as BatchedMintInfo;
      }
      
      // Fallback to individual call
      const tokenProgram = (await isToken2022(mint)) 
        ? TOKEN_2022_PROGRAM_ID 
        : TOKEN_PROGRAM_ID;
      
      const mintInfo = await getMint(connection, mint, undefined, tokenProgram);
      
      return { 
        address: mint,
        decimals: mintInfo.decimals,
        isToken2022: tokenProgram.equals(TOKEN_2022_PROGRAM_ID),
        tokenProgram
      };
    } catch (error) {
      console.error("Error getting mint info:", error);
      throw error;
    }
  }, [connection, swiftPayProgram, isToken2022]);

  // Utility function to check if vault account exists
  const checkSwiftPayExists = useCallback(async (vaultAddress: PublicKey): Promise<boolean> => {
    try {
      const accountInfo = await connection.getAccountInfo(vaultAddress);
      return accountInfo !== null;
    } catch {
      return false;
    }
  }, [connection]);

  useEffect(() => {
    const fetchSwiftPayBalance = async () => {
      try {
        if (!swiftPay || !mintAddress) {
          setError("Invalid input data.");
          return;
        }

        // Use batched trust vault info if available
        let swiftPayAccount: BatchedSwiftPayInfo;
        if (swiftPayProgram.getBatchedSwiftPayInfo) {
          swiftPayAccount = await swiftPayProgram.getBatchedSwiftPayInfo(swiftPay) as BatchedSwiftPayInfo;
        } else {
          swiftPayAccount = await swiftPayProgram.getSwiftPayInfo(swiftPay) as BatchedSwiftPayInfo;
        }
        
        const escrowTypeValue = swiftPayAccount.escrowType;
        setEscrowType(escrowTypeValue);

        // Get mint info and token program for decimal calculations
        const mintInfo = await getMintInfo(mintAddress);
        const tokenProgram = mintInfo.tokenProgram || (mintInfo.isToken2022 ? TOKEN_2022_PROGRAM_ID : TOKEN_PROGRAM_ID);
        const decimals = mintInfo.decimals || 0;

        // Calculate reserved fee (common to both types)
        const rawReservedFee = swiftPayAccount.reservedFee?.toNumber() || 0;
        const formattedReservedFee = rawReservedFee / Math.pow(10, decimals);
        setReservedFee(formattedReservedFee);

        const vaultAccount = getAssociatedTokenAddressSync(
          mintAddress,
          swiftPay,
          true,
          tokenProgram  
        );
        
        // Check if vault exists first
        const vaultExists = await checkSwiftPayExists(vaultAccount);
        
        // Fetch the vault token account balance with batching
        let vaultBalance = 0;
        
        if (vaultExists) {
          try {
          
            if (swiftPayProgram.getBatchedTokenBalance) {
              const rawBalance = await swiftPayProgram.getBatchedTokenBalance(vaultAccount);
              vaultBalance = rawBalance / Math.pow(10, decimals);
            } else {
              // Fallback to individual call with our own batching
              const rawBalance = await getBatchedBalance(connection, vaultAccount, tokenProgram);
              vaultBalance = rawBalance / Math.pow(10, decimals);
            }
          } catch (vaultError) {
            console.error("Error reading vault account:", vaultError);
            throw vaultError;
          }
        } else {
          vaultBalance = 0;
          
          if (escrowTypeValue === TRUST_EXPRESS_TYPE_SELL_FIRST) {
            console.error("ERROR: Sell-first vault should have tokens but vault account not found");
            setError("Express account not found - this indicates a problem with vault creation");
            return;
          }
        }
        
        setTotalBalance(vaultBalance);

        if (escrowTypeValue === TRUST_EXPRESS_TYPE_SELL_FIRST) {
          let lockedAmount = 0;
          if (swiftPayAccount.reservedAmounts && swiftPayAccount.reservedAmounts.length > 0) {
            const activeReservations = swiftPayAccount.reservedAmounts.filter(
              (r: ReservationData) => r.status === ReservationStatus.PENDING || 
                   r.status === ReservationStatus.PAYMENT_SENT || 
                   r.status === ReservationStatus.DISPUTED
            );
            
            lockedAmount = activeReservations.reduce((total: number, r: ReservationData) => {
              return total + Number(r.amount.toString());
            }, 0);
          }
          
          const formattedLockedBalance = lockedAmount / Math.pow(10, decimals);
          setLockedBalance(formattedLockedBalance);
          
          const available = vaultBalance - formattedLockedBalance - formattedReservedFee;
          setAvailableBalance(available > 0 ? available : 0);
          
          setTotalWanted(null);
          setTotalReserved(null);

        } else if (escrowTypeValue === SWIFT_PAY) {
          const rawTotalWanted = swiftPayAccount.amount?.toNumber() || 0;
          const formattedTotalWanted = rawTotalWanted / Math.pow(10, decimals);
          setTotalWanted(formattedTotalWanted);

          let totalReservedAmount = 0;
          if (swiftPayAccount.reservedAmounts && swiftPayAccount.reservedAmounts.length > 0) {
            const activeReservations = swiftPayAccount.reservedAmounts.filter(
              (r: ReservationData) => r.status === ReservationStatus.PENDING || 
                   r.status === ReservationStatus.PAYMENT_SENT || 
                   r.status === ReservationStatus.DISPUTED
            );
            
            totalReservedAmount = activeReservations.reduce((total: number, r: ReservationData) => {
              return total + Number(r.amount.toString());
            }, 0);
          }
          
          const formattedTotalReserved = totalReservedAmount / Math.pow(10, decimals);
          setTotalReserved(formattedTotalReserved);
          
          if (!vaultExists) {
            setLockedBalance(0);
            setAvailableBalance(formattedTotalWanted);
          } else {
            setLockedBalance(vaultBalance);
            
            const available = formattedTotalWanted - formattedTotalReserved;
            setAvailableBalance(available > 0 ? available : 0);
          }
        }
        
        setError(null);
      } catch (error) {
        console.error("Error fetching vault balance:", error);
        
        let errorMessage = "Failed to fetch vault balance.";
        if (error instanceof Error) {
          if (error.message.includes("TokenInvalidAccountOwnerError")) {
            errorMessage = "Token mint uses unsupported token program or mint account is invalid.";
          } else if (error.message.includes("AccountNotFound")) {
            errorMessage = "Trust vault account not found.";
          } else {
            errorMessage = `Error: ${error.message}`;
          }
        }
        
        setTotalBalance(null);
        setAvailableBalance(null);
        setLockedBalance(null);
        setReservedFee(null);
        setTotalWanted(null);
        setTotalReserved(null);
        setEscrowType(null);
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    };

    if (swiftPay && mintAddress) {
      fetchSwiftPayBalance();
    } else {
      setLoading(false);
      setError("Invalid input data.");
    }
  }, [swiftPay, mintAddress, checkSwiftPayExists, getMintInfo, connection, swiftPayProgram]);

  return { 
    vaultBalance: totalBalance, 
    totalBalance,
    availableBalance,
    lockedBalance,
    reservedFee,
    totalWanted, 
    totalReserved, 
    escrowType, 
    loading, 
    error 
  };
};