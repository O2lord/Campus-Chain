import { PublicKey } from "@solana/web3.js";
import { EventDecoder } from "./eventDecoder.js";


interface LogContext {
  signature?: string;
  accounts?: string[];
  programId?: string;
}

interface TransactionLogs {
  logs: string[];
  signature?: string;
}

interface EventConfig {
  instruction: string;
  eventType: string;
  extractRoles: (logs: string[], context: LogContext) => { [key: string]: string } | null;
}

interface EventPatterns {
  [key: string]: EventConfig;
}

interface EventData {
  amount?: string;
  fiatAmount?: string;
  currency?: string;
  pricePerToken?: string;
  mintA?: string;
  refundAmount?: string;
  feeRefund?: string;
  vaultClosed?: boolean;
  disputeId?: string;
  disputeReason?: string;
  eventType?: string;
  swiftPay?: string;
  trustVault?: string;
  maker?: string;
  buyer?: string;
  taker?: string;
  oldPrice?: string;
  newPrice?: string;
  mint?: string;
  paymentInstructions?: string;
  originalAmount?: string;
  newAmount?: string;
  timestamp?: string;
  payoutDetails?: string | null;
  payoutReference?: string | null;
  success?: boolean;
  message?: string;
  oldPriceFormatted?: string;
  newPriceFormatted?: string;
  amountFormatted?: string;
  pricePerTokenFormatted?: string;
  fiatAmountFormatted?: string;
  addresses?: string[];
  note?: string;
  error?: string;
  participants?: { [key: string]: string };
  [key: string]: string | number | boolean | undefined | string[] | { [key: string]: string } | null;
}


interface ParsedEvent {
  type: string;
  data: EventData;
  signature: string;
  timestamp: number;
  trustVault: string;
  participants: { [key: string]: string };
}

/**
 * Enhanced Solana program logs parser to extract Trust Vault events and participant roles
 */
export class EventParser {
  private eventDecoder: EventDecoder;
  private eventPatterns: EventPatterns;

  constructor() {
    this.eventDecoder = new EventDecoder();

    this.eventPatterns = {
      
      Make: {
        instruction: "Make",
        eventType: "SwiftPayCreatedEvent",
        extractRoles: (logs: string[], context: LogContext) =>
          this.extractMakerFromTransaction(logs, context, "seller"),
      },

      CreateBuyOrder: {
        instruction: "CreateBuyOrder",
        eventType: "BuyOrderCreatedEvent",
        extractRoles: (logs: string[], context: LogContext) =>
          this.extractMakerFromTransaction(logs, context, "buyer"),
      },

      CancelOrReduceBuyOrder: {
        instruction: "CancelOrReduceBuyOrder",
        eventType: "BuyOrderReducedEvent",
        extractRoles: (logs: string[], context: LogContext) =>
          this.extractRefundParticipants(logs, context),
      },

      UpdatePrice: {
        instruction: "UpdatePrice",
        eventType: "PriceUpdatedEvent",
        extractRoles: (logs: string[], context: LogContext) =>
          this.extractMakerFromTransaction(logs, context, "seller"),
      },

      InstantReserve: {
        instruction: "InstantReserve",
        eventType: "InstantPaymentReservedEvent",
        extractRoles: (logs: string[], context: LogContext) =>
          this.extractInstantPaymentParticipants(logs, context),
      },

      ConfirmPayout: {
        instruction: "ConfirmPayout",
        eventType: "InstantPaymentPayoutResultEvent",
        extractRoles: (logs: string[], context: LogContext) =>
          this.extractInstantPaymentParticipants(logs, context),
      },
    };
  }

  /**
   * Parse program logs to extract events and participant roles
   */
  parseLogsForEvents(logs: TransactionLogs, context: LogContext): ParsedEvent[] {
    const events: ParsedEvent[] = [];

    
    const programDataEvent = this.extractFromProgramData(logs, context);
    if (programDataEvent) {
      events.push(programDataEvent);
      return events; 
    }

    
    for (const log of logs.logs) {
      if (!log.includes("Program log: Instruction:")) continue;

      const instructionMatch = log.match(/Instruction: (\w+)/);
      if (!instructionMatch) continue;

      const instruction = instructionMatch[1];

      const eventConfig = this.eventPatterns[instruction];
      if (!eventConfig) {
        continue;
      }

      try {
        const participants = eventConfig.extractRoles(logs.logs, context);

        if (!participants || Object.keys(participants).length === 0) {
          continue;
        }

        const eventData = this.extractEventData(
          eventConfig.eventType,
          logs.logs
        );

        const event: ParsedEvent = {
          type: eventConfig.eventType,
          data: {
            ...eventData,
            ...participants,
          },
          signature: context.signature || `temp_${Date.now()}`,
          timestamp: Date.now(),
          trustVault: this.extractSwiftPayAddress(logs.logs, context),
          participants,
        };

        events.push(event);
      } catch (error) {
        console.error(
          `⌐ EventParser: Error processing ${instruction}:`,
          error
        );
      }
    }

    return events;
  }

  /**
   * Extract event data from program data field
   */
  private extractFromProgramData(logs: TransactionLogs, context: LogContext): ParsedEvent | null {
    try {
      let programData: string | null = null;

      for (const log of logs.logs) {
        if (log.includes("Program data:")) {
          const dataMatch = log.match(/Program data: (.+)/);
          if (dataMatch) {
            programData = dataMatch[1].trim();
            console.log(`EventParser: Found Program data: ${programData.substring(0, 50)}...`); 
            break;
          }
        }
      }

      if (!programData) {
        console.log("EventParser: No Program data found in logs."); 
        return null;
      }

      const decodedEvent = this.eventDecoder.decodeProgramData(programData);
      if (!decodedEvent) {
        console.log("EventParser: EventDecoder returned null for program data.");
        return null;
      }
      console.log(`EventParser: Successfully decoded event: ${decodedEvent.eventType}`);

      
      const event: ParsedEvent = {
        type: decodedEvent.eventType,
        data: {
          ...decodedEvent,
        },
        signature: context.signature || `temp_${Date.now()}`,
        timestamp: Date.now(),
        trustVault: decodedEvent.trustVault || decodedEvent.swiftPay || 'unknown',
        participants: decodedEvent.participants || {},
      };

      return event;
    } catch (error) {
      console.error(
        "⌐ EventParser: Error extracting from program data:",
        error
      );
      return null;
    }
  }

  /**
   * Extract maker (creator) from transaction - enhanced with program data fallback
   */
  private extractMakerFromTransaction(logs: string[], context: LogContext, role: string): { [key: string]: string } | null {
    
    const programDataEvent = this.extractFromProgramData({ logs }, context);
    if (programDataEvent && programDataEvent.participants[role]) {
      return { [role]: programDataEvent.participants[role] };
    }

    
    const rolePatterns = [
      new RegExp(`${role}[:\\s]+([A-Za-z0-9]{32,44})`, "i"),
      new RegExp(`Program\\s+log:\\s+${role}[:\\s]+([A-Za-z0-9]{32,44})`, "i"),
      new RegExp(`${role}.*?([A-Za-z0-9]{32,44})`, "i"),
    ];

    for (const log of logs) {
      for (const pattern of rolePatterns) {
        const match = log.match(pattern);
        if (match && this.isValidSolanaAddress(match[1])) {
          const result: { [key: string]: string } = {};
          result[role] = match[1];
          return result;
        }
      }
    }

    
    const signerPatterns = [
      /signer[:\s]+([A-Za-z0-9]{32,44})/i,
      /authority[:\s]+([A-Za-z0-9]{32,44})/i,
      /Program\s+log:\s+signer[:\s]+([A-Za-z0-9]{32,44})/i,
    ];

    for (const log of logs) {
      for (const pattern of signerPatterns) {
        const match = log.match(pattern);
        if (match && this.isValidSolanaAddress(match[1])) {
          const result: { [key: string]: string } = {};
          result[role] = match[1];
          return result;
        }
      }
    }

    
    const addressPattern = /([A-Za-z0-9]{32,44})/g;
    const foundAddresses: string[] = [];
    const systemAddresses = [
      "ComputeBudget111111111111111111111111111111",
      "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb",
      "11111111111111111111111111111111",
      "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL",
    ];

    for (const log of logs) {
      const matches = log.match(addressPattern);
      if (matches) {
        for (const match of matches) {
          if (
            this.isValidSolanaAddress(match) &&
            !systemAddresses.includes(match)
          ) {
            foundAddresses.push(match);
          }
        }
      }
    }

    if (foundAddresses.length > 0) {
      const result: { [key: string]: string } = {};
      result[role] = foundAddresses[0];
      return result;
    }

    
    return this.extractFromTransactionContext(context, role);
  }

  /**
   * Extract participants from reservation transactions
   */
  private extractReservationParticipants(logs: string[], context: LogContext): { [key: string]: string } {
    
    const programDataEvent = this.extractFromProgramData({ logs }, context);
    if (programDataEvent && programDataEvent.participants) {
      return programDataEvent.participants;
    }

    const participants: { [key: string]: string } = {};

    const participantPatterns = {
      seller: [
        /seller[:\s]+([A-Za-z0-9]{32,44})/i,
        /maker[:\s]+([A-Za-z0-9]{32,44})/i,
        /Program\s+log:\s+seller[:\s]+([A-Za-z0-9]{32,44})/i,
      ],
      buyer: [
        /buyer[:\s]+([A-Za-z0-9]{32,44})/i,
        /taker[:\s]+([A-Za-z0-9]{32,44})/i,
        /Program\s+log:\s+buyer[:\s]+([A-Za-z0-9]{32,44})/i,
      ],
    };

    for (const log of logs) {
      for (const pattern of participantPatterns.seller) {
        const match = log.match(pattern);
        if (match && this.isValidSolanaAddress(match[1])) {
          participants.seller = match[1];
          break;
        }
      }

      for (const pattern of participantPatterns.buyer) {
        const match = log.match(pattern);
        if (match && this.isValidSolanaAddress(match[1])) {
          participants.buyer = match[1];
          break;
        }
      }
    }

    if (!participants.seller || !participants.buyer) {
      const contextParticipants = this.extractFromTransactionContext(
        context,
        "both"
      );
      return { ...contextParticipants, ...participants };
    }

    return participants;
  }

  /**
   * Extract participants from payment transactions
   */
  private extractPaymentParticipants(logs: string[], context: LogContext): { [key: string]: string } {
    return this.extractReservationParticipants(logs, context);
  }

  /**
   * Enhanced refund participant extraction
   */
  private extractRefundParticipants(logs: string[], context: LogContext): { [key: string]: string } {
    
    const programDataEvent = this.extractFromProgramData({ logs }, context);
    if (programDataEvent && programDataEvent.participants) {
      return programDataEvent.participants;
    }

    const refundPatterns = [
      /refund.*?to[:\s]+([A-Za-z0-9]{32,44})/i,
      /recipient[:\s]+([A-Za-z0-9]{32,44})/i,
      /refund.*?recipient[:\s]+([A-Za-z0-9]{32,44})/i,
      /seller[:\s]+([A-Za-z0-9]{32,44})/i,
      /Program\s+log:\s+refund.*?([A-Za-z0-9]{32,44})/i,
    ];

    for (const log of logs) {
      for (const pattern of refundPatterns) {
        const match = log.match(pattern);
        if (match && this.isValidSolanaAddress(match[1])) {
          return { seller: match[1] };
        }
      }
    }

    const signerPatterns = [
      /signer[:\s]+([A-Za-z0-9]{32,44})/i,
      /authority[:\s]+([A-Za-z0-9]{32,44})/i,
      /Program\s+log:\s+signer[:\s]+([A-Za-z0-9]{32,44})/i,
    ];

    for (const log of logs) {
      for (const pattern of signerPatterns) {
        const match = log.match(pattern);
        if (match && this.isValidSolanaAddress(match[1])) {
          return { seller: match[1] };
        }
      }
    }

    const addressPattern = /([A-Za-z0-9]{32,44})/g;
    const foundAddresses: string[] = [];
    const systemAddresses = [
      "ComputeBudget111111111111111111111111111111",
      "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb",
      "11111111111111111111111111111111",
      "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL",
    ];

    for (const log of logs) {
      const matches = log.match(addressPattern);
      if (matches) {
        for (const match of matches) {
          if (
            this.isValidSolanaAddress(match) &&
            !systemAddresses.includes(match)
          ) {
            foundAddresses.push(match);
          }
        }
      }
    }

    if (foundAddresses.length > 0) {
      return { seller: foundAddresses[0] };
    }

    const contextResult = this.extractFromTransactionContext(context, "seller");
    if (contextResult.seller) {
      return contextResult;
    }

    return { seller: "unknown_seller" };
  }

  /**
   * Extract participants from cancellation transactions
   */
  private extractCancellationParticipants(logs: string[], context: LogContext): { [key: string]: string | null } {
    
    const programDataEvent = this.extractFromProgramData({ logs }, context);
    if (programDataEvent && programDataEvent.participants) {
      return programDataEvent.participants;
    }

    const cancellationPatterns = [
      /cancelled.*?by[:\s]+([A-Za-z0-9]{32,44})/i,
      /initiator[:\s]+([A-Za-z0-9]{32,44})/i,
      /buyer[:\s]+([A-Za-z0-9]{32,44})/i,
      /seller[:\s]+([A-Za-z0-9]{32,44})/i,
    ];

    for (const log of logs) {
      for (const pattern of cancellationPatterns) {
        const match = log.match(pattern);
        if (match && this.isValidSolanaAddress(match[1])) {
          if (log.includes("buyer")) {
            return { buyer: match[1], seller: null };
          } else if (log.includes("seller")) {
            return { seller: match[1], buyer: null };
          }
        }
      }
    }

    const signer = this.extractSignerFromLogs(logs);
    if (signer) {
      return { buyer: signer, seller: null };
    }

    return { buyer: "unknown_buyer", seller: null };
  }

  /**
   * Extract participants from instant payment transactions
   */
  private extractInstantPaymentParticipants(logs: string[], context: LogContext): { [key: string]: string } {
    
    const programDataEvent = this.extractFromProgramData({ logs }, context);
    if (programDataEvent && programDataEvent.participants) {
      return programDataEvent.participants;
    }

    const participants: { [key: string]: string } = {};

    const participantPatterns = {
      maker: [
        /maker[:\s]+([A-Za-z0-9]{32,44})/i,
        /liquidity.*?provider[:\s]+([A-Za-z0-9]{32,44})/i,
        /platform[:\s]+([A-Za-z0-9]{32,44})/i,
      ],
      taker: [
        /taker[:\s]+([A-Za-z0-9]{32,44})/i,
        /user[:\s]+([A-Za-z0-9]{32,44})/i,
      ],
    };

    for (const log of logs) {
      for (const pattern of participantPatterns.maker) {
        const match = log.match(pattern);
        if (match && this.isValidSolanaAddress(match[1])) {
          participants.maker = match[1];
          break;
        }
      }

      for (const pattern of participantPatterns.taker) {
        const match = log.match(pattern);
        if (match && this.isValidSolanaAddress(match[1])) {
          participants.taker = match[1];
          participants.user = match[1]; 
          break;
        }
      }
    }

    return participants;
  }

  /**
   * Enhanced signer extraction from logs
   */
  private extractSignerFromLogs(logs: string[]): string | null {
    const signerPatterns = [
      /signer[:\s]+([A-Za-z0-9]{32,44})/i,
      /authority[:\s]+([A-Za-z0-9]{32,44})/i,
      /Program\s+log:\s+signer[:\s]+([A-Za-z0-9]{32,44})/i,
    ];

    const systemAddresses = [
      "ComputeBudget111111111111111111111111111111",
      "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb",
      "11111111111111111111111111111111",
      "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL",
    ];

    for (const log of logs) {
      for (const pattern of signerPatterns) {
        const match = log.match(pattern);
        if (
          match &&
          this.isValidSolanaAddress(match[1]) &&
          !systemAddresses.includes(match[1])
        ) {
          return match[1];
        }
      }
    }
    return null;
  }

  /**
   * Extract signer (transaction initiator) from context
   */
  private extractSignerFromContext(context: LogContext): string | null {
    if (context.signature && context.accounts && context.accounts.length > 0) {
      return context.accounts[0];
    }
    return null;
  }

  /**
   * Enhanced transaction context extraction
   */
  private extractFromTransactionContext(context: LogContext, roleType: string): { [key: string]: string } {
    const accounts = this.extractAccountsFromContext(context);

    if (roleType === "seller") {
      return { seller: accounts[0] || "unknown_seller" };
    } else if (roleType === "buyer") {
      return { buyer: accounts[0] || "unknown_buyer" };
    } else if (roleType === "both") {
      return {
        seller: accounts[0] || "unknown_seller",
        buyer: accounts[1] || "unknown_buyer",
      };
    }

    return {};
  }

  /**
   * Extract account addresses from transaction context
   */
  private extractAccountsFromContext(context: LogContext): string[] {
    if (context.accounts && context.accounts.length > 0) {
      return context.accounts;
    }
    
    
    const accounts: string[] = [];
    if (context.signature) {
      accounts.push("placeholder_account_1");
      accounts.push("placeholder_account_2");
    }

    return accounts;
  }

  /**
   * Extract specific event data based on event type
   */
  private extractEventData(eventType: string, logs: string[]): EventData {
    const data: EventData = {};

    for (const log of logs) {
      const amountMatch = log.match(/amount[:\s]+(\d+)/i);
      if (amountMatch) {
        data.amount = (parseInt(amountMatch[1]) / 1e9).toFixed(6);
      }

      const fiatMatch = log.match(/fiat[:\s]+(\d+)/i);
      if (fiatMatch) {
        data.fiatAmount = fiatMatch[1];
      }

      const currencyMatch = log.match(/currency[:\s]+([A-Z]{3})/i);
      if (currencyMatch) {
        data.currency = currencyMatch[1];
      }

      const priceMatch = log.match(/price[:\s]+(\d+)/i);
      if (priceMatch) {
        data.pricePerToken = priceMatch[1];
      }

      const mintMatch = log.match(/mint[:\s]+([A-Za-z0-9]{32,44})/i);
      if (mintMatch) {
        data.mintA = mintMatch[1];
      }
    }

    switch (eventType) {
      case "RefundProcessedEvent":
        const refundMatch = logs
          .join(" ")
          .match(/Refund Amount: (\d+), Fee Refund: (\d+)/);
        if (refundMatch) {
          data.refundAmount = (parseInt(refundMatch[1]) / 1e9).toFixed(6);
          data.feeRefund = (parseInt(refundMatch[2]) / 1e9).toFixed(6);
          data.vaultClosed = logs.some(
            (log) =>
              log.includes("Closing trust_vault") ||
              log.includes("SwiftPay closed")
          );
        }
        break;

      case "DisputeCreatedEvent":
        const disputeIdMatch = logs
          .join(" ")
          .match(/dispute.*?id[:\s]+([A-Z0-9]+)/i);
        if (disputeIdMatch) {
          data.disputeId = disputeIdMatch[1];
        }

        const reasonMatch = logs.join(" ").match(/reason[:\s]+([^,\n]+)/i);
        if (reasonMatch) {
          data.disputeReason = reasonMatch[1].trim();
        }
        break;
    }

    return data;
  }

  /**
   * Extract trust vault address from logs or context
   */
  private extractSwiftPayAddress(logs: string[], context: LogContext): string {
    for (const log of logs) {
      const vaultMatch = log.match(/trust.*?vault[:\s]+([A-Za-z0-9]{32,44})/i);
      if (vaultMatch) {
        return vaultMatch[1];
      }
    }

    return context.signature
      ? `vault_${context.signature.substring(0, 8)}`
      : `vault_${Date.now().toString().substring(-8)}`;
  }

  /**
   * Validate if a string is a valid Solana address
   */
  private isValidSolanaAddress(address: string): boolean {
    try {
      if (!address || address.length < 32 || address.length > 44) {
        return false;
      }

      const base58Pattern = /^[A-HJ-NP-Za-km-z1-9]+$/;
      if (!base58Pattern.test(address)) {
        return false;
      }

      new PublicKey(address);
      return true;
    } catch {
      return false;
    }
  }
}