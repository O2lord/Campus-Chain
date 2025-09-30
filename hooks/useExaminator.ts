import { BN, Program } from "@coral-xyz/anchor";
import useAnchorProvider from "./useAnchorProvider";
import { Examinator } from "@/relics/examinator/examinator";
import idl from "@/relics/examinator/examinator.json";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useWallet } from "@solana/wallet-adapter-react";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import transactionDispatcher, {
  TransactionType,
} from "./transactionEventDispatcher";
import { useState, useEffect, useCallback, useMemo } from "react";
import { sha256 } from "js-sha256";

// Add proper TypeScript interfaces
interface LecturerProfileData {
  authority: PublicKey;
  supabaseIdHash: number[];
  bump: number;
}

interface ExamConfig {
  duration: number;
  courseCode: string;
  courseTitle: string;
  instructions: string;
  examDate: string;
  showScoresImmediately: boolean;
  showCorrectAnswers: boolean;
}

interface QuestionContent {
  questionText: string; 
  questionType: 'SBA' | 'SHORT'; 
  options?: string[]; 
  correctAnswer: number | string | string[]; 
}

interface StudentAnswers {
  sbaAnswers?: number[];
  shortAnswers?: string[];
  essayAnswers?: string[];
}


interface StudentProfileData {
  authority: PublicKey;
  supabaseIdHash: number[];
  bump: number;
}

interface ExamMetadataData {
  lecturer: PublicKey;
  supabaseExamIdHash: number[];
  configHash: number[];
  startTs: BN;
  endTs: BN;
  published: boolean;
  bump: number;
}



export enum AttemptStatus {
  InProgress = 0,
  Submitted = 1,
  Graded = 2,
  RemarkRequested = 3,
  RemarkApproved = 4,
}

const BATCH_DELAY = 50; 

const batchedProfileRequests = new Map<
  string,
  {
    resolve: (value: LecturerProfileData | StudentProfileData) => void;
    reject: (error: Error) => void;
  }
>();

let profileBatchTimeout: NodeJS.Timeout | null = null;

// Batch management for exam metadata
const batchedExamRequests = new Map<
  string,
  {
    resolve: (value: ExamMetadataData) => void;
    reject: (error: Error) => void;
  }
>();

let examBatchTimeout: NodeJS.Timeout | null = null;

export default function useExaminatorProgram() {
  const provider = useAnchorProvider();
  const { publicKey } = useWallet();
  const [isProcessing, setIsProcessing] = useState(false);
  const queryClient = useQueryClient();
  

  
  const program = useMemo(() => new Program<Examinator>(idl as Examinator, provider), [provider]);

  // Helper function to create hash from string
  const createHash = useCallback((data: string): number[] => {
    const hash = sha256(data);
    return Array.from(new Uint8Array(Buffer.from(hash, 'hex')));
  }, []);

  // Helper function to create hash from object
  const createObjectHash = useCallback((data: unknown): number[] => {
    const jsonString = JSON.stringify(data, Object.keys(data as Record<string, unknown>).sort());
    return createHash(jsonString);
  }, [createHash]);

  // Optimized batch profile info fetcher
  const getBatchedProfileInfo = useCallback(async (
    profilePubkey: PublicKey,
    accountType: 'lecturer' | 'student'
  ): Promise<LecturerProfileData | StudentProfileData> => {
    const key = `${accountType}-${profilePubkey.toString()}`;

    const cachedData = queryClient.getQueryData<LecturerProfileData | StudentProfileData>([
      `${accountType}-profile-${profilePubkey.toString()}`,
    ]);
    if (cachedData) {
      return cachedData;
    }

    return new Promise((resolve, reject) => {
      batchedProfileRequests.set(key, { resolve, reject });

      if (profileBatchTimeout) {
        clearTimeout(profileBatchTimeout);
      }

      profileBatchTimeout = setTimeout(async () => {
        const requests = Array.from(batchedProfileRequests.entries());
        batchedProfileRequests.clear();

        if (requests.length === 0) return;

        try {
          const pubkeys = requests.map(([key]) => {
            const [, pubkeyStr] = key.split('-', 2);
            return new PublicKey(pubkeyStr);
          });
          
          const accounts = await provider.connection.getMultipleAccountsInfo(pubkeys);

          requests.forEach(([key, { resolve, reject }], index) => {
            try {
              const accountInfo = accounts[index];
              if (!accountInfo) {
                reject(new Error(`Profile account not found: ${key}`));
                return;
              }

              const [accountType] = key.split('-');
                            
              const parsedData = accountType === 'lecturer' 
                ? program.account.lecturerProfile.coder.accounts.decode("lecturerProfile", accountInfo.data)
                : program.account.studentProfile.coder.accounts.decode("studentProfile", accountInfo.data);

              const cacheKey = accountType === 'lecturer' 
                ? `lecturer-profile-${pubkeys[index].toString()}`
                : `student-profile-${pubkeys[index].toString()}`;
              
              queryClient.setQueryData([cacheKey], parsedData, {
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

  // Optimized batch exam metadata fetcher
  const getBatchedExamInfo = useCallback(async (
    examPubkey: PublicKey
  ): Promise<ExamMetadataData> => {
    const key = examPubkey.toString();

    // Check cache first
    const cachedData = queryClient.getQueryData<ExamMetadataData>([
      `exam-metadata-${key}`,
    ]);
    if (cachedData) {
      return cachedData;
    }

    return new Promise((resolve, reject) => {
      batchedExamRequests.set(key, { resolve, reject });

      if (examBatchTimeout) {
        clearTimeout(examBatchTimeout);
      }

      examBatchTimeout = setTimeout(async () => {
        const requests = Array.from(batchedExamRequests.entries());
        batchedExamRequests.clear();

        if (requests.length === 0) return;

        try {
          const pubkeys = requests.map(([key]) => new PublicKey(key));
          const accounts = await provider.connection.getMultipleAccountsInfo(pubkeys);

          requests.forEach(([key, { resolve, reject }], index) => {
            try {
              const accountInfo = accounts[index];
              if (!accountInfo) {
                reject(new Error(`Exam metadata account not found: ${key}`));
                return;
              }

              // Parse the account data using the program
              const parsedData = program.account.examMetadata.coder.accounts.decode(
                "examMetadata",
                accountInfo.data
              ) as ExamMetadataData;

              // Cache the result
              queryClient.setQueryData([`exam-metadata-${key}`], parsedData, {
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
  // Get lecturer profile info
  const getLecturerProfileInfo = useCallback(
    async (lecturerProfile: PublicKey): Promise<LecturerProfileData> => {
      try {
        return await getBatchedProfileInfo(lecturerProfile, 'lecturer') as LecturerProfileData;
      } catch (error) {
        console.warn("Batched request failed, falling back to individual call:", error);
        return program.account.lecturerProfile.fetch(lecturerProfile) as Promise<LecturerProfileData>;
      }
    },
    [program, getBatchedProfileInfo]
  );

  // Get student profile info
  const getStudentProfileInfo = useCallback(
    async (studentProfile: PublicKey): Promise<StudentProfileData> => {
      try {
        return await getBatchedProfileInfo(studentProfile, 'student') as StudentProfileData;
      } catch (error) {
        console.warn("Batched request failed, falling back to individual call:", error);
        return program.account.studentProfile.fetch(studentProfile) as Promise<StudentProfileData>;
      }
    },
    [program, getBatchedProfileInfo]
  );

  // Get exam metadata info
  const getExamMetadataInfo = useCallback(
    async (examMetadata: PublicKey): Promise<ExamMetadataData> => {
      try {
        return await getBatchedExamInfo(examMetadata);
      } catch (error) {
        console.warn("Batched request failed, falling back to individual call:", error);
        return program.account.examMetadata.fetch(examMetadata) as Promise<ExamMetadataData>;
      }
    },
    [program, getBatchedExamInfo]
  );

  const getQuestionBatchPda = useCallback((lecturerProfilePubkey: PublicKey, batchId: string): PublicKey => {
  const batchIdHash = createHash(batchId);
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("batch"), lecturerProfilePubkey.toBuffer(), Buffer.from(batchIdHash)],
    program.programId
  );
  return pda;
}, [createHash, program.programId]);

  // --- NEW PDA DERIVATION HELPERS ---
  const getLecturerProfilePda = useCallback((walletPublicKey: PublicKey, supabaseId: string): PublicKey => {
    const supabaseIdHash = createHash(supabaseId);
    const [pda] = PublicKey.findProgramAddressSync(
      [Buffer.from("lecturer"), walletPublicKey.toBuffer(), Buffer.from(supabaseIdHash)],
      program.programId
    );
    return pda;
  }, [createHash, program.programId]);

  const getStudentProfilePda = useCallback((walletPublicKey: PublicKey, supabaseId: string): PublicKey => {
    const supabaseIdHash = createHash(supabaseId);
    const [pda] = PublicKey.findProgramAddressSync(
      [Buffer.from("student"), walletPublicKey.toBuffer(), Buffer.from(supabaseIdHash)],
      program.programId
    );
    return pda;
  }, [createHash, program.programId]);

  const getExamMetadataPda = useCallback((lecturerProfilePubkey: PublicKey, supabaseExamId: string): PublicKey => {
    const supabaseExamIdHash = createHash(supabaseExamId);
    const [pda] = PublicKey.findProgramAddressSync(
      [Buffer.from("exam"), lecturerProfilePubkey.toBuffer(), Buffer.from(supabaseExamIdHash)],
      program.programId
    );
    return pda;
  }, [createHash, program.programId]);

  const getQuestionMetadataPda = useCallback((lecturerProfilePubkey: PublicKey, supabaseQuestionId: string): PublicKey => {
    const supabaseQuestionIdHash = createHash(supabaseQuestionId);
    const [pda] = PublicKey.findProgramAddressSync(
      [Buffer.from("question"), lecturerProfilePubkey.toBuffer(), Buffer.from(supabaseQuestionIdHash)],
      program.programId
    );
    return pda;
  }, [createHash, program.programId]);

  const getStudentAttemptPda = useCallback((studentProfilePubkey: PublicKey, examMetadataPubkey: PublicKey, supabaseAttemptId: string): PublicKey => {
    const supabaseAttemptIdHash = createHash(supabaseAttemptId);
    const [pda] = PublicKey.findProgramAddressSync(
      [Buffer.from("attempt"), studentProfilePubkey.toBuffer(), examMetadataPubkey.toBuffer(), Buffer.from(supabaseAttemptIdHash)],
      program.programId
    );
    return pda;
  }, [createHash, program.programId]);

  // Get all lecturer profiles
  const getLecturerProfiles = useQuery({
    queryKey: ["get-lecturer-profiles"],
    queryFn: async () => {
      const maxRetries = 3;
      let retryCount = 0;
      let backoffTime = 1000;

      const executeQuery = async () => {
        try {
          const responses = await program.account.lecturerProfile.all();
          
          // Pre-populate cache for individual lecturer profiles
          responses.forEach((response) => {
            const key = response.publicKey.toString();
            queryClient.setQueryData(
              [`lecturer-profile-${key}`],
              response.account,
              { updatedAt: Date.now() }
            );
          });

          return responses;
        } catch (error: unknown) {
          if (retryCount >= maxRetries) {
            console.error("Max retries reached when fetching lecturer profiles:", error);
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
    staleTime: 120000, 
    refetchOnWindowFocus: false,
    refetchInterval: false,
    retry: false,
  });

  // Get all student profiles
  const getStudentProfiles = useQuery({
    queryKey: ["get-student-profiles"],
    queryFn: async () => {
      const maxRetries = 3;
      let retryCount = 0;
      let backoffTime = 1000;

      const executeQuery = async () => {
        try {
          const responses = await program.account.studentProfile.all();
          
          // Pre-populate cache for individual student profiles
          responses.forEach((response) => {
            const key = response.publicKey.toString();
            queryClient.setQueryData(
              [`student-profile-${key}`],
              response.account,
              { updatedAt: Date.now() }
            );
          });

          return responses;
        } catch (error: unknown) {
          if (retryCount >= maxRetries) {
            console.error("Max retries reached when fetching student profiles:", error);
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
    staleTime: 120000, // 2 minutes
    refetchOnWindowFocus: false,
    refetchInterval: false,
    retry: false,
  });

  // Get all exam metadata
  const getExamMetadata = useQuery({
    queryKey: ["get-exam-metadata"],
    queryFn: async () => {
      const maxRetries = 3;
      let retryCount = 0;
      let backoffTime = 1000;

      const executeQuery = async () => {
        try {
          const responses = await program.account.examMetadata.all();
          
          // Pre-populate cache for individual exam metadata
          responses.forEach((response) => {
            const key = response.publicKey.toString();
            queryClient.setQueryData(
              [`exam-metadata-${key}`],
              response.account,
              { updatedAt: Date.now() }
            );
          });

          return responses;
        } catch (error: unknown) {
          if (retryCount >= maxRetries) {
            console.error("Max retries reached when fetching exam metadata:", error);
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
    staleTime: 60000, // 1 minute 
    refetchOnWindowFocus: false,
    refetchInterval: false,
    retry: false,
  });

  // Get all question metadata
  const getQuestionMetadata = useQuery({
    queryKey: ["get-question-metadata"],
    queryFn: async () => {
      const maxRetries = 3;
      let retryCount = 0;
      let backoffTime = 1000;

      const executeQuery = async () => {
        try {
          const responses = await program.account.questionMetadata.all();
          
          // Pre-populate cache for individual question metadata
          responses.forEach((response) => {
            const key = response.publicKey.toString();
            queryClient.setQueryData(
              [`question-metadata-${key}`],
              response.account,
              { updatedAt: Date.now() }
            );
          });

          return responses;
        } catch (error: unknown) {
          if (retryCount >= maxRetries) {
            console.error("Max retries reached when fetching question metadata:", error);
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
    staleTime: 300000, // 5 minutes 
    refetchOnWindowFocus: false,
    refetchInterval: false,
    retry: false,
  });

  const getQuestionBatches = useQuery({
  queryKey: ["get-question-batches"],
  queryFn: async () => {
    const responses = await program.account.questionBatch.all();
    
    responses.forEach((response) => {
      const key = response.publicKey.toString();
      queryClient.setQueryData(
        [`question-batch-${key}`],
        response.account,
        { updatedAt: Date.now() }
      );
    });

    return responses;
  },
  staleTime: 300000, // 5 minutes
  refetchOnWindowFocus: false,
  refetchInterval: false,
  retry: false,
});

  // Get all student attempts
  const getStudentAttempts = useQuery({
    queryKey: ["get-student-attempts"],
    queryFn: async () => {
      const maxRetries = 3;
      let retryCount = 0;
      let backoffTime = 1000;

      const executeQuery = async () => {
        try {
          const responses = await program.account.studentAttempt.all();
          
          // Pre-populate cache for individual student attempts
          responses.forEach((response) => {
            const key = response.publicKey.toString();
            queryClient.setQueryData(
              [`student-attempt-${key}`],
              response.account,
              { updatedAt: Date.now() }
            );
          });

          return responses;
        } catch (error: unknown) {
          if (retryCount >= maxRetries) {
            console.error("Max retries reached when fetching student attempts:", error);
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
    staleTime: 30000, // 30 seconds 
    refetchOnWindowFocus: false,
    refetchInterval: false,
    retry: false,
  });

  // Optimized refresh scheduler
  useEffect(() => {
    const intervalId = setInterval(() => {
      const queries = [
        "get-lecturer-profiles",
        "get-student-profiles", 
        "get-exam-metadata",
        "get-question-metadata",
        "get-student-attempts"
      ];

      queries.forEach(queryKey => {
        const query = queryClient.getQueryCache().find({ queryKey: [queryKey] });
        
        if (query && query.getObserversCount() > 0 && query.state.fetchStatus !== "fetching") {
          queryClient.invalidateQueries({
            queryKey: [queryKey],
            refetchType: "active",
          });
        }
      });
    }, 60000); // 1 minute intervals

    return () => clearInterval(intervalId);
  }, [queryClient]);

  // Create lecturer profile
  const createLecturerProfile = useMutation({
    mutationKey: ["create-lecturer-profile"],
    mutationFn: async (params: { supabaseId: string }) => {
      if (!publicKey) {
        throw new Error("Wallet not connected");
      }

      const { supabaseId } = params;
      const supabaseIdHash = createHash(supabaseId);

      try {
        const [lecturerProfile] = PublicKey.findProgramAddressSync(
          [
            Buffer.from("lecturer"),
            publicKey.toBuffer(),
            Buffer.from(supabaseIdHash),
          ],
          program.programId
        );

        const signature = await program.methods
          .createLecturerProfile(supabaseIdHash)
          .accountsPartial({
            lecturerProfile,
            signer: publicKey,
            systemProgram: SystemProgram.programId,
          })
          .rpc();

        transactionDispatcher.dispatchEvent({
          type: TransactionType.LECTURER_PROFILE_CREATED,
          signature,
          timestamp: Date.now(),
          details: {
            lecturerProfile: lecturerProfile.toString(),
            authority: publicKey.toString(),
            supabaseId,
          },
        });

        return { signature, lecturerProfile: lecturerProfile.toString() };
      } catch (error) {
        console.error("Error creating lecturer profile:", error);
        throw error;
      }
    },
    onError: (error) => {
      console.error("Error during create-lecturer-profile:", error);
    },
  });

  // Create student profile
  const createStudentProfile = useMutation({
    mutationKey: ["create-student-profile"],
    mutationFn: async (params: { supabaseId: string }) => {
      if (!publicKey) {
        throw new Error("Wallet not connected");
      }

      const { supabaseId } = params;
      const supabaseIdHash = createHash(supabaseId);

      try {
        const [studentProfile] = PublicKey.findProgramAddressSync(
          [
            Buffer.from("student"),
            publicKey.toBuffer(),
            Buffer.from(supabaseIdHash),
          ],
          program.programId
        );

        const signature = await program.methods
          .createStudentProfile(supabaseIdHash)
          .accountsPartial({
            studentProfile,
            signer: publicKey,
            systemProgram: SystemProgram.programId,
          })
          .rpc();

        transactionDispatcher.dispatchEvent({
          type: TransactionType.STUDENT_PROFILE_CREATED,
          signature,
          timestamp: Date.now(),
          details: {
            studentProfile: studentProfile.toString(),
            authority: publicKey.toString(),
            supabaseId,
          },
        });

        return { signature, studentProfile: studentProfile.toString() };
      } catch (error) {
        console.error("Error creating student profile:", error);
        throw error;
      }
    },
    onError: (error) => {
      console.error("Error during create-student-profile:", error);
    },
  });

  // Create exam metadata
  const createExamMetadata = useMutation({
    mutationKey: ["create-exam-metadata"],
    mutationFn: async (params: {
      lecturerProfilePubkey: string;
      supabaseExamId: string;
      config: ExamConfig;
      startTime: Date;
      endTime: Date;
      published: boolean;
    }) => {
      if (!publicKey) {
        throw new Error("Wallet not connected");
      }

      const { lecturerProfilePubkey, supabaseExamId, config, startTime, endTime, published } = params;
      
      const supabaseExamIdHash = createHash(supabaseExamId);
      const configHash = createObjectHash(config);
      const startTs = new BN(Math.floor(startTime.getTime() / 1000));
      const endTs = new BN(Math.floor(endTime.getTime() / 1000));

      try {
        const lecturerProfile = new PublicKey(lecturerProfilePubkey);
        
        const [examMetadata] = PublicKey.findProgramAddressSync(
          [
            Buffer.from("exam"),
            lecturerProfile.toBuffer(),
            Buffer.from(supabaseExamIdHash),
          ],
          program.programId
        );

        const signature = await program.methods
          .createExamMetadata(supabaseExamIdHash, configHash, startTs, endTs, published)
          .accountsPartial({
            signer: publicKey,
            examMetadata,
            lecturerProfile,
            systemProgram: SystemProgram.programId,
          })
          .rpc();

        transactionDispatcher.dispatchEvent({
          type: TransactionType.EXAM_CREATED,
          signature,
          timestamp: Date.now(),
          details: {
            examMetadata: examMetadata.toString(),
            lecturer: lecturerProfile.toString(),
            supabaseExamId,
            published,
            startTime: startTime.toISOString(),
            endTime: endTime.toISOString(),
          },
        });

        return { signature, examMetadata: examMetadata.toString() };
      } catch (error) {
        console.error("Error creating exam metadata:", error);
        throw error;
      }
    },
    onError: (error) => {
      console.error("Error during create-exam-metadata:", error);
    },
  });

  // Create question metadata
  const createQuestionMetadata = useMutation({
    mutationKey: ["create-question-metadata"],
    mutationFn: async (params: {
      lecturerProfilePubkey: string;
      supabaseQuestionId: string;
      content: QuestionContent;
      courseCode: string;
    }) => {
      if (!publicKey) {
        throw new Error("Wallet not connected");
      }

      const { lecturerProfilePubkey, supabaseQuestionId, content, courseCode } = params;
      
      const supabaseQuestionIdHash = createHash(supabaseQuestionId);
      const contentHash = createObjectHash(content);
      const courseCodeHash = createHash(courseCode);

      try {
        const lecturerProfile = new PublicKey(lecturerProfilePubkey);
        
        const [questionMetadata] = PublicKey.findProgramAddressSync(
          [
            Buffer.from("question"),
            lecturerProfile.toBuffer(),
            Buffer.from(supabaseQuestionIdHash),
          ],
          program.programId
        );

        const signature = await program.methods
          .createQuestionMetadata(supabaseQuestionIdHash, contentHash, courseCodeHash)
          .accountsPartial({
            questionMetadata,
            lecturerProfile,
            signer: publicKey,
            systemProgram: SystemProgram.programId,
          })
          .rpc();

        transactionDispatcher.dispatchEvent({
          type: TransactionType.QUESTION_CREATED,
          signature,
          timestamp: Date.now(),
          details: {
            questionMetadata: questionMetadata.toString(),
            lecturer: lecturerProfile.toString(),
            supabaseQuestionId,
            courseCode,
          },
        });

        return { signature, questionMetadata: questionMetadata.toString() };
      } catch (error) {
        console.error("Error creating question metadata:", error);
        throw error;
      }
    },
    onError: (error) => {
      console.error("Error during create-question-metadata:", error);
    },
  });

   // Publish exam
  const publishExam = useMutation({
    mutationKey: ["publish-exam"],
    mutationFn: async (params: {
      lecturerProfilePubkey: string;
      supabaseExamId: string;
    }) => {
      if (!publicKey) {
        throw new Error("Wallet not connected");
      }

      const { lecturerProfilePubkey, supabaseExamId } = params;
      const supabaseExamIdHash = createHash(supabaseExamId);

      try {
        const lecturerProfile = new PublicKey(lecturerProfilePubkey);
        
        const [examMetadata] = PublicKey.findProgramAddressSync(
          [
            Buffer.from("exam"),
            lecturerProfile.toBuffer(),
            Buffer.from(supabaseExamIdHash),
          ],
          program.programId
        );

        const signature = await program.methods
          .publishExam(supabaseExamIdHash)
          .accountsPartial({
            examMetadata,
            lecturer: lecturerProfile,
            signer: publicKey,
          })
          .rpc();

        transactionDispatcher.dispatchExamPublishedEvent(
          publicKey,
          signature,
          examMetadata.toString(),
          lecturerProfile.toString(),
          supabaseExamId
        );

        return { signature, examMetadata: examMetadata.toString() };
      } catch (error) {
        console.error("Error publishing exam:", error);
        throw error;
      }
    },
    onError: (error) => {
      console.error("Error during publish-exam:", error);
    },
  });

  // Unpublish exam
  const unpublishExam = useMutation({
    mutationKey: ["unpublish-exam"],
    mutationFn: async (params: {
      lecturerProfilePubkey: string;
      supabaseExamId: string;
    }) => {
      if (!publicKey) {
        throw new Error("Wallet not connected");
      }

      const { lecturerProfilePubkey, supabaseExamId } = params;
      const supabaseExamIdHash = createHash(supabaseExamId);

      try {
        const lecturerProfile = new PublicKey(lecturerProfilePubkey);
        
        const [examMetadata] = PublicKey.findProgramAddressSync(
          [
            Buffer.from("exam"),
            lecturerProfile.toBuffer(),
            Buffer.from(supabaseExamIdHash),
          ],
          program.programId
        );

        const signature = await program.methods
          .unpublishExam(supabaseExamIdHash)
          .accountsPartial({
            examMetadata,
            lecturer: lecturerProfile,
            signer: publicKey,
          })
          .rpc();

        transactionDispatcher.dispatchExamUnpublishedEvent(
          publicKey,
          signature,
          examMetadata.toString(),
          lecturerProfile.toString(),
          supabaseExamId
        );

        return { signature, examMetadata: examMetadata.toString() };
      } catch (error) {
        console.error("Error unpublishing exam:", error);
        throw error;
      }
    },
    onError: (error) => {
      console.error("Error during unpublish-exam:", error);
    },
  });

  // Start student attempt
  const startStudentAttempt = useMutation({
    mutationKey: ["start-student-attempt"],
    mutationFn: async (params: {
      studentProfilePubkey: string;
      examMetadataPubkey: string;
      supabaseAttemptId: string;
    }) => {
      if (!publicKey) {
        throw new Error("Wallet not connected");
      }

      const { studentProfilePubkey, examMetadataPubkey, supabaseAttemptId } = params;
      const supabaseAttemptIdHash = createHash(supabaseAttemptId);

      try {
        const studentProfile = new PublicKey(studentProfilePubkey);
        const examMetadata = new PublicKey(examMetadataPubkey);
        
        const [studentAttempt] = PublicKey.findProgramAddressSync(
          [
            Buffer.from("attempt"),
            studentProfile.toBuffer(),
            examMetadata.toBuffer(),
            Buffer.from(supabaseAttemptIdHash),
          ],
          program.programId
        );

        const signature = await program.methods
          .startStudentAttempt(supabaseAttemptIdHash)
          .accountsPartial({
            studentAttempt,
            studentProfile,
            examMetadata,
            signer: publicKey,
            systemProgram: SystemProgram.programId,
          })
          .rpc();

        transactionDispatcher.dispatchEvent({
          type: TransactionType.EXAM_STARTED,
          signature,
          timestamp: Date.now(),
          details: {
            studentAttempt: studentAttempt.toString(),
            student: studentProfile.toString(),
            exam: examMetadata.toString(),
            supabaseAttemptId,
          },
        });

        return { signature, studentAttempt: studentAttempt.toString() };
      } catch (error) {
        console.error("Error starting student attempt:", error);
        throw error;
      }
    },
    onError: (error) => {
      console.error("Error during start-student-attempt:", error);
    },
  });

   // Submit student answers
  const submitStudentAnswers = useMutation({
    mutationKey: ["submit-student-answers"],
    mutationFn: async (params: {
      studentAttemptPubkey: string;
      supabaseAttemptId: string;
      answers: StudentAnswers;
    }) => {
      if (!publicKey) {
        throw new Error("Wallet not connected");
      }

      setIsProcessing(true);
      
      const { studentAttemptPubkey, supabaseAttemptId, answers } = params;
      const supabaseAttemptIdHash = createHash(supabaseAttemptId);
      const answersHash = createObjectHash(answers);

      try {
        const studentAttempt = new PublicKey(studentAttemptPubkey);
        
        // Get the student attempt info to find related accounts
       const attemptInfo = await program.account.studentAttempt.fetch(studentAttempt);

      const signature = await program.methods
        .submitStudentAnswers(supabaseAttemptIdHash, answersHash)
        .accountsPartial({
          studentAttempt,
          student: attemptInfo.student,
          exam: attemptInfo.exam,
          signer: publicKey,
        })
        .rpc();


        transactionDispatcher.dispatchEvent({
          type: TransactionType.EXAM_SUBMITTED,
          signature,
          timestamp: Date.now(),
          details: {
            studentAttempt: studentAttempt.toString(),
            student: publicKey.toString(),
            supabaseAttemptId,
          },
        });

        return { signature, studentAttempt: studentAttempt.toString() };
      } catch (error) {
        console.error("Error submitting student answers:", error);
        throw error;
      } finally {
        setIsProcessing(false);
      }
    },
    onError: (error) => {
      console.error("Error during submit-student-answers:", error);
      setIsProcessing(false);
    },
  });

  // Request remark
const requestRemark = useMutation({
  mutationKey: ["request-remark"],
  mutationFn: async (params: {
    studentProfilePubkey: string;
    examMetadataPubkey: string;
    supabaseAttemptId: string;
    reason: string;
  }) => {
    if (!publicKey) {
      throw new Error("Wallet not connected");
    }

    const { studentProfilePubkey, examMetadataPubkey, supabaseAttemptId, reason } = params;
    
    const supabaseAttemptIdHash = createHash(supabaseAttemptId);
    const reasonHash = createHash(reason);

    try {
      const studentProfile = new PublicKey(studentProfilePubkey);
      const examMetadata = new PublicKey(examMetadataPubkey);
      
      const [studentAttempt] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("attempt"),
          studentProfile.toBuffer(),
          examMetadata.toBuffer(),
          Buffer.from(supabaseAttemptIdHash),
        ],
        program.programId
      );

      const signature = await program.methods
        .requestRemark(supabaseAttemptIdHash, reasonHash)
        .accountsPartial({
          studentAttempt,
          student: studentProfile,
          exam: examMetadata,
          signer: publicKey,
        })
        .rpc();

      transactionDispatcher.dispatchEvent({
        type: TransactionType.REMARK_REQUESTED,
        signature,
        timestamp: Date.now(),
        details: {
          studentAttempt: studentAttempt.toString(),
          student: studentProfile.toString(),
          exam: examMetadata.toString(),
          supabaseAttemptId,
        },
      });

      return { signature, studentAttempt: studentAttempt.toString() };
    } catch (error) {
      console.error("Error requesting remark:", error);
      throw error;
    }
  },
  onError: (error) => {
    console.error("Error during request-remark:", error);
  },
});

  // Update exam metadata
  const updateExamMetadata = useMutation({
    mutationKey: ["update-exam-metadata"],
    mutationFn: async (params: {
      lecturerProfilePubkey: string;
      supabaseExamId: string;
      newConfig: ExamConfig;
      newStartTime: Date;
      newEndTime: Date;
      newPublished: boolean;
    }) => {
      if (!publicKey) {
        throw new Error("Wallet not connected");
      }

      const { lecturerProfilePubkey, supabaseExamId, newConfig, newStartTime, newEndTime, newPublished } = params;
      
      const supabaseExamIdHash = createHash(supabaseExamId);
      const newConfigHash = createObjectHash(newConfig);
      const newStartTs = new BN(Math.floor(newStartTime.getTime() / 1000));
      const newEndTs = new BN(Math.floor(newEndTime.getTime() / 1000));

      try {
        const lecturerProfile = new PublicKey(lecturerProfilePubkey);
        
        const [examMetadata] = PublicKey.findProgramAddressSync(
          [
            Buffer.from("exam"),
            lecturerProfile.toBuffer(),
            Buffer.from(supabaseExamIdHash),
          ],
          program.programId
        );

        const signature = await program.methods
          .updateExamMetadata(supabaseExamIdHash, newConfigHash, newStartTs, newEndTs, newPublished)
          .accountsPartial({
            examMetadata,
            lecturer: lecturerProfile,
            signer: publicKey,
          })
          .rpc();

        transactionDispatcher.dispatchEvent({
          type: TransactionType.EXAM_UPDATED,
          signature,
          timestamp: Date.now(),
          details: {
            examMetadata: examMetadata.toString(),
            lecturer: lecturerProfile.toString(),
            supabaseExamId,
            published: newPublished,
            startTime: newStartTime.toISOString(),
            endTime: newEndTime.toISOString(),
          },
        });

        return { signature, examMetadata: examMetadata.toString() };
      } catch (error) {
        console.error("Error updating exam metadata:", error);
        throw error;
      }
    },
    onError: (error) => {
      console.error("Error during update-exam-metadata:", error);
    },
  });

  // Update question metadata
  const updateQuestionMetadata = useMutation({
    mutationKey: ["update-question-metadata"],
    mutationFn: async (params: {
      lecturerProfilePubkey: string;
      supabaseQuestionId: string;
      newContent: QuestionContent;
      newCourseCode: string;
    }) => {
      if (!publicKey) {
        throw new Error("Wallet not connected");
      }

      const { lecturerProfilePubkey, supabaseQuestionId, newContent, newCourseCode } = params;
      
      const supabaseQuestionIdHash = createHash(supabaseQuestionId);
      const newContentHash = createObjectHash(newContent);
      const newCourseCodeHash = createHash(newCourseCode);

      try {
        const lecturerProfile = new PublicKey(lecturerProfilePubkey);
        
        const [questionMetadata] = PublicKey.findProgramAddressSync(
          [
            Buffer.from("question"),
            lecturerProfile.toBuffer(),
            Buffer.from(supabaseQuestionIdHash),
          ],
          program.programId
        );

        const signature = await program.methods
          .updateQuestionMetadata(supabaseQuestionIdHash, newContentHash, newCourseCodeHash)
          .accountsPartial({
            questionMetadata,
            lecturer: lecturerProfile,
            signer: publicKey,
          })
          .rpc();

        transactionDispatcher.dispatchEvent({
          type: TransactionType.QUESTION_UPDATED,
          signature,
          timestamp: Date.now(),
          details: {
            questionMetadata: questionMetadata.toString(),
            lecturer: lecturerProfile.toString(),
            supabaseQuestionId,
            courseCode: newCourseCode,
          },
        });

        return { signature, questionMetadata: questionMetadata.toString() };
      } catch (error) {
        console.error("Error updating question metadata:", error);
        throw error;
      }
    },
    onError: (error) => {
      console.error("Error during update-question-metadata:", error);
    },
  });

  // Create question batch
  const createQuestionBatch = useMutation({
    mutationKey: ["create-question-batch"],
    mutationFn: async (params: {
      lecturerProfilePubkey: string;
      batchId: string;
      questions: Array<{
        supabaseQuestionId: string;
        content: QuestionContent;
        courseCode: string;
      }>;
    }) => {
      if (!publicKey) {
        throw new Error("Wallet not connected");
      }

      const { lecturerProfilePubkey, batchId, questions } = params;
      const batchIdHash = createHash(batchId);

      // Transform questions to QuestionBatchItem format
      const questionBatchItems = questions.map(q => ({
        supabaseQuestionIdHash: createHash(q.supabaseQuestionId),
        contentHash: createObjectHash(q.content),
        courseCodeHash: createHash(q.courseCode),
      }));

      try {
        const lecturerProfile = new PublicKey(lecturerProfilePubkey);
        
        const [questionBatch] = PublicKey.findProgramAddressSync(
          [
            Buffer.from("batch"),
            lecturerProfile.toBuffer(),
            Buffer.from(batchIdHash),
          ],
          program.programId
        );

        const signature = await program.methods
          .createQuestionBatch(batchIdHash, questionBatchItems)
          .accountsPartial({
            questionBatch,
            lecturerProfile,
            signer: publicKey,
            systemProgram: SystemProgram.programId,
          })
          .rpc();

        transactionDispatcher.dispatchEvent({
          type: TransactionType.QUESTION_BATCH_CREATED,
          signature,
          timestamp: Date.now(),
          details: {
            questionBatch: questionBatch.toString(),
            lecturer: lecturerProfile.toString(),
            batchId,
            questionsCount: questions.length,
          },
        });

        return { signature, questionBatch: questionBatch.toString() };
      } catch (error) {
        console.error("Error creating question batch:", error);
        throw error;
      }
    },
    onError: (error) => {
      console.error("Error during create-question-batch:", error);
    },
  });

  // Update lecturer profile
  const updateLecturerProfile = useMutation({
    mutationKey: ["update-lecturer-profile"],
    mutationFn: async (params: {
      currentSupabaseId: string;
      newSupabaseId: string;
    }) => {
      if (!publicKey) {
        throw new Error("Wallet not connected");
      }

      const { currentSupabaseId, newSupabaseId } = params;
      const supabaseIdHash = createHash(currentSupabaseId);
      const newSupabaseIdHash = createHash(newSupabaseId);

      try {
        const [lecturerProfile] = PublicKey.findProgramAddressSync(
          [
            Buffer.from("lecturer"),
            publicKey.toBuffer(),
            Buffer.from(supabaseIdHash),
          ],
          program.programId
        );

        const signature = await program.methods
          .updateLecturerProfile(supabaseIdHash, newSupabaseIdHash)
          .accountsPartial({
            lecturerProfile,
            signer: publicKey,
          })
          .rpc();

        transactionDispatcher.dispatchEvent({
          type: TransactionType.LECTURER_PROFILE_UPDATED,
          signature,
          timestamp: Date.now(),
          details: {
            lecturerProfile: lecturerProfile.toString(),
            authority: publicKey.toString(),
            currentSupabaseId,
            newSupabaseId,
          },
        });

        return { signature, lecturerProfile: lecturerProfile.toString() };
      } catch (error) {
        console.error("Error updating lecturer profile:", error);
        throw error;
      }
    },
    onError: (error) => {
      console.error("Error during update-lecturer-profile:", error);
    },
  });

  // Update student profile
  const updateStudentProfile = useMutation({
    mutationKey: ["update-student-profile"],
    mutationFn: async (params: {
      currentSupabaseId: string;
      newSupabaseId: string;
    }) => {
      if (!publicKey) {
        throw new Error("Wallet not connected");
      }

      const { currentSupabaseId, newSupabaseId } = params;
      const supabaseIdHash = createHash(currentSupabaseId);
      const newSupabaseIdHash = createHash(newSupabaseId);

      try {
        const [studentProfile] = PublicKey.findProgramAddressSync(
          [
            Buffer.from("student"),
            publicKey.toBuffer(),
            Buffer.from(supabaseIdHash),
          ],
          program.programId
        );

        const signature = await program.methods
          .updateStudentProfile(supabaseIdHash, newSupabaseIdHash)
          .accountsPartial({
            studentProfile,
            signer: publicKey,
          })
          .rpc();

        transactionDispatcher.dispatchEvent({
          type: TransactionType.STUDENT_PROFILE_UPDATED,
          signature,
          timestamp: Date.now(),
          details: {
            studentProfile: studentProfile.toString(),
            authority: publicKey.toString(),
            currentSupabaseId,
            newSupabaseId,
          },
        });

        return { signature, studentProfile: studentProfile.toString() };
      } catch (error) {
        console.error("Error updating student profile:", error);
        throw error;
      }
    },
    onError: (error) => {
      console.error("Error during update-student-profile:", error);
    },
  });

   // Helper function to validate and log PublicKey strings
  const validatePublicKeyString = (keyString: string, keyName: string): boolean => {
    try {
      if (!keyString) {
        console.error(`${keyName} is null/undefined:`, keyString);
        return false;
      }
      
      if (typeof keyString !== 'string') {
        console.error(`${keyName} is not a string:`, keyString);
        return false;
      }
      
      // Check for common invalid characters in base58
      const invalidChars = /[0OIl]/g;
      if (invalidChars.test(keyString)) {
        console.error(`${keyName} contains invalid base58 characters (0, O, I, l):`, keyString);
        return false;
      }
      
      // Try to create PublicKey to validate
      new PublicKey(keyString);
      console.log(`${keyName} is valid:`, keyString);
      return true;
    } catch (error) {
      console.error(`${keyName} validation failed:`, error, keyString);
      return false;
    }
  };

  // Finalize student score 
const finalizeStudentScore = useMutation({
  mutationKey: ["finalize-student-score"],
  mutationFn: async (params: {
    studentProfilePubkey: string;
    examMetadataPubkey: string;
    lecturerProfilePubkey: string;
    supabaseAttemptId: string;
    finalScore: number;
    maxPossibleScore: number;
  }) => {
    if (!publicKey) {
      throw new Error("Wallet not connected");
    }

    const { 
      studentProfilePubkey, 
      examMetadataPubkey, 
      lecturerProfilePubkey, 
      supabaseAttemptId, 
      finalScore, 
      maxPossibleScore 
    } = params;

    console.log("=== FINALIZING STUDENT SCORE ===");
    console.log("Received parameters:", params);
    
    // Validate all PublicKey strings before using them
    if (!validatePublicKeyString(studentProfilePubkey, "studentProfilePubkey")) {
      throw new Error("Invalid studentProfilePubkey parameter");
    }
    
    if (!validatePublicKeyString(examMetadataPubkey, "examMetadataPubkey")) {
      throw new Error("Invalid examMetadataPubkey parameter");
    }
    
    if (!validatePublicKeyString(lecturerProfilePubkey, "lecturerProfilePubkey")) {
      throw new Error("Invalid lecturerProfilePubkey parameter");
    }
    
    const supabaseAttemptIdHash = createHash(supabaseAttemptId);

    try {
      const studentProfile = new PublicKey(studentProfilePubkey);
      const examMetadata = new PublicKey(examMetadataPubkey);
      const lecturerProfile = new PublicKey(lecturerProfilePubkey);
      
      const [studentAttempt] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("attempt"),
          studentProfile.toBuffer(),
          examMetadata.toBuffer(),
          Buffer.from(supabaseAttemptIdHash),
        ],
        program.programId
      );

      console.log("Generated studentAttempt PDA:", studentAttempt.toString());

      const signature = await program.methods
        .finalizeStudentScore(supabaseAttemptIdHash, new BN(finalScore), new BN(maxPossibleScore))
        .accountsPartial({
          studentAttempt,
          student: studentProfile,
          exam: examMetadata,
          lecturer: lecturerProfile,
          signer: publicKey,
        })
        .rpc();

      transactionDispatcher.dispatchEvent({
        type: TransactionType.EXAM_GRADED,
        signature,
        timestamp: Date.now(),
        details: {
          studentAttempt: studentAttempt.toString(),
          student: studentProfile.toString(),
          exam: examMetadata.toString(),
          lecturer: lecturerProfile.toString(),
          supabaseAttemptId,
          finalScore,
          maxPossibleScore,
        },
      });

      return { signature, studentAttempt: studentAttempt.toString() };
    } catch (error) {
      console.error("Error finalizing student score:", error);
      throw error;
    }
  },
  onError: (error) => {
    console.error("Error during finalize-student-score:", error);
  },
});



  return {
    program,
    createLecturerProfile,
    createStudentProfile,
    createExamMetadata,
    createQuestionMetadata,
    startStudentAttempt,
    submitStudentAnswers,
    requestRemark, 
    updateExamMetadata,
    updateQuestionMetadata,
    publishExam,
    unpublishExam,
    updateLecturerProfile,
    updateStudentProfile,
    finalizeStudentScore,
    createQuestionBatch,

    getBatchedProfileInfo,
    getBatchedExamInfo,
    getLecturerProfileInfo,
    getStudentProfileInfo,
    getExamMetadataInfo,
    getLecturerProfiles,
    getStudentProfiles,
    getExamMetadata,
    getQuestionMetadata,
    getQuestionBatchPda,
    getStudentAttempts,

    getLecturerProfilePda,
    getStudentProfilePda,
    getExamMetadataPda,
    getQuestionMetadataPda,
    getStudentAttemptPda,
    getQuestionBatches,
    createObjectHash,
    

  }

}