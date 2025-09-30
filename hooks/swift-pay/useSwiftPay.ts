import { BN, Program } from "@coral-xyz/anchor";
import useAnchorProvider from "../useAnchorProvider";
import { SwiftPay } from "@/relics/swift-pay/swift_pay";
import idl from "@/relics/swift-pay/swift_pay.json";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { randomBytes } from "crypto";
import {  useWallet } from "@solana/wallet-adapter-react";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import {
  getAssociatedTokenAddressSync,
  getMint,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import transactionDispatcher, {
  TransactionType,
} from "../transactionEventDispatcher";
import { useState, useEffect, useCallback, useMemo } from "react";

interface ReservationData {
  taker: PublicKey;
  amount: BN;
  fiatAmount: BN;
  timestamp: BN;
  status: number;
  disputeReason?: string;
  disputeId?: string;
  payoutDetails?: string; 
  payoutReference?: string; 
}

interface SwiftPayAccountData {
  seed: BN;
  maker: PublicKey;
  mint: PublicKey;
  currency: number[];
  escrowType: number;
  bump: number;
  feePercentage?: number;
  feeDestination?: PublicKey;
  reservedFee?: BN;
  taker?: PublicKey;
  amount?: BN;
  pricePerToken?: BN;
  paymentInstructions?: string;
  reservation?: ReservationData;
  reservedAmounts?: ReservationData[];
}


// Tracking reservation statuses
export enum ReservationStatus {
  PENDING = 0,
  PAYMENT_SENT = 1,
  COMPLETED = 2,
  CANCELLED = 3,
  DISPUTED = 4,
}



type FeeInfo = {
  feePercentage: number;
  feeDestination: PublicKey;
};

// Batching configuration
const BATCH_DELAY = 50; // 50ms batching window

// Batch management for swift pay info
const batchedSwiftPayRequests = new Map<
  string,
  {
    resolve: (value: SwiftPayAccountData) => void;
    reject: (error: Error) => void;
  }
>();

let swiftPayBatchTimeout: NodeJS.Timeout | null = null;

// Batch management for token balances
const batchedBalanceRequests = new Map<
  string,
  {
    resolve: (value: number) => void;
    reject: (error: Error) => void;
  }
>();

let balanceBatchTimeout: NodeJS.Timeout | null = null;

// Batch management for mint info
const batchedMintRequests = new Map<
  string,
  {
     resolve: (value: { address: PublicKey; decimals: number; isToken2022: boolean; tokenProgram: PublicKey }) => void;
    reject: (error: Error) => void;
  }
>();

let mintBatchTimeout: NodeJS.Timeout | null = null;

export default function useSwiftPay() {
  const provider = useAnchorProvider();
  const { publicKey } = useWallet();
const program = useMemo(() => new Program<SwiftPay>(idl as SwiftPay, provider), [provider]);
  const [isConfirmingPayment] = useState(false);
  const queryClient = useQueryClient();
  

  // Optimized batch swift pay info fetcher
const getBatchedSwiftPayInfo = useCallback(async (
  swiftPayPubkey: PublicKey
): Promise<SwiftPayAccountData> => {
  const key = swiftPayPubkey.toString();

  // Check cache first
  const cachedData = queryClient.getQueryData<SwiftPayAccountData>([
    `swift-pay-info-${key}`,
  ]);
  if (cachedData) {
    return cachedData;
  }

  return new Promise((resolve, reject) => {
    batchedSwiftPayRequests.set(key, { resolve, reject });

    if (swiftPayBatchTimeout) {
      clearTimeout(swiftPayBatchTimeout);
    }

    swiftPayBatchTimeout = setTimeout(async () => {
      const requests = Array.from(batchedSwiftPayRequests.entries());
      batchedSwiftPayRequests.clear();

      if (requests.length === 0) return;

      try {
        const pubkeys = requests.map(([key]) => new PublicKey(key));
        const accounts = await provider.connection.getMultipleAccountsInfo(
          pubkeys
        );

        requests.forEach(([key, { resolve, reject }], index) => {
          try {
            const accountInfo = accounts[index];
            if (!accountInfo) {
              reject(new Error(`Swift pay account not found: ${key}`));
              return;
            }

            // Parse the account data using the program
            const parsedData =
              program.account.swiftPay.coder.accounts.decode(
                "swiftPay",
                accountInfo.data
              ) as SwiftPayAccountData;

            // Cache the result
            queryClient.setQueryData(
              [`swift-pay-info-${key}`],
              parsedData,
              {
                updatedAt: Date.now(),
              }
            );

            resolve(parsedData);
          } catch (error: unknown) {
            reject(error instanceof Error ? error : new Error(String(error)));
          }
        });
      } catch (error: unknown) {
        requests.forEach(([, { reject }]) => 
          reject(error instanceof Error ? error : new Error(String(error)))
        );
      }
    }, BATCH_DELAY);
  });
}, [provider, program, queryClient]);

  // Optimized batch token balance fetcher
  const getBatchedTokenBalance = async (
    tokenAccount: PublicKey
  ): Promise<number> => {
    const key = tokenAccount.toString();

    // Check cache first
    const cachedBalance = queryClient.getQueryData<number>([
      `token-balance-${key}`,
    ]);
    if (cachedBalance !== undefined) {
      return cachedBalance;
    }

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
          const pubkeys = requests.map(([key]) => new PublicKey(key));
          const accounts = await provider.connection.getMultipleAccountsInfo(
            pubkeys
          );

          requests.forEach(([key, { resolve, reject }], index) => {
            try {
              const accountInfo = accounts[index];
              if (!accountInfo) {
                resolve(0); // Account doesn't exist, balance is 0
                return;
              }

              // Parse token account data manually for better performance
              const balance = parseTokenAccountBalance(accountInfo.data);

              // Cache for 30 seconds
              queryClient.setQueryData([`token-balance-${key}`], balance, {
                updatedAt: Date.now(),
              });

              resolve(balance);
            } catch (error: unknown) {
              reject(error instanceof Error ? error : new Error(String(error)));
            }
          });
        } catch (error) {
          requests.forEach(([, { reject }]) => reject(error instanceof Error ? error : new Error(String(error))) );
        }
      }, BATCH_DELAY);
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

 // Optimized batch mint info fetcher
const getBatchedMintInfo = async (mintPubkey: PublicKey) => {
  const key = mintPubkey.toString();

  // Check cache first
  const cachedMintInfo = queryClient.getQueryData([`mint-info-${key}`]);
  if (cachedMintInfo) {
    return cachedMintInfo;
  }

  return new Promise((resolve, reject) => {
    batchedMintRequests.set(key, { resolve, reject });

    if (mintBatchTimeout) {
      clearTimeout(mintBatchTimeout);
    }

    mintBatchTimeout = setTimeout(async () => {
      const requests = Array.from(batchedMintRequests.entries());
      batchedMintRequests.clear();

      if (requests.length === 0) return;

      try {
        const pubkeys = requests.map(([key]) => new PublicKey(key));
        const accounts = await provider.connection.getMultipleAccountsInfo(
          pubkeys
        );

        requests.forEach(([key, { resolve, reject }], index) => {
          try {
            const accountInfo = accounts[index];
            if (!accountInfo) {
              reject(new Error(`Mint account not found: ${key}`));
              return;
            }

            const isToken2022 = accountInfo.owner.equals(
              TOKEN_2022_PROGRAM_ID
            );
            const tokenProgram = isToken2022
              ? TOKEN_2022_PROGRAM_ID
              : TOKEN_PROGRAM_ID;

            const mintInfo = {
              address: new PublicKey(key),
              decimals: accountInfo.data[44], // Decimals at offset 44
              isToken2022,
              tokenProgram,
            };

            // Cache for 5 minutes (mint info rarely changes)
            queryClient.setQueryData([`mint-info-${key}`], mintInfo, {
              updatedAt: Date.now(),
            });

            resolve(mintInfo);
          } catch (error: unknown) {
            reject(error instanceof Error ? error : new Error(String(error)));
          }
        });
      } catch (error: unknown) {
        requests.forEach(([, { reject }]) => 
          reject(error instanceof Error ? error : new Error(String(error)))
        );
      }
    }, BATCH_DELAY);
  });
};

  const isToken2022 = async (mint: PublicKey) => {
    try {
      const mintInfo = await provider.connection.getAccountInfo(mint);

      if (!mintInfo || !mintInfo.owner) {
        console.warn(`Could not fetch mint info for ${mint.toString()}`);
        return false;
      }

      return mintInfo.owner.equals(TOKEN_2022_PROGRAM_ID);
    } catch (error) {
      console.error(
        `Error checking if mint ${mint.toString()} is Token2022:`,
        error
      );
      return false;
    }
  };

  const getMintInfo = async (mint: PublicKey) => {
    try {
      const tokenProgram = (await isToken2022(mint))
        ? TOKEN_2022_PROGRAM_ID
        : TOKEN_PROGRAM_ID;

      return await getMint(provider.connection, mint, undefined, tokenProgram);
    } catch (error) {
      console.error(`Error getting mint info for ${mint.toString()}:`, error);
      throw new Error(
        `Failed to fetch mint information: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  };

  const getSwiftPayInfo = useCallback(
    async (SwiftPay: PublicKey): Promise<SwiftPayAccountData> => {
      // Try batched version first, fallback to individual call
      try {
        return await getBatchedSwiftPayInfo(SwiftPay);
      } catch (error) {
        console.warn(
          "Batched request failed, falling back to individual call:",
          error
        );
        return program.account.swiftPay.fetch(
          SwiftPay
        ) as Promise<SwiftPayAccountData>;
      }
    },
    [program, getBatchedSwiftPayInfo]
  );

  const getGlobalState = useQuery({
    queryKey: ["get-global-state"],
    queryFn: async () => {
      const maxRetries = 3;
      let retryCount = 0;
      let backoffTime = 1000;

      const executeQuery = async (): Promise<unknown> => {
        try {
          const [globalState] = PublicKey.findProgramAddressSync(
            [Buffer.from("global-state")],
            program.programId
          );

          return await program.account.globalState.fetch(globalState);
        } catch (error: unknown) {
          const isRateLimitError =
            (error instanceof Error && error.message?.includes("429")) ||
            (typeof error === "object" &&
              error !== null &&
              "toString" in error &&
              error.toString().includes("429")) ||
            (typeof error === "object" &&
              error !== null &&
              "code" in error &&
              error.code === 429);

          const isConnectionError =
            error instanceof Error &&
            (error.message?.includes("failed to fetch") ||
              error.message?.includes("network error"));

          if (
            (isRateLimitError || isConnectionError) &&
            retryCount < maxRetries
          ) {
            console.warn(
              `Query failed, retrying in ${backoffTime}ms (attempt ${
                retryCount + 1
              }/${maxRetries})`,
              error
            );
            retryCount++;
            await new Promise((resolve) => setTimeout(resolve, backoffTime));
            backoffTime *= 2;
            return executeQuery();
          }

          console.error("Error fetching global state after retries:", error);
          return null;
        }
      };

      return executeQuery();
    },
    staleTime: 30000,
    refetchOnWindowFocus: false,
    refetchInterval: false,
    retry: false,
  });

  const dispatchPaymentConfirmedEvent = (
    swiftPay: PublicKey,
    reservationIndex: number,
    amount?: number
  ) => {
  

    const eventDetail = {
      type: TransactionType.PAYMENT_CONFIRMED,
      signature: `recovery-${Date.now()}`,
      timestamp: Date.now(),
      swiftPay: swiftPay,
      details: {
        reservationIndex: reservationIndex,
      },
      amount: amount,
    };

    localStorage.setItem(
      "last_swiftPay_transaction",
      JSON.stringify(eventDetail)
    );

    transactionDispatcher.dispatchEvent(eventDetail);

    return true;
  };

  
  const getSwiftPayAccounts = useQuery({
    queryKey: ["get-swift-pay-accounts"],
    queryFn: async () => {
      const maxRetries = 3;
      let retryCount = 0;
      let backoffTime = 1000;

      const executeQuery = async () => {
        try {
          const responses = await program.account.swiftPay.all();
          const sortedResponses = responses.sort((a, b) =>
            a.account.seed.cmp(b.account.seed)
          );

          // Pre-populate cache for individual swift pay info
          sortedResponses.forEach((response) => {
            const key = response.publicKey.toString();
            queryClient.setQueryData(
              [`swift-pay-info-${key}`],
              response.account,
              {
                updatedAt: Date.now(),
              }
            );
          });

          return sortedResponses;
        } catch (error: unknown) {
          if (retryCount >= maxRetries) {
            console.error(
              "Max retries reached when fetching swiftPay accounts:",
              error
            );
            throw error;
          }

          const isRateLimitError =
            (error instanceof Error && error.message?.includes("429")) ||
            (typeof error === "object" &&
              error !== null &&
              "toString" in error &&
              error.toString().includes("429")) ||
            (typeof error === "object" &&
              error !== null &&
              "code" in error &&
              error.code === 429);

          const isConnectionError =
            error instanceof Error &&
            (error.message?.includes("failed to fetch") ||
              error.message?.includes("network error"));

          if (isRateLimitError || isConnectionError) {
            console.warn(
              `Rate limit or connection error, retrying in ${backoffTime}ms (attempt ${
                retryCount + 1
              }/${maxRetries})`,
              error
            );
            retryCount++;
            await new Promise((resolve) => setTimeout(resolve, backoffTime));
            backoffTime *= 2;
            return executeQuery();
          } else {
            console.error("Error fetching swiftPay accounts:", error);
            throw error;
          }
        }
      };

      return executeQuery();
    },
    staleTime: 120000, 
    refetchOnWindowFocus: false,
    refetchInterval: false,
    retry: false,
  });

  useEffect(() => {
    const intervalId = setInterval(() => {
      const swiftPayAccountsQuery = queryClient.getQueryCache().find({
        queryKey: ["get-swift-pay-accounts"],
      });

      const globalStateQuery = queryClient.getQueryCache().find({
        queryKey: ["get-global-state"],
      });

      const liquidityProvidersQuery = queryClient.getQueryCache().find({
        queryKey: ["liquidity-providers"],
      });

      if (
        swiftPayAccountsQuery &&
        swiftPayAccountsQuery.getObserversCount() > 0 &&
        swiftPayAccountsQuery.state.fetchStatus !== "fetching"
      ) {
        
        queryClient.invalidateQueries({
          queryKey: ["get-swift-pay-accounts"],
          refetchType: "active",
        });
      }

      if (
        globalStateQuery &&
        globalStateQuery.getObserversCount() > 0 &&
        globalStateQuery.state.fetchStatus !== "fetching"
      ) {
        queryClient.invalidateQueries({
          queryKey: ["get-global-state"],
          refetchType: "active",
        });
      }

      if (
        liquidityProvidersQuery &&
        liquidityProvidersQuery.getObserversCount() > 0 &&
        liquidityProvidersQuery.state.fetchStatus !== "fetching"
      ) {
        queryClient.invalidateQueries({
          queryKey: ["liquidity-providers"],
          refetchType: "active",
        });
      }
    }, 120000); 

    return () => clearInterval(intervalId);
  }, [queryClient]);

  const calculateFeeAmount = (amount: BN, feePercentage: number): BN => {
    const feeDecimal = feePercentage / 10000;
    return amount.muln(Math.floor(feeDecimal * 10000) / 10000);
  };

  
  const getSwiftPayFeeInfo = useCallback(
    async (swiftPay: PublicKey): Promise<FeeInfo> => {
      const cacheKey = `fee-info-${swiftPay.toString()}`;

      const cachedData = queryClient.getQueryData<FeeInfo>([cacheKey]);
      if (cachedData) {
        return cachedData;
      }

      const maxRetries = 5;
      let retryCount = 0;
      let delay = 500;

      while (retryCount < maxRetries) {
        try {
          const info = await getSwiftPayInfo(swiftPay);
          const result: FeeInfo = {
            feePercentage: info.feePercentage || 0,
            feeDestination:
              info.feeDestination ||
              new PublicKey("11111111111111111111111111111111"),
          };

          // Cache with longer expiration for fee info
          queryClient.setQueryData<FeeInfo>([cacheKey], result, {
            updatedAt: Date.now(),
          });
          return result;
        } catch (error: unknown) {
          if (error instanceof Error && error.message && error.message.includes("429")) {
    retryCount++;


            await new Promise((resolve) => setTimeout(resolve, delay));
            delay *= 2;
          } else {
            throw error;
          }
        }
      }

      throw new Error("Failed to fetch fee info after multiple retries");
    },
    [queryClient, getSwiftPayInfo]
  );

  const useFeeInfo = (swiftPay: PublicKey | undefined) => {
  return useQuery<FeeInfo, Error>({
    queryKey: swiftPay ? [`fee-info-${swiftPay.toString()}`] : [],
    queryFn: () =>
      swiftPay
        ? getSwiftPayFeeInfo(swiftPay)
        : Promise.reject("No swift pay provided"),
    enabled: !!swiftPay,
    staleTime: 5 * 60 * 1000,
    retry: (failureCount, error: Error) => {
      if (error.message && error.message.includes("429")) {
        return failureCount < 5;
      }
      return failureCount < 3;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
};

  const initializeGlobalState = useMutation({
    mutationKey: ["initialize-global-state"],
    mutationFn: async () => {
      if (!publicKey) {
        console.error("No public key available!");
        return;
      }

      try {
        const [globalState] = PublicKey.findProgramAddressSync(
          [Buffer.from("global-state")],
          program.programId
        );

        const signature = await program.methods
          .initializeGlobalState()
          .accountsPartial({
            authority: publicKey,
            globalState: globalState,
            systemProgram: SystemProgram.programId,
          })
          .rpc();

        transactionDispatcher.dispatchEvent({
          type: TransactionType.GLOBAL_STATE_INITIALIZED,
          signature,
          timestamp: Date.now(),
          details: {
            authority: publicKey.toString(),
          },
        });

        return signature;
      } catch (error) {
        console.error("Error in initializeGlobalState execution:", error);
        throw error;
      }
    },
    onError: (error) => {
      console.error(
        "Error initializing global state (from onError handler):",
        error
      );
      if (error instanceof Error) {
        console.error("Error name:", error.name);
        console.error("Error message:", error.message);
        console.error("Error stack:", error.stack);
      }
    },
  });

  const updatePrice = useMutation({
    mutationKey: ["update-price"],
    mutationFn: async (params: {
      swiftPay: PublicKey;
      newPricePerToken: number;
    }) => {
      if (!publicKey) {
        throw new Error("Wallet not connected");
      }

      const { swiftPay, newPricePerToken } = params;

      try {
        const swiftPayAccount = await getSwiftPayInfo(swiftPay);

        if (!swiftPayAccount.maker.equals(publicKey)) {
          throw new Error("Only the swift pay creator can update the price");
        }
        const newPriceBN = new BN(newPricePerToken);
        const currentPrice = Number(
          (swiftPayAccount.pricePerToken || new BN(0)).toString()
        );

      

        const signature = await program.methods
          .updatePrice(newPriceBN)
          .accountsPartial({
            maker: publicKey,
            swiftPay,
          })
          .rpc();

        transactionDispatcher.dispatchEvent({
          type: TransactionType.PRICE_UPDATED,
          swiftPay,
          signature,
          timestamp: Date.now(),
          details: {
            oldPrice: currentPrice,
            newPrice: newPricePerToken,
            currency: String.fromCharCode(...swiftPayAccount.currency).trim(),
            maker: publicKey.toString(),
          },
        });

        return signature;
      } catch (error) {
        console.error("Error updating price:", error);
        throw error;
      }
    },
    onError: (error) => {
      console.error("Error during update-price:", error);
    },
  });


  const calculateAmountAfterFee = async (
    amount: number,
    swiftPay: PublicKey
  ) => {
    const swiftPayAccount = await getSwiftPayInfo(swiftPay);
    const feePercentage = swiftPayAccount.feePercentage || 0;
    const feeAmount = amount * (feePercentage / 10000);
    return amount - feeAmount;
  };

  const calculateRemainingFee = async (
    swiftPay: PublicKey,
    refundAmount: number,
    originalDeposit: number
  ) => {
    const swiftPayAccount = await getSwiftPayInfo(swiftPay);
    const mintInfo = await getMintInfo(swiftPayAccount.mint);
    const decimals = mintInfo.decimals;

    const totalReservedFee =
      (swiftPayAccount.reservedFee || new BN(0)).toNumber() / 10 ** decimals;
    const refundRatio = refundAmount / originalDeposit;
    const feeToRefund = totalReservedFee * refundRatio;

    return feeToRefund;
  };

  const getAvailableSwiftPayBalance = async (swiftPay: PublicKey) => {
    const swiftPayAccount = await getSwiftPayInfo(swiftPay);

    const totalReserved = (swiftPayAccount.reservedAmounts || [])
      .filter(
        (reservation: ReservationData) =>
          reservation.status === ReservationStatus.PENDING ||
          reservation.status === ReservationStatus.PAYMENT_SENT
      )
      .reduce(
        (total: BN, reservation: ReservationData) =>
          total.add(reservation.amount),
        new BN(0)
      );

    const tokenProgram = (await isToken2022(swiftPayAccount.mint))
      ? TOKEN_2022_PROGRAM_ID
      : TOKEN_PROGRAM_ID;

    const swift_pay = getAssociatedTokenAddressSync(
      swiftPayAccount.mint,
      swiftPay,
      true,
      tokenProgram
    );

    try {
      const tokenBalance = await provider.connection.getTokenAccountBalance(
        swift_pay
      );
      const actualBalance = new BN(tokenBalance.value.amount);

      return {
        total: actualBalance,
        reserved: totalReserved,
        available: actualBalance.sub(totalReserved),
        reservedFee: swiftPayAccount.reservedFee || new BN(0),
      };
    } catch (error) {
      console.error("Error getting token account balance:", error);
      throw error;
    }
  };


  const cancelOrReduceBuyOrder = useMutation({
    mutationKey: ["cancel-or-reduce-buy-order"],
    mutationFn: async (params: {
      swiftPay: PublicKey;
      newAmount: number;
    }) => {
      const { swiftPay, newAmount } = params;

      if (!publicKey) {
        throw new Error("Wallet not connected");
      }

      const swiftPayAccount = await getSwiftPayInfo(swiftPay);

      if (!swiftPayAccount.maker.equals(publicKey)) {
        throw new Error("Only the buyer can modify this order");
      }

      if (newAmount < 0) {
        throw new Error("Amount cannot be negative");
      }

      const totalReserved = (swiftPayAccount.reservedAmounts || [])
        .filter(
          (r: ReservationData) =>
            r.status !== ReservationStatus.CANCELLED &&
            r.status !== ReservationStatus.COMPLETED &&
            r.status !== ReservationStatus.DISPUTED
        )
        .reduce((sum: BN, r: ReservationData) => sum.add(r.amount), new BN(0));

      const mintInfo = await getMintInfo(
        new PublicKey(swiftPayAccount.mint)
      );

      const newAmountSmallestUnit = new BN(
        Math.floor(newAmount * 10 ** mintInfo.decimals)
      );

      const currentAmount = swiftPayAccount.amount || new BN(0);

      if (newAmount === 0) {
        if (totalReserved.gt(new BN(0))) {
          throw new Error(
            `Cannot cancel order with active reservations (${
              totalReserved.toNumber() / 10 ** mintInfo.decimals
            } tokens reserved)`
          );
        }
      } else {
        if (newAmountSmallestUnit.gte(currentAmount)) {
          throw new Error(
            `New amount (${newAmount}) must be less than current amount (${
              currentAmount.toNumber() / 10 ** mintInfo.decimals
            })`
          );
        }

        if (newAmountSmallestUnit.lt(totalReserved)) {
          throw new Error(
            `Cannot reduce below reserved amount (${
              totalReserved.toNumber() / 10 ** mintInfo.decimals
            } tokens reserved)`
          );
        }
      }

      const tokenProgram = (await isToken2022(swiftPayAccount.mint))
        ? TOKEN_2022_PROGRAM_ID
        : TOKEN_PROGRAM_ID;


      const isFullCancellation = newAmount === 0;

      const signature = await program.methods
        .cancelOrReduceBuyOrder(newAmountSmallestUnit)
        .accountsPartial({
          buyer: publicKey,
          swiftPay,
          tokenProgram,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .rpc();


      const eventType =
        newAmount === 0
          ? TransactionType.BUY_ORDER_CANCELLED
          : TransactionType.BUY_ORDER_REDUCED;

      transactionDispatcher.dispatchEvent({
        type: eventType,
        swiftPay,
        signature,
        timestamp: Date.now(),
        details: {
          buyer: publicKey.toString(),
          originalAmount: currentAmount.toNumber() / 10 ** mintInfo.decimals,
          newAmount,
          totalReserved: totalReserved.toNumber() / 10 ** mintInfo.decimals,
          isFullCancellation,
        },
      });

      return signature;
    },
    onError: (error) => {
      console.error("Error during cancel or reduce buy order:", error);
    },
  });

 const createBuyOrder = useMutation({
    mutationKey: ["create-buy-order"],
    mutationFn: async (params: {
      mint_a: string;
      amount: number;
      pricePerToken: number;
      currency: string;
      paymentInstructions: string;
    }) => {
      if (!publicKey) {
        throw new Error("Wallet not connected");
      }

      try {
        const seed = new BN(randomBytes(8));

        const {
          mint_a,
          amount,
          pricePerToken,
          currency,
          paymentInstructions,
        } = params;

        const mint = new PublicKey(mint_a);

        const isToken2022Result = await isToken2022(mint);
        const tokenProgram = isToken2022Result
          ? TOKEN_2022_PROGRAM_ID
          : TOKEN_PROGRAM_ID;

        let mintInfo;
        try {
          mintInfo = await getMint(
            program.provider.connection,
            mint,
            undefined,
            tokenProgram
          );
        } catch (error) {
            console.log("Error fetching mint info:", error);
          throw new Error("failed to get mint information");
        }

        const amountBN = new BN(Math.floor(amount * 10 ** mintInfo.decimals));
        const pricePerTokenBN = new BN(pricePerToken);

        const validCurrency =
          currency.length === 3
            ? currency
            : currency.padEnd(3, " ").substring(0, 3);

        const [globalState] = PublicKey.findProgramAddressSync(
          [Buffer.from("global-state")],
          program.programId
        );

        const maxAllowed = 500;
        const validPaymentInstructions =
          paymentInstructions.length <= maxAllowed
            ? paymentInstructions
            : paymentInstructions.substring(0, maxAllowed);

        const [swiftPay] = PublicKey.findProgramAddressSync(
          [
            Buffer.from("swift-pay"),
            publicKey.toBuffer(),
            seed.toArrayLike(Buffer, "le", 8),
          ],
          program.programId
        );

        const signature = await program.methods
          .createBuyOrder(
            seed,
            amountBN,
            pricePerTokenBN,
            validCurrency,
            validPaymentInstructions
          )
          .accountsPartial({
            buyer: publicKey,
            mint,
            swiftPay,
            globalState,
            systemProgram: SystemProgram.programId,
            tokenProgram: tokenProgram,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          })
          .rpc();

        transactionDispatcher.dispatchEvent({
          type: TransactionType.BUY_ORDER_CREATED,
          swiftPay,
          amount,
          signature,
          timestamp: Date.now(),
          details: {
            mint: mint_a,
            pricePerToken,
            currency: validCurrency,
            swiftPayPubkey: swiftPay.toString(),
          },
        });

        return {
          signature,
          swiftPayPubkey: swiftPay.toString(),
        };
      } catch (error) {
        console.error("Error creating buy order:", error);
        throw error;
      }
    },
    onError: (error) => {
      console.error("Error during create-buy-order:", error);
    },
  });


const instantReserve = useMutation({
  mutationKey: ["instant-reserve"],
  mutationFn: async (params: {
    swiftPay: PublicKey;
    amount: number;
    fiatAmount: number;
    currency: string;
    payoutDetails?: string;
  }) => {
    if (!publicKey) {
      throw new Error("Wallet not connected");
    }

    const { swiftPay, amount, fiatAmount, currency, payoutDetails } = params;

    try {
      const swiftPayAccount = await getSwiftPayInfo(swiftPay);
      const mintInfo = await getMintInfo(swiftPayAccount.mint);
      
      const amountBN = new BN(Math.floor(amount * 10 ** mintInfo.decimals));
      const fiatAmountBN = new BN(fiatAmount);

      const tokenProgram = (await isToken2022(swiftPayAccount.mint))
        ? TOKEN_2022_PROGRAM_ID
        : TOKEN_PROGRAM_ID;

      console.log('🔍 DEBUG: Token program info:', {
        mint: swiftPayAccount.mint.toString(),
        isToken2022: await isToken2022(swiftPayAccount.mint),
        tokenProgram: tokenProgram.toString()
      });

      const takerAta = getAssociatedTokenAddressSync(
        swiftPayAccount.mint,
        publicKey,
        false,
        tokenProgram
      );

      const swiftPayAta = getAssociatedTokenAddressSync(
        swiftPayAccount.mint,
        swiftPay,
        true,
        tokenProgram
      );

      console.log('🔍 DEBUG: ATA addresses:', {
        takerAta: takerAta.toString(),
        swiftPayAta: swiftPayAta.toString(),
        taker: publicKey.toString(),
        swiftPay: swiftPay.toString()
      });

      const signature = await program.methods
        .instantReserve(amountBN, fiatAmountBN, currency, payoutDetails || null)
        .accountsPartial({
          swiftPay,
          maker: swiftPayAccount.maker,
          taker: publicKey,
          mint: swiftPayAccount.mint,
          takerAta: takerAta,       
          swiftPayAta: swiftPayAta,   
          tokenProgram,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      transactionDispatcher.dispatchEvent({
        type: TransactionType.INSTANT_PAYMENT_RESERVED,
        swiftPay,
        amount,
        signature,
        timestamp: Date.now(),
        details: {
          taker: publicKey.toString(),
          fiatAmount,
          currency,
          payoutDetails,
        },
      });

      return signature;
    } catch (error) {
      console.error("Error during instant reserve:", error);
      throw error;
    }
  },
  onError: (error) => {
    console.error("Error during instant-reserve:", error);
  },
});

const confirmPayout = useMutation({
  mutationKey: ["confirm-payout"],
  mutationFn: async (params: {
    swiftPay: PublicKey;
    taker: PublicKey;
    amount: number;
    fiatAmount: number;
    currency: string;
    payoutReference: string;
    success: boolean;
    message: string;
  }) => {
    if (!publicKey) {
      throw new Error("Wallet not connected");
    }

    const { 
      swiftPay, 
      taker, 
      amount, 
      fiatAmount, 
      currency, 
      payoutReference, 
      success, 
      message 
    } = params;

    try {
      const swiftPayAccount = await getSwiftPayInfo(swiftPay);
      const mintInfo = await getMintInfo(swiftPayAccount.mint);
      
      const amountBN = new BN(Math.floor(amount * 10 ** mintInfo.decimals));
      const fiatAmountBN = new BN(fiatAmount);

      const tokenProgram = (await isToken2022(swiftPayAccount.mint))
        ? TOKEN_2022_PROGRAM_ID
        : TOKEN_PROGRAM_ID;

      const swiftPayAta = getAssociatedTokenAddressSync(
        swiftPayAccount.mint,
        swiftPay,
        true,
        tokenProgram
      );

      const takerAta = getAssociatedTokenAddressSync(
        swiftPayAccount.mint,
        taker,
        false,
        tokenProgram
      );

      const feeDestination = swiftPayAccount.feeDestination ||
        new PublicKey("BoWaX34cU74HMhCym4t3W1NvieQJKJ3P7ZU8BZSyVKum");

      const feeDestinationAta = getAssociatedTokenAddressSync(
        swiftPayAccount.mint,
        feeDestination,
        false,
        tokenProgram
      );

      const signature = await program.methods
        .confirmPayout(
          taker,
          amountBN,
          fiatAmountBN,
          currency,
          payoutReference,
          success,
          message
        )
        .accountsPartial({
          swiftPay,
          botAuthority: publicKey,
          maker: swiftPayAccount.maker,
          swiftPayAta: swiftPayAta,
          feeDestinationAta: success ? feeDestinationAta : undefined,
          takerAta: success ? takerAta : undefined,
          tokenProgram,
        })
        .rpc();

      transactionDispatcher.dispatchEvent({
        type: success ? TransactionType.INSTANT_PAYMENT_SUCCESS : TransactionType.INSTANT_PAYMENT_FAILED,
        swiftPay,
        amount,
        signature,
        timestamp: Date.now(),
        details: {
          taker: taker.toString(),
          fiatAmount,
          currency,
          payoutReference,
          message,
        },
      });

      return signature;
    } catch (error) {
      console.error("Error confirming payout:", error);
      throw error;
    }
  },
  onError: (error) => {
    console.error("Error during confirm-payout:", error);
  },
});

  return {
    program,
    getGlobalState,
    getSwiftPayAccounts,
    getSwiftPayInfo,
    getMintInfo,
    isConfirmingPayment,
    dispatchPaymentConfirmedEvent,
    updatePrice,
    initializeGlobalState,
    createBuyOrder,
    cancelOrReduceBuyOrder,
    instantReserve,
    confirmPayout,
    getSwiftPayFeeInfo,
    useFeeInfo,
    calculateFeeAmount,
    calculateAmountAfterFee,
    calculateRemainingFee,
    getAvailableSwiftPayBalance,
    getBatchedSwiftPayInfo,
    getBatchedTokenBalance,
    getBatchedMintInfo,
  };
}
