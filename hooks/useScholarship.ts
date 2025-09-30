"use client";
import { BN, Program } from "@coral-xyz/anchor";
import useAnchorProvider from "./useAnchorProvider";
import { Scholarship } from "@/relics/scholarship/scholarship";
import idl from "@/relics/scholarship/scholarship.json";
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
import {  useEffect, useCallback } from "react";

// TypeScript interfaces for scholarship data
interface ScholarshipRequest {
  student: PublicKey;
  amount: BN;
  approvedAmount: BN;
  timestamp: BN;
  scholarshipReason: string;
  status: number;
  lecturerResponse: string;
}


interface ScholarshipAccountData {
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

interface GlobalScholarshipState {
  totalScholarshipsCreated: BN;
  totalScholarshipsClosed: BN;
  totalRequestsApproved: BN;
  totalRequestsRejected: BN;
  totalVolumeDisbursed: BN;
  bump: number;
}

// Batch request interfaces for type safety
interface BatchRequestCallbacks<T> {
  resolve: (value: T) => void;
  reject: (error: Error) => void;
}

// Scholarship request status enum
export enum ScholarshipRequestStatus {
  PENDING = 0,
  APPROVED = 1,
  REJECTED = 2,
}

// Batching configuration
const BATCH_DELAY = 50; // 50ms batching window


// Batch management for scholarship info
const batchedScholarshipRequests = new Map<
  string,
  BatchRequestCallbacks<ScholarshipAccountData>
>();

let scholarshipBatchTimeout: NodeJS.Timeout | null = null;

// Batch management for token balances
const batchedBalanceRequests = new Map<
  string,
  BatchRequestCallbacks<number>
>();

let balanceBatchTimeout: NodeJS.Timeout | null = null;

export default function useScholarshipProgram() {
  const provider = useAnchorProvider();
  const { publicKey } = useWallet();
  const program = new Program<Scholarship>(idl as Scholarship, provider);
  const queryClient = useQueryClient();


  // Helper function to parse token account balance from raw data
  const parseTokenAccountBalance = useCallback((data: Buffer): number => {
    try {
      // Token account layout: 32 bytes mint + 32 bytes owner + 8 bytes amount + ...
      const amountOffset = 64;
      const amountBuffer = data.slice(amountOffset, amountOffset + 8);
      return Number(Buffer.from(amountBuffer).readBigUInt64LE());
    } catch {
      return 0;
    }
  }, []);

  // Optimized batch scholarship info fetcher
  const getBatchedScholarshipInfo = useCallback(
    async (scholarshipPubkey: PublicKey): Promise<ScholarshipAccountData> => {
      const key = scholarshipPubkey.toString();

      // Check cache first
      const cachedData = queryClient.getQueryData<ScholarshipAccountData>([
        `scholarship-info-${key}`,
      ]);
      if (cachedData) {
        return cachedData;
      }

      return new Promise<ScholarshipAccountData>((resolve, reject) => {
        batchedScholarshipRequests.set(key, { resolve, reject });

        if (scholarshipBatchTimeout) {
          clearTimeout(scholarshipBatchTimeout);
        }

        scholarshipBatchTimeout = setTimeout(async () => {
          const requests = Array.from(batchedScholarshipRequests.entries());
          batchedScholarshipRequests.clear();

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
                  reject(new Error(`Scholarship account not found: ${key}`));
                  return;
                }

                // Parse the account data using the program
                const parsedData =
                  program.account.scholarship.coder.accounts.decode(
                    "scholarship",
                    accountInfo.data
                  ) as ScholarshipAccountData;

                // Cache the result
                queryClient.setQueryData(
                  [`scholarship-info-${key}`],
                  parsedData,
                  {
                    updatedAt: Date.now(),
                  }
                );

                resolve(parsedData);
              } catch (error) {
                reject(error instanceof Error ? error : new Error(String(error)));
              }
            });
          } catch (error) {
            requests.forEach(([, { reject }]) => 
              reject(error instanceof Error ? error : new Error(String(error)))
            );
          }
        }, BATCH_DELAY);
      });
    },
    [provider.connection, program.account.scholarship.coder.accounts, queryClient]
  );

  // Optimized batch token balance fetcher
  const getBatchedTokenBalance = useCallback(
    async (tokenAccount: PublicKey): Promise<number> => {
      const key = tokenAccount.toString();

      // Check cache first
      const cachedBalance = queryClient.getQueryData<number>([
        `token-balance-${key}`,
      ]);
      if (cachedBalance !== undefined) {
        return cachedBalance;
      }

      return new Promise<number>((resolve, reject) => {
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

                // Parse token account balance from raw data
                const balance = parseTokenAccountBalance(accountInfo.data);

                // Cache for 30 seconds
                queryClient.setQueryData([`token-balance-${key}`], balance, {
                  updatedAt: Date.now(),
                });

                resolve(balance);
              } catch (error) {
                reject(error instanceof Error ? error : new Error(String(error)));
              }
            });
          } catch (error) {
            requests.forEach(([, { reject }]) => 
              reject(error instanceof Error ? error : new Error(String(error)))
            );
          }
        }, BATCH_DELAY);
      });
    },
    [provider.connection, parseTokenAccountBalance, queryClient]
  );

  // Check if mint is Token2022
  const isToken2022 = useCallback(async (mint: PublicKey): Promise<boolean> => {
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
  }, [provider.connection]);

  // Get mint info with Token2022 support
  const getMintInfo = useCallback(async (mint: PublicKey) => {
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
  }, [provider.connection, isToken2022]);

  // Get scholarship info with fallback
  const getScholarshipInfo = useCallback(
    async (scholarship: PublicKey): Promise<ScholarshipAccountData> => {
      try {
        return await getBatchedScholarshipInfo(scholarship);
      } catch (error) {
        console.warn(
          "Batched request failed, falling back to individual call:",
          error
        );
        return program.account.scholarship.fetch(
          scholarship
        ) as Promise<ScholarshipAccountData>;
      }
    },
    [program, getBatchedScholarshipInfo]
  );

  // Get global scholarship state
  const getGlobalScholarshipState = useQuery({
    queryKey: ["get-global-scholarship-state"],
    queryFn: async () => {
      const maxRetries = 3;
      let retryCount = 0;
      let backoffTime = 1000;

      const executeQuery = async (): Promise<GlobalScholarshipState | null> => {
        try {
          const [globalState] = PublicKey.findProgramAddressSync(
            [Buffer.from("global-scholarship-state")],
            program.programId
          );

          return await program.account.globalScholarshipState.fetch(globalState);
        } catch (error: unknown) {
          
          if (error instanceof Error && 
              (error.message?.includes("Account does not exist") || 
               error.message?.includes("has no data"))) {
            console.log("Global state account not yet initialized");
            return null;
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

          console.error("Error fetching global scholarship state:", error);
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

  // Get all scholarship accounts
  const getScholarshipAccounts = useQuery({
    queryKey: ["get-scholarship-accounts"],
    queryFn: async () => {
      const maxRetries = 3;
      let retryCount = 0;
      let backoffTime = 1000;

      const executeQuery = async () => {
        try {
          const responses = await program.account.scholarship.all();
          const sortedResponses = responses.sort((a, b) =>
            a.account.seed.cmp(b.account.seed)
          );

          // Pre-populate cache for individual scholarship info
          sortedResponses.forEach((response) => {
            const key = response.publicKey.toString();
            queryClient.setQueryData(
              [`scholarship-info-${key}`],
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
              "Max retries reached when fetching scholarship accounts:",
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
            console.error("Error fetching scholarship accounts:", error);
            throw error;
          }
        }
      };

      return executeQuery();
    },
    staleTime: 120000, // 2 minutes stale time
    refetchOnWindowFocus: false,
    refetchInterval: false,
    retry: false,
  });

  // Optimized refresh scheduler
  useEffect(() => {
    const intervalId = setInterval(() => {
      const scholarshipAccountsQuery = queryClient.getQueryCache().find({
        queryKey: ["get-scholarship-accounts"],
      });

      const globalStateQuery = queryClient.getQueryCache().find({
        queryKey: ["get-global-scholarship-state"],
      });

      if (
        scholarshipAccountsQuery &&
        scholarshipAccountsQuery.getObserversCount() > 0 &&
        scholarshipAccountsQuery.state.fetchStatus !== "fetching"
      ) {
        queryClient.invalidateQueries({
          queryKey: ["get-scholarship-accounts"],
          refetchType: "active",
        });
      }

      if (
        globalStateQuery &&
        globalStateQuery.getObserversCount() > 0 &&
        globalStateQuery.state.fetchStatus !== "fetching"
      ) {
        queryClient.invalidateQueries({
          queryKey: ["get-global-scholarship-state"],
          refetchType: "active",
        });
      }
    }, 120000); // 2 minutes

    return () => clearInterval(intervalId);
  }, [queryClient]);

  // Create scholarship pool mutation
  const createScholarshipPool = useMutation({
    mutationKey: ["create-scholarship-pool"],
    mutationFn: async (params: {
      amount: number;
      mint: string;
      scholarshipPurpose: string;
      maxRequestAmount: number; 
    }) => {
      if (!publicKey) {
        console.error("No public key available");
        throw new Error("Wallet not connected");
      }

      try {
        const seed = new BN(randomBytes(8));

        const { amount, mint, scholarshipPurpose, maxRequestAmount } = params;

        const isToken2022Result = await isToken2022(new PublicKey(mint));

        const tokenProgram = isToken2022Result
          ? TOKEN_2022_PROGRAM_ID
          : TOKEN_PROGRAM_ID;

        let mintInfo;
        try {
          mintInfo = await getMint(
            program.provider.connection,
            new PublicKey(mint),
            undefined,
            tokenProgram
          );
        } catch (error) {
          console.error("Error getting mint info:", error);
          throw new Error("Failed to get mint information");
        }

        const totalDepositAmount = new BN(
          Math.floor(amount * 10 ** mintInfo.decimals)
        );

        const maxRequestAmountBN = new BN(
          Math.floor(maxRequestAmount * 10 ** mintInfo.decimals)
        );

        const lecturerAta = getAssociatedTokenAddressSync(
          new PublicKey(mint),
          publicKey,
          false,
          tokenProgram
        );

        // Verify lecturer has sufficient balance
        let balanceBN;
        try {
          const ataInfo = await program.provider.connection.getAccountInfo(
            lecturerAta
          );

          if (!ataInfo) {
            throw new Error(
              `Associated token account ${lecturerAta.toString()} does not exist. Please create it first.`
            );
            
          }

          if (maxRequestAmountBN.lte(new BN(0))) {
        throw new Error("Max request amount must be greater than 0");
      }

      if (maxRequestAmountBN.gt(totalDepositAmount)) {
        throw new Error("Max request amount cannot exceed total amount");
      }


          const lecturerBalance =
            await program.provider.connection.getTokenAccountBalance(
              lecturerAta
            );
          balanceBN = new BN(lecturerBalance.value.amount);
        } catch (error) {
          console.error("Error checking ATA:", error);
          throw new Error("Failed to verify associated token account");
        }

        const [scholarship] = PublicKey.findProgramAddressSync(
          [
            Buffer.from("scholarship"),
            publicKey.toBuffer(),
            seed.toArrayLike(Buffer, "le", 8),
          ],
          program.programId
        );

        const scholarshipVault = getAssociatedTokenAddressSync(
          new PublicKey(mint),
          scholarship,
          true,
          tokenProgram
        );

        const [globalState] = PublicKey.findProgramAddressSync(
          [Buffer.from("global-scholarship-state")],
          program.programId
        );

        // Validate scholarship purpose length
        const maxAllowed = 300;
        const validScholarshipPurpose =
          scholarshipPurpose.length <= maxAllowed
            ? scholarshipPurpose
            : scholarshipPurpose.substring(0, maxAllowed);

        // Check if lecturer has sufficient balance
        if (balanceBN.lt(totalDepositAmount)) {
          throw new Error(
            `Insufficient balance. Need ${(
              totalDepositAmount.toNumber() /
              10 ** mintInfo.decimals
            ).toFixed(mintInfo.decimals)}, have ${(
              balanceBN.toNumber() /
              10 ** mintInfo.decimals
            ).toFixed(mintInfo.decimals)}`
          );
        }

        const signature = await program.methods
          .createScholarshipPool(
            seed,
            totalDepositAmount,
            validScholarshipPurpose,
            maxRequestAmountBN
          )
          .accountsPartial({
            scholarship: scholarship,
            mint: new PublicKey(mint),
            lecturer: publicKey,
            scholarshipVault: scholarshipVault,
            lecturerTokenAccount: lecturerAta,
            globalState: globalState,
            systemProgram: SystemProgram.programId,
            tokenProgram: tokenProgram,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          })
          .rpc();

        // Invalidate related queries
        queryClient.invalidateQueries({
          queryKey: ["get-scholarship-accounts"],
        });
        queryClient.invalidateQueries({
          queryKey: ["get-global-scholarship-state"],
        });

        return {
          signature,
          scholarshipPubkey: scholarship.toString(),
          seed: seed.toString(),
        };
      } catch (error) {
        console.error("Error in createScholarshipPool execution:", error);
        throw error;
      }
    },
    onError: (error) => {
      console.error("Error creating scholarship pool:", error);
    },
  });

  // Request scholarship mutation
  const requestScholarship = useMutation({
    mutationKey: ["request-scholarship"],
    mutationFn: async (params: {
      scholarship: PublicKey;
      amount: number;
      scholarshipReason: string;
    }) => {
      if (!publicKey) {
        throw new Error("Wallet not connected");
      }

      const { scholarship, amount, scholarshipReason } = params;

      try {
        const scholarshipAccount = await getScholarshipInfo(scholarship);

        const tokenProgram = (await isToken2022(scholarshipAccount.mint))
          ? TOKEN_2022_PROGRAM_ID
          : TOKEN_PROGRAM_ID;

        const mintInfo = await getMintInfo(scholarshipAccount.mint);

        const amountBN = new BN(
          Math.floor(amount * 10 ** mintInfo.decimals)
        );

        // Validate request amount doesn't exceed available amount
        if (amountBN.gt(scholarshipAccount.availableAmount)) {
          throw new Error(
            `Requested amount (${amount}) exceeds available amount (${
              scholarshipAccount.availableAmount.toNumber() /
              10 ** mintInfo.decimals
            })`
          );
        }

        if (amountBN.gt(scholarshipAccount.maxRequestAmount)) {
        throw new Error(
          `Requested amount (${amount}) exceeds maximum allowed per student (${
            scholarshipAccount.maxRequestAmount.toNumber() /
            10 ** mintInfo.decimals
          })`
        );
      }

      // Validate request amount doesn't exceed available amount
      if (amountBN.gt(scholarshipAccount.availableAmount)) {
        throw new Error(
          `Requested amount (${amount}) exceeds available amount (${
            scholarshipAccount.availableAmount.toNumber() /
            10 ** mintInfo.decimals
          })`
        );
      }


        const studentTokenAccount = getAssociatedTokenAddressSync(
          scholarshipAccount.mint,
          publicKey,
          false,
          tokenProgram
        );

        const scholarshipVault = getAssociatedTokenAddressSync(
          scholarshipAccount.mint,
          scholarship,
          true,
          tokenProgram
        );

        // Validate reason length
        const maxReasonLength = 300;
        const validReason =
          scholarshipReason.length <= maxReasonLength
            ? scholarshipReason
            : scholarshipReason.substring(0, maxReasonLength);

        const signature = await program.methods
          .requestScholarship(amountBN, validReason)
          .accountsPartial({
            student: publicKey,
            lecturer: scholarshipAccount.lecturer,
            scholarship: scholarship,
            mint: scholarshipAccount.mint,
            studentTokenAccount: studentTokenAccount,
            scholarshipVault: scholarshipVault,
            systemProgram: SystemProgram.programId,
            tokenProgram: tokenProgram,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          })
          .rpc();

        // Invalidate scholarship info cache
        queryClient.invalidateQueries({
          queryKey: [`scholarship-info-${scholarship.toString()}`],
        });
        queryClient.invalidateQueries({
          queryKey: ["get-scholarship-accounts"],
        });

        return signature;
      } catch (error) {
        console.error("Error requesting scholarship:", error);
        throw error;
      }
    },
    onError: (error) => {
      console.error("Error during scholarship request:", error);
    },
  });

 // Approve scholarship mutation
const approveScholarship = useMutation({
  mutationFn: async (params: {
  scholarship: PublicKey;
  requestIndex: number;
  approvedAmount: number;  
  lecturerResponse: string;
}) => {
    if (!publicKey) {
      throw new Error("Wallet not connected");
    }

    const { scholarship, requestIndex, approvedAmount, lecturerResponse } = params;

    try {
      // Fetch the latest scholarship account data directly from the blockchain
      const scholarshipAccount = await program.account.scholarship.fetch(scholarship);

      // Verify lecturer is the owner
      if (!scholarshipAccount.lecturer.equals(publicKey)) {
        throw new Error("Only the scholarship creator can approve requests");
      }

      // Validate request index
      if (
        requestIndex >= scholarshipAccount.scholarshipRequests.length ||
        requestIndex < 0
      ) {
        throw new Error("Invalid request index");
      }

      const request = scholarshipAccount.scholarshipRequests[requestIndex];

      // Verify request is pending
      if (request.status !== ScholarshipRequestStatus.PENDING) {
        throw new Error("Request is not in pending status");
      }

      const tokenProgram = (await isToken2022(scholarshipAccount.mint))
        ? TOKEN_2022_PROGRAM_ID
        : TOKEN_PROGRAM_ID;

      const mintInfo = await getMintInfo(scholarshipAccount.mint);  
      
      const approvedAmountBN = new BN(
        Math.floor(approvedAmount * 10 ** mintInfo.decimals)
      );


      if (approvedAmountBN.lte(new BN(0))) {
        throw new Error("Approved amount must be greater than 0");
      }

      if (approvedAmountBN.gt(request.amount)) {
        throw new Error(
          `Approved amount (${approvedAmount}) cannot exceed requested amount (${
            request.amount.toNumber() / 10 ** mintInfo.decimals
          })`
        );
      }


      const scholarshipVault = getAssociatedTokenAddressSync(
        scholarshipAccount.mint,
        scholarship,
        true,
        tokenProgram
      );

      const studentTokenAccount = getAssociatedTokenAddressSync(
        scholarshipAccount.mint,
        request.student,
        false,
        tokenProgram
      );

      const [globalState] = PublicKey.findProgramAddressSync(
        [Buffer.from("global-scholarship-state")],
        program.programId
      );

      // Validate response length
      const maxResponseLength = 200;
      const validResponse =
        lecturerResponse.length <= maxResponseLength
          ? lecturerResponse
          : lecturerResponse.substring(0, maxResponseLength);

      const signature = await program.methods
        .approveScholarship(requestIndex, approvedAmountBN, validResponse)
        .accountsPartial({
          lecturer: publicKey,
          student: request.student,
          scholarship: scholarship,
          mint: scholarshipAccount.mint,
          scholarshipVault: scholarshipVault,
          studentTokenAccount: studentTokenAccount,
          globalState: globalState,
          systemProgram: SystemProgram.programId,
          tokenProgram: tokenProgram,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        })
        .rpc();

      // Invalidate caches
      queryClient.invalidateQueries({
        queryKey: [`scholarship-info-${scholarship.toString()}`],
      });
      queryClient.invalidateQueries({
        queryKey: ["get-scholarship-accounts"],
      });
      queryClient.invalidateQueries({
        queryKey: ["get-global-scholarship-state"],
      });

      return signature;
    } catch (error) {
      console.error("Error approving scholarship:", error);
      throw error;
    }
  },
  onError: (error) => {
    console.error("Error during scholarship approval:", error);
  },
});

// Reject scholarship mutation
const rejectScholarship = useMutation({
  mutationKey: ["reject-scholarship"],
  mutationFn: async (params: {
    scholarship: PublicKey;
    requestIndex: number;
    lecturerResponse: string;
  }) => {
    if (!publicKey) {
      throw new Error("Wallet not connected");
    }

    const { scholarship, requestIndex, lecturerResponse } = params;

    try {
      // Fetch the latest scholarship account data directly from the blockchain
      const scholarshipAccount = await program.account.scholarship.fetch(scholarship);

      // Verify lecturer is the owner
      if (!scholarshipAccount.lecturer.equals(publicKey)) {
        throw new Error("Only the scholarship creator can reject requests");
      }

      // Validate request index
      if (
        requestIndex >= scholarshipAccount.scholarshipRequests.length ||
        requestIndex < 0
      ) {
        throw new Error("Invalid request index");
      }

      const request = scholarshipAccount.scholarshipRequests[requestIndex];

      // Verify request is pending
      if (request.status !== ScholarshipRequestStatus.PENDING) {
        throw new Error("Request is not in pending status");
      }

      const [globalState] = PublicKey.findProgramAddressSync(
        [Buffer.from("global-scholarship-state")],
        program.programId
      );

      // Validate response length
      const maxResponseLength = 200;
      const validResponse =
        lecturerResponse.length <= maxResponseLength
          ? lecturerResponse
          : lecturerResponse.substring(0, maxResponseLength);

      const signature = await program.methods
        .rejectScholarship(requestIndex, validResponse)
        .accountsPartial({
          lecturer: publicKey,
          scholarship: scholarship,
          globalState: globalState,
        })
        .rpc();

      // Invalidate caches
      queryClient.invalidateQueries({
        queryKey: [`scholarship-info-${scholarship.toString()}`],
      });
      queryClient.invalidateQueries({
        queryKey: ["get-scholarship-accounts"],
      });
      queryClient.invalidateQueries({
        queryKey: ["get-global-scholarship-state"],
      });

      return signature;
    } catch (error) {
      console.error("Error rejecting scholarship:", error);
      throw error;
    }
  },
  onError: (error) => {
    console.error("Error during scholarship rejection:", error);
  },
});

  const withdrawFunds = useMutation({
  mutationKey: ["withdraw-funds"],
  mutationFn: async (params: {
    scholarship: PublicKey;
    seed: string; 
    withdrawAmount: number;
  }) => {
    if (!publicKey) {
      throw new Error("Wallet not connected");
    }

    const { scholarship, seed, withdrawAmount } = params;

    try {
      const scholarshipAccount = await getScholarshipInfo(scholarship);

      // Verify lecturer is the owner
      if (!scholarshipAccount.lecturer.equals(publicKey)) {
        throw new Error("Only the scholarship creator can withdraw funds");
      }

      const tokenProgram = (await isToken2022(scholarshipAccount.mint))
        ? TOKEN_2022_PROGRAM_ID
        : TOKEN_PROGRAM_ID;

      const mintInfo = await getMintInfo(scholarshipAccount.mint);

      const withdrawAmountBN = new BN(
        Math.floor(withdrawAmount * 10 ** mintInfo.decimals)
      );

      // Calculate reserved amount for pending/approved requests
      const reservedAmount = scholarshipAccount.scholarshipRequests
        .filter(request => request.status === 0 || request.status === 1) // pending or approved
        .reduce((sum, request) => sum.add(request.amount), new BN(0));

      const availableBalance = scholarshipAccount.availableAmount;

      // Validate withdrawal amount
      if (withdrawAmountBN.gt(availableBalance)) {
        throw new Error(
          `Withdrawal amount (${withdrawAmount}) exceeds available balance (${
            availableBalance.toNumber() / 10 ** mintInfo.decimals
          })`
        );
      }

      const lecturerAta = getAssociatedTokenAddressSync(
        scholarshipAccount.mint,
        publicKey,
        false,
        tokenProgram
      );

      const scholarshipVault = getAssociatedTokenAddressSync(
        scholarshipAccount.mint,
        scholarship,
        true,
        tokenProgram
      );

      const [globalState] = PublicKey.findProgramAddressSync(
        [Buffer.from("global-scholarship-state")],
        program.programId
      );

      const seedBN = new BN(seed);

      const signature = await program.methods
        .withdrawFunds(seedBN, withdrawAmountBN) 
        .accountsPartial({
          lecturer: publicKey,
          mint: scholarshipAccount.mint,
          scholarship: scholarship,
          scholarshipVault: scholarshipVault,
          lecturerAta: lecturerAta,
          globalState: globalState,
          systemProgram: SystemProgram.programId,
          tokenProgram: tokenProgram,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        })
        .rpc();

      // Invalidate related queries
      queryClient.invalidateQueries({
        queryKey: [`scholarship-info-${scholarship.toString()}`],
      });
      queryClient.invalidateQueries({
        queryKey: ["get-scholarship-accounts"],
      });
      queryClient.invalidateQueries({
        queryKey: ["get-global-scholarship-state"],
      });

      return signature;
    } catch (error) {
      console.error("Error withdrawing funds:", error);
      throw error;
    }
  },
  onError: (error) => {
    console.error("Error during funds withdrawal:", error);
  },
});


  // Get scholarship vault balance
  const getScholarshipVaultBalance = useCallback(async (scholarship: PublicKey) => {
    try {
      const scholarshipAccount = await getScholarshipInfo(scholarship);

      const tokenProgram = (await isToken2022(scholarshipAccount.mint))
        ? TOKEN_2022_PROGRAM_ID
        : TOKEN_PROGRAM_ID;

      const vault = getAssociatedTokenAddressSync(
        scholarshipAccount.mint,
        scholarship,
        true,
        tokenProgram
      );

      const tokenBalance = await provider.connection.getTokenAccountBalance(
        vault
      );
      const actualBalance = new BN(tokenBalance.value.amount);

      return {
        total: actualBalance,
        available: scholarshipAccount.availableAmount,
        disbursed: scholarshipAccount.totalAmount.sub(
          scholarshipAccount.availableAmount
        ),
      };
    } catch (error) {
      console.error("Error getting scholarship vault balance:", error);
      throw error;
    }
  }, [getScholarshipInfo, isToken2022, provider.connection]);

  // Helper function to get pending requests for a student
  const getStudentPendingRequests = useCallback(async (
    student: PublicKey,
    scholarship?: PublicKey
  ) => {
    try {
      const scholarships = scholarship
        ? [{ publicKey: scholarship, account: await getScholarshipInfo(scholarship) }]
        : (getScholarshipAccounts.data) || [];

      const pendingRequests: Array<{
        scholarship: PublicKey;
        requestIndex: number;
        request: ScholarshipRequest;
      }> = [];

      scholarships.forEach(({ publicKey: scholarshipPubkey, account }) => {
        account.scholarshipRequests.forEach((request, index) => {
          if (
            request.student.equals(student) &&
            request.status === ScholarshipRequestStatus.PENDING
          ) {
            pendingRequests.push({
              scholarship: scholarshipPubkey,
              requestIndex: index,
              request,
            });
          }
        });
      });

      return pendingRequests;
    } catch (error) {
      console.error("Error getting student pending requests:", error);
      return [];
    }
  }, [getScholarshipInfo, getScholarshipAccounts.data]);

  return {
    program,
    
    // Mutations
    createScholarshipPool,
    requestScholarship,
    approveScholarship,
    rejectScholarship,
    withdrawFunds,
    
    // Queries
    getGlobalScholarshipState,
    getScholarshipAccounts,
    
    // Helper functions
    getScholarshipInfo,
    getMintInfo,
    isToken2022,
    getScholarshipVaultBalance,
    getStudentPendingRequests,
    
    // Batched functions for advanced usage
    getBatchedScholarshipInfo,
    getBatchedTokenBalance,
    
    // Constants
    ScholarshipRequestStatus,
  };
}