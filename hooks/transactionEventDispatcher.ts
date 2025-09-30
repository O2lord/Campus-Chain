import { PublicKey } from "@solana/web3.js";

export enum TransactionType {
  LECTURER_PROFILE_CREATED = "LECTURER_PROFILE_CREATED",
  STUDENT_PROFILE_CREATED = "STUDENT_PROFILE_CREATED",
  EXAM_CREATED = "EXAM_CREATED",
  QUESTION_CREATED = "QUESTION_CREATED",
  QUESTION_BATCH_CREATED = "QUESTION_BATCH_CREATED",
  EXAM_PUBLISHED = "EXAM_PUBLISHED",
  EXAM_UNPUBLISHED = "EXAM_UNPUBLISHED",
  EXAM_STARTED = "EXAM_STARTED",
  EXAM_SUBMITTED = "EXAM_SUBMITTED",
  EXAM_UPDATED = "EXAM_UPDATED",
  QUESTION_UPDATED = "QUESTION_UPDATED", 
  LECTURER_PROFILE_UPDATED = "LECTURER_PROFILE_UPDATED",
  STUDENT_PROFILE_UPDATED = "STUDENT_PROFILE_UPDATED",
  EXAM_GRADED = "EXAM_GRADED",
  REMARK_REQUESTED = "REMARK_REQUEST",
  POLL_CREATED = "POLL_CREATED",
  VOTE_CAST = "VOTE_CAST", 
  VOTING_ENDED = "VOTING_ENDED",
  RESULTS_DECLARED = "RESULTS_DECLARED",
  PAYMENT_CONFIRMED= "PAYMENT_CONFIRMED",
  BUY_ORDER_CANCELLED = "BUY_ORDER_CANCELLED",
  BUY_ORDER_REDUCED = "BUY_ORDER_REDUCED",
  BUY_ORDER_CREATED = "BUY_ORDER_CREATED",
  INSTANT_PAYMENT_RESERVED = "INSTANT_PAYMENT_RESERVED",
  INSTANT_PAYMENT_SUCCESS = "INSTANT_PAYMENT_SUCCESS",
  INSTANT_PAYMENT_FAILED = "INSTANT_PAYMENT_FAILED",
  PRICE_UPDATED = "PRICE_UPDATED",
  GLOBAL_STATE_INITIALIZED = "GLOBAL_STATE_INITIALIZED",
}

// Transaction details interface
export interface TransactionDetails {
  type: TransactionType;
  examinator?: PublicKey;
  amount?: number;
  swiftPay?: PublicKey;
  signature?: string;
  timestamp: number;
  details?: Record<string, unknown>;
}

export const TRANSACTION_EVENT = "examinator:transaction";

class TransactionEventDispatcher {
  // Dispatch a transaction event
  public dispatchEvent(details: TransactionDetails): void {
    // Create and dispatch custom event
    const event = new CustomEvent(TRANSACTION_EVENT, {
      detail: details,
      bubbles: true
    });
    
    window.dispatchEvent(event);

    this.storeLastTransaction(details);
  }

  // Store transaction data in localStorage
  private storeLastTransaction(details: TransactionDetails): void {
    try {
    
      const storableDetails = {
        ...details,
        examinator: details.examinator ? details.examinator.toString() : undefined
      };
      
      localStorage.setItem("last_examinator_transaction", JSON.stringify(storableDetails));
    } catch (e) {
      console.error("Error storing transaction details:", e);
    }
  }

  // Get the last transaction from localStorage
  public getLastTransaction(): TransactionDetails | null {
    try {
      const stored = localStorage.getItem("last_examinator_transaction");
      if (!stored) return null;
      
      const details = JSON.parse(stored) as TransactionDetails;
      
      if (details.examinator && typeof details.examinator === 'string') {
        details.examinator = new PublicKey(details.examinator);
      }
      
      return details;
    } catch (e) {
      console.error("Error getting last transaction:", e);
      return null;
    }
  }

  // Utility function to dispatch a LECTURER_PROFILE_CREATED event
  public dispatchLecturerProfileCreatedEvent(examinator: PublicKey, signature: string, supabaseId: string, lecturerProfile: string): void {
    const eventDetail: TransactionDetails = {
      type: TransactionType.LECTURER_PROFILE_CREATED,
      signature,
      timestamp: Date.now(),
      examinator,
      details: {
        lecturerProfile,
        authority: examinator.toString(),
        supabaseId,
      }
    };
    
    this.dispatchEvent(eventDetail);
  }

  // Utility function to dispatch a STUDENT_PROFILE_CREATED event
  public dispatchStudentProfileCreatedEvent(examinator: PublicKey, signature: string, supabaseId: string, studentProfile: string): void {
    const eventDetail: TransactionDetails = {
      type: TransactionType.STUDENT_PROFILE_CREATED,
      signature,
      timestamp: Date.now(),
      examinator,
      details: {
        studentProfile,
        authority: examinator.toString(),
        supabaseId,
      }
    };
    
    this.dispatchEvent(eventDetail);
  }

  // Utility function to dispatch an EXAM_CREATED event
  public dispatchExamCreatedEvent(examinator: PublicKey, signature: string, examMetadata: string, lecturer: string, supabaseExamId: string, published: boolean, startTime: string, endTime: string): void {
    const eventDetail: TransactionDetails = {
      type: TransactionType.EXAM_CREATED,
      signature,
      timestamp: Date.now(),
      examinator,
      details: {
        examMetadata,
        lecturer,
        supabaseExamId,
        published,
        startTime,
        endTime,
      }
    };
    
    this.dispatchEvent(eventDetail);
  }

  // Utility function to dispatch a QUESTION_CREATED event
  public dispatchQuestionCreatedEvent(examinator: PublicKey, signature: string, questionMetadata: string, lecturer: string, supabaseQuestionId: string, courseCode: string): void {
    const eventDetail: TransactionDetails = {
      type: TransactionType.QUESTION_CREATED,
      signature,
      timestamp: Date.now(),
      examinator,
      details: {
        questionMetadata,
        lecturer,
        supabaseQuestionId,
        courseCode,
      }
    };
    
    this.dispatchEvent(eventDetail);
  }

  // Utility function to dispatch an EXAM_STARTED event
  public dispatchExamStartedEvent(examinator: PublicKey, signature: string, studentAttempt: string, student: string, exam: string, supabaseAttemptId: string): void {
    const eventDetail: TransactionDetails = {
      type: TransactionType.EXAM_STARTED,
      signature,
      timestamp: Date.now(),
      examinator,
      details: {
        studentAttempt,
        student,
        exam,
        supabaseAttemptId,
      }
    };
    
    this.dispatchEvent(eventDetail);
  }

  // Utility function to dispatch an EXAM_SUBMITTED event
  public dispatchExamSubmittedEvent(examinator: PublicKey, signature: string, studentAttempt: string, student: string, supabaseAttemptId: string): void {
    const eventDetail: TransactionDetails = {
      type: TransactionType.EXAM_SUBMITTED,
      signature,
      timestamp: Date.now(),
      examinator,
      details: {
        studentAttempt,
        student,
        supabaseAttemptId,
      }
    };
    
    this.dispatchEvent(eventDetail);
  }

  // Utility function to dispatch an EXAM_UPDATED event
  public dispatchExamUpdatedEvent(examinator: PublicKey, signature: string, examMetadata: string, lecturer: string, supabaseExamId: string, published: boolean, startTime: string, endTime: string): void {
    const eventDetail: TransactionDetails = {
      type: TransactionType.EXAM_UPDATED,
      signature,
      timestamp: Date.now(),
      examinator,
      details: {
        examMetadata,
        lecturer,
        supabaseExamId,
        published,
        startTime,
        endTime,
      }
    };
    
    this.dispatchEvent(eventDetail);
  }

  // Utility function to dispatch a QUESTION_UPDATED event
  public dispatchQuestionUpdatedEvent(examinator: PublicKey, signature: string, questionMetadata: string, lecturer: string, supabaseQuestionId: string, courseCode: string): void {
    const eventDetail: TransactionDetails = {
      type: TransactionType.QUESTION_UPDATED,
      signature,
      timestamp: Date.now(),
      examinator,
      details: {
        questionMetadata,
        lecturer,
        supabaseQuestionId,
        courseCode,
      }
    };
    
    this.dispatchEvent(eventDetail);
  }

  // Utility function to dispatch a LECTURER_PROFILE_UPDATED event
  public dispatchLecturerProfileUpdatedEvent(examinator: PublicKey, signature: string, lecturerProfile: string, currentSupabaseId: string, newSupabaseId: string): void {
    const eventDetail: TransactionDetails = {
      type: TransactionType.LECTURER_PROFILE_UPDATED,
      signature,
      timestamp: Date.now(),
      examinator,
      details: {
        lecturerProfile,
        authority: examinator.toString(),
        currentSupabaseId,
        newSupabaseId,
      }
    };
    
    this.dispatchEvent(eventDetail);
  }

  // Utility function to dispatch a STUDENT_PROFILE_UPDATED event
  public dispatchStudentProfileUpdatedEvent(examinator: PublicKey, signature: string, studentProfile: string, currentSupabaseId: string, newSupabaseId: string): void {
    const eventDetail: TransactionDetails = {
      type: TransactionType.STUDENT_PROFILE_UPDATED,
      signature,
      timestamp: Date.now(),
      examinator,
      details: {
        studentProfile,
        authority: examinator.toString(),
        currentSupabaseId,
        newSupabaseId,
      }
    };
    
    this.dispatchEvent(eventDetail);
  }

  // Utility function to dispatch an EXAM_GRADED event
  public dispatchExamGradedEvent(examinator: PublicKey, signature: string, studentAttempt: string, student: string, exam: string, lecturer: string, supabaseAttemptId: string, finalScore: number, maxPossibleScore: number): void {
    const eventDetail: TransactionDetails = {
      type: TransactionType.EXAM_GRADED,
      signature,
      timestamp: Date.now(),
      examinator,
      details: {
        studentAttempt,
        student,
        exam,
        lecturer,
        supabaseAttemptId,
        finalScore,
        maxPossibleScore,
      }
    };
    
    this.dispatchEvent(eventDetail);
  }
  // Utility function to dispatch an EXAM_PUBLISHED event
  public dispatchExamPublishedEvent(examinator: PublicKey, signature: string, examMetadata: string, lecturer: string, supabaseExamId: string): void {
    const eventDetail: TransactionDetails = {
      type: TransactionType.EXAM_PUBLISHED,
      signature,
      timestamp: Date.now(),
      examinator,
      details: {
        examMetadata,
        lecturer,
        supabaseExamId,
        publishedAt: Date.now(),
      }
    };
    
    this.dispatchEvent(eventDetail);
  }

  // Utility function to dispatch an EXAM_UNPUBLISHED event
  public dispatchExamUnpublishedEvent(examinator: PublicKey, signature: string, examMetadata: string, lecturer: string, supabaseExamId: string): void {
    const eventDetail: TransactionDetails = {
      type: TransactionType.EXAM_UNPUBLISHED,
      signature,
      timestamp: Date.now(),
      examinator,
      details: {
        examMetadata,
        lecturer,
        supabaseExamId,
        unpublishedAt: Date.now(),
      }
    };
    
    this.dispatchEvent(eventDetail);
  }

}

// Export singleton instance
export const transactionDispatcher = new TransactionEventDispatcher();
export default transactionDispatcher;