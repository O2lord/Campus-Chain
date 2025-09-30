import { BN, Program } from "@coral-xyz/anchor";
import useAnchorProvider from "./useAnchorProvider";
import { Electorate } from "@/relics/electorate/electorate";
import idl from "@/relics/electorate/electorate.json";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useWallet } from "@solana/wallet-adapter-react";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import transactionDispatcher, {
  TransactionType,
} from "./transactionEventDispatcher";
import { useState, useEffect, useCallback, useMemo } from "react";


type ProgramAccount = Awaited<ReturnType<Program<Electorate>['account']['poll']['fetch']>>;

export interface Candidate {
  name: string;
  department: string;
  motto: string;
  voteCount: BN; 
}

export interface ElectionPosition {
  name: string;
  candidates: Candidate[];
  maxSelections: number; 
}
export interface VoteChoiceProgram { 
  positionIndex: number; 
  candidateIndices: number[]; 
}

export interface Winner {
  position: string;
  candidateIndices: number[]; 
  voteCount: BN; 
  isTie: boolean;
}


export enum PollType {
  Class = 0,
  Departmental = 1,
  SUG = 2,
}

export enum PollStatus {
  Upcoming = 0,
  Active = 1,
  Ended = 2,
  ResultsDeclared = 3,
}

// Helper type for the decoded poll data with proper typing
export type PollData = Omit<ProgramAccount, 'candidates'> & {
  positions: ElectionPosition[];
  winners: Winner[];
  className?: string | null;
  departmentName?: string | null;
};

// Helper interfaces for function parameters
interface VoteChoice {
  candidateIndex: number;
}


const BATCH_DELAY = 50; 

const batchedPollRequests = new Map<
  string,
  {
    resolve: (value: PollData) => void;
    reject: (error: Error) => void;
  }
>();

let pollBatchTimeout: NodeJS.Timeout | null = null;

export default function useElectorateProgram() {
  const provider = useAnchorProvider();
  const { publicKey } = useWallet();
  const [isProcessing, setIsProcessing] = useState(false);
  const queryClient = useQueryClient();

  // Memoize the program instance
  const program = useMemo(() => new Program<Electorate>(idl as Electorate, provider), [provider]);

  
  const convertPollTypeToProgram = useCallback((pollType: PollType) => {
    switch (pollType) {
      case PollType.Class:
        return { class: {} };
      case PollType.Departmental:
        return { departmental: {} };
      case PollType.SUG:
        return { sug: {} };
      default:
        throw new Error(`Unknown poll type: ${pollType}`);
    }
  }, []);

  // Helper function to convert program enum to client-side enum
  const convertPollTypeFromProgram = useCallback((programPollType: Record<string, unknown>): PollType => {
    if ('class' in programPollType) return PollType.Class;
    if ('departmental' in programPollType) return PollType.Departmental;
    if ('sug' in programPollType) return PollType.SUG;
    throw new Error(`Unknown program poll type: ${JSON.stringify(programPollType)}`);
  }, []);

  // Helper function to convert program status to client-side enum
  const convertPollStatusFromProgram = useCallback((programStatus: Record<string, unknown>): PollStatus => {
    if ('upcoming' in programStatus) return PollStatus.Upcoming;
    if ('active' in programStatus) return PollStatus.Active;
    if ('ended' in programStatus) return PollStatus.Ended;
    if ('resultsDeclared' in programStatus) return PollStatus.ResultsDeclared;
    throw new Error(`Unknown program status: ${JSON.stringify(programStatus)}`);
  }, []);

  // Optimized batch poll info fetcher
  const getBatchedPollInfo = useCallback(async (
    pollPubkey: PublicKey
  ): Promise<PollData> => {
    const key = pollPubkey.toString();

    // Check cache first
    const cachedData = queryClient.getQueryData<PollData>([
      `poll-${key}`,
    ]);
    if (cachedData) {
      return cachedData;
    }

    return new Promise((resolve, reject) => {
      batchedPollRequests.set(key, { resolve, reject });

      if (pollBatchTimeout) {
        clearTimeout(pollBatchTimeout);
      }

      pollBatchTimeout = setTimeout(async () => {
        const requests = Array.from(batchedPollRequests.entries());
        batchedPollRequests.clear();

        if (requests.length === 0) return;

        try {
          const pubkeys = requests.map(([key]) => new PublicKey(key));
          const accounts = await provider.connection.getMultipleAccountsInfo(pubkeys);

          requests.forEach(([key, { resolve, reject }], index) => {
            try {
              const accountInfo = accounts[index];
              if (!accountInfo) {
                reject(new Error(`Poll account not found: ${key}`));
                return;
              }

              // Parse the account data using the program
              const parsedData = program.account.poll.coder.accounts.decode(
                "poll",
                accountInfo.data
              ) as PollData;

              // Cache the result
              queryClient.setQueryData([`poll-${key}`], parsedData, {
                updatedAt: Date.now(),
              });

              resolve(parsedData);
            } catch (error) {
              reject(error as Error);
            }
          });
        } catch (error) {
          requests.forEach(([, { reject }]) => reject(error as Error));
        }
      }, BATCH_DELAY);
    });
  }, [provider, program, queryClient]);

  // Get poll info
  const getPollInfo = useCallback(
    async (pollPubkey: PublicKey): Promise<PollData> => {
      try {
        return await getBatchedPollInfo(pollPubkey);
      } catch (error) {
        console.warn("Batched request failed, falling back to individual call:", error);
        return await program.account.poll.fetch(pollPubkey);
      }
    },
    [program, getBatchedPollInfo]
  );

  // PDA derivation helper
 const getPollPda = useCallback((authority: PublicKey, pollId: BN): PublicKey => {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("poll"), authority.toBuffer(), pollId.toArrayLike(Buffer, "le", 8)],
    program.programId
  );
  return pda;
}, [program.programId]);


    const getPolls = useQuery({
      queryKey: ["get-polls"],
      queryFn: async () => {
        console.log("Starting getPolls query...");
        console.log("Program ID:", program.programId.toString());
        console.log("Provider connection:", provider.connection.rpcEndpoint);
        
        const maxRetries = 3;
        let retryCount = 0;
        let backoffTime = 1000;
        

        const executeQuery = async () => {
          try {
            console.log("Attempting to fetch polls...");
            
            
            const slot = await provider.connection.getSlot();
            console.log("Current slot:", slot);
            
            
            const programAccounts = await provider.connection.getProgramAccounts(program.programId);
            console.log("Found program accounts:", programAccounts.length);
            
            
            const responses = await program.account.poll.all();
            console.log("Successfully fetched polls:", responses.length);
            console.log("Poll data:", responses);
            
            
            responses.forEach((response) => {
              const key = response.publicKey.toString();
              queryClient.setQueryData(
                [`poll-${key}`],
                response.account,
                { updatedAt: Date.now() }
              );
            });

            return responses;
          } catch (error: unknown) {
            console.error("Error in executeQuery:", error);
            
            if (error instanceof Error) {
              console.error("Error message:", error.message);
              console.error("Error stack:", error.stack);
            }
            
            console.error("Error object:", JSON.stringify(error, null, 2));
            
            if (retryCount >= maxRetries) {
              console.error("Max retries reached when fetching polls:", error);
              throw error;
            }

            const isRateLimitError = 
              (error instanceof Error && error.message?.includes("429")) ||
              (typeof error === "object" && error !== null && "code" in error && error.code === 429);

            if (isRateLimitError) {
              console.warn(`Rate limit error, retrying in ${backoffTime}ms (attempt ${retryCount + 1}/${maxRetries})`);
              retryCount++;
              await new Promise((resolve) => setTimeout(resolve, backoffTime));
              backoffTime *= 2;
              return executeQuery();
            } else {
              throw error;
            }
          }
        };

        return executeQuery();
      },
      staleTime: 60000,
      refetchOnWindowFocus: false,
      refetchInterval: false,
      retry: false,
    });


  // Helper function to get the effective poll status based on current time
const getEffectivePollStatus = useCallback((pollData: PollData): PollStatus => {
  const now = Date.now() / 1000;
  const onChainStatus = convertPollStatusFromProgram(pollData.status);

  if (onChainStatus === PollStatus.ResultsDeclared) {
    return PollStatus.ResultsDeclared;
  }
  if (onChainStatus === PollStatus.Ended) {
    return PollStatus.Ended;
  }

  if (now < pollData.startTime.toNumber()) {
    return PollStatus.Upcoming;
  }
  if (now > pollData.endTime.toNumber()) {
    return PollStatus.Ended;
  }

  return PollStatus.Active;
}, [convertPollStatusFromProgram]);
  


  useEffect(() => {
    const intervalId = setInterval(() => {
      const query = queryClient.getQueryCache().find({ queryKey: ["get-polls"] });
      
      if (query && query.getObserversCount() > 0 && query.state.fetchStatus !== "fetching") {
        queryClient.invalidateQueries({
          queryKey: ["get-polls"],
          refetchType: "active",
        });
      }
    }, 30000); 

    return () => clearInterval(intervalId);
  }, [queryClient]);

  // Initialize poll
const initializePoll = useMutation({
  mutationFn: async (params: {
  pollId: BN;
  pollType: PollType;
  className?: string;
  departmentName?: string;
  startTime: Date;
  endTime: Date;
  positions: Array<{
    name: string; 
    maxSelections: number; 
    candidates: Array<{
      name: string;
      department: string;
      motto: string;
    }>;
  }>;
}) => {
    if (!publicKey) {
      throw new Error("Wallet not connected");
    }

    const { pollId, pollType, className, departmentName, startTime, endTime, positions } = params;
    const startTs = new BN(Math.floor(startTime.getTime() / 1000));
    const endTs = new BN(Math.floor(endTime.getTime() / 1000));

    // Convert positions and their candidates to the format expected by the program
    const programPositions = positions.map(position => ({
      name: position.name,
      maxSelections: position.maxSelections,
      candidates: position.candidates.map(candidate => ({
        name: candidate.name,
        department: candidate.department,
        motto: candidate.motto,
        voteCount: new BN(0), 
      })),
    }));

    try {
      const [poll] = PublicKey.findProgramAddressSync(
        [Buffer.from("poll"), publicKey.toBuffer(), pollId.toArrayLike(Buffer, "le", 8)],
        program.programId
      );

      const programPollType = convertPollTypeToProgram(pollType);

      const signature = await program.methods
        .initializePoll(
          pollId, 
          programPollType, 
          className || null, 
          departmentName || null, 
          startTs, 
          endTs, 
          programPositions
        ) 
        .accountsPartial({
          poll,
          authority: publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();


      transactionDispatcher.dispatchEvent({
        type: TransactionType.POLL_CREATED,
        signature,
        timestamp: Date.now(),
        details: {
          poll: poll.toString(),
          authority: publicKey.toString(),
          pollType,
          className,
          departmentName,
          positionsCount: positions.length, 
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
        },
      });

      return { signature, poll: poll.toString() };
    } catch (error) {
      console.error("Error initializing poll:", error);
      throw error;
    }
  },
  onError: (error) => {
    console.error("Error during initialize-poll:", error);
  },
});


  // Cast vote
 const castVote = useMutation({
  mutationKey: ["cast-vote"],
  mutationFn: async (params: {
    pollPubkey: string;
    votes: VoteChoiceProgram[]; 
  }) => {
    if (!publicKey) {
      throw new Error("Wallet not connected");
    }

    setIsProcessing(true);

    const { pollPubkey, votes } = params;

    try {
      const poll = new PublicKey(pollPubkey);

      const signature = await program.methods
        .castVote(votes) 
        .accountsPartial({
          poll,
          voter: publicKey,
        })
        .rpc();

      transactionDispatcher.dispatchEvent({
        type: TransactionType.VOTE_CAST,
        signature,
        timestamp: Date.now(),
        details: {
          poll: poll.toString(),
          voter: publicKey.toString(),
          votesCount: votes.length, 
        },
      });

      return { signature, poll: poll.toString() };
    } catch (error) {
      console.error("Error casting vote:", error);
      throw error;
    } finally {
      setIsProcessing(false);
    }
  },
  onError: (error) => {
    console.error("Error during cast-vote:", error);
    setIsProcessing(false);
  },
});


  // End voting
  const endVoting = useMutation({
    mutationKey: ["end-voting"],
    mutationFn: async (params: {
      pollPubkey: string;
    }) => {
      if (!publicKey) {
        throw new Error("Wallet not connected");
      }

      const { pollPubkey } = params;

      try {
        const poll = new PublicKey(pollPubkey);

        const signature = await program.methods
          .endVoting()
          .accountsPartial({
            poll,
            authority: publicKey,
          })
          .rpc();

        transactionDispatcher.dispatchEvent({
          type: TransactionType.VOTING_ENDED,
          signature,
          timestamp: Date.now(),
          details: {
            poll: poll.toString(),
            authority: publicKey.toString(),
            endedAt: Date.now(),
          },
        });

        return { signature, poll: poll.toString() };
      } catch (error) {
        console.error("Error ending voting:", error);
        throw error;
      }
    },
    onError: (error) => {
      console.error("Error during end-voting:", error);
    },
  });

  // Declare results
  const declareResults = useMutation({
    mutationKey: ["declare-results"],
    mutationFn: async (params: {
      pollPubkey: string;
    }) => {
      if (!publicKey) {
        throw new Error("Wallet not connected");
      }

      const { pollPubkey } = params;

      try {
        const poll = new PublicKey(pollPubkey);

        const signature = await program.methods
          .declareResults()
          .accountsPartial({
            poll,
            authority: publicKey,
          })
          .rpc();

        transactionDispatcher.dispatchEvent({
          type: TransactionType.RESULTS_DECLARED,
          signature,
          timestamp: Date.now(),
          details: {
            poll: poll.toString(),
            authority: publicKey.toString(),
            declaredAt: Date.now(),
          },
        });

        return { signature, poll: poll.toString() };
      } catch (error) {
        console.error("Error declaring results:", error);
        throw error;
      }
    },
    onError: (error) => {
      console.error("Error during declare-results:", error);
    },
  });

  // Helper function to check if user has already voted
  const hasUserVoted = useCallback((pollData: PollData, userPublicKey: PublicKey): boolean => {
    return pollData.voters.some(voter => voter.equals(userPublicKey));
  }, []);

  // Helper function to get poll status string
  const getPollStatusString = useCallback((pollData: PollData): string => {
    const status = convertPollStatusFromProgram(pollData.status);
    switch (status) {
      case PollStatus.Upcoming:
        return "Upcoming";
      case PollStatus.Active:
        return "Active";
      case PollStatus.Ended:
        return "Ended";
      case PollStatus.ResultsDeclared:
        return "Results Declared";
      default:
        return "Unknown";
    }
  }, [convertPollStatusFromProgram]);

  // Helper function to get poll type string
  const getPollTypeString = useCallback((pollData: PollData): string => {
    const pollType = convertPollTypeFromProgram(pollData.pollType);
    switch (pollType) {
      case PollType.Class:
        return "Class";
      case PollType.Departmental:
        return "Departmental";
      case PollType.SUG:
        return "SUG";
      default:
        return "Unknown";
    }
  }, [convertPollTypeFromProgram]);

  // Helper function to check if voting is currently active
  const isVotingActive = useCallback((pollData: PollData): boolean => {
    const now = Date.now() / 1000;
    const status = convertPollStatusFromProgram(pollData.status);

    // A poll is considered active for voting if the current time is within its start and end times,
    // and its status is not yet 'Ended' or 'ResultsDeclared'.
    // This allows voting to start based on time, even if the on-chain status is still 'Upcoming'.
    return (
      (status === PollStatus.Upcoming || status === PollStatus.Active) &&
      now >= pollData.startTime.toNumber() &&
      now <= pollData.endTime.toNumber()
    );
  }, [convertPollStatusFromProgram]);


  const isVotingUpcoming = useCallback((pollData: PollData): boolean => {
    
    const status = convertPollStatusFromProgram(pollData.status);
    return (
      status === PollStatus.Upcoming 
    );
  }, [convertPollStatusFromProgram]);

  return {
    program,
    initializePoll,
    castVote,
    endVoting,
    declareResults,

    getBatchedPollInfo,
    getPollInfo,
    getPolls,
    getPollPda,

    // Helper functions
    hasUserVoted,
    getPollStatusString,
    getPollTypeString,
    isVotingActive,
    isVotingUpcoming,
    getEffectivePollStatus,
    isProcessing,

    // Conversion helpers
    convertPollTypeFromProgram,
    convertPollStatusFromProgram,

    // Constants
    PollType,
    PollStatus,
  };
}