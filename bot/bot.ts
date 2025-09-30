import { Client, GatewayIntentBits } from "discord.js";
import {
  Connection,
  PublicKey,
  Keypair,
  SystemProgram,
  Transaction,
  TransactionInstruction
} from "@solana/web3.js";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { EventParser } from "./components/eventParser.js";
import { NotificationManager } from "./components/notification.js";
import { RoleSpecificEmbeds } from "./components/roleSpecificEmbeds.js";
import FlutterwaveService from "./services/flutterwaveService.js";
import bs58 from "bs58";


dotenv.config({ path: ".env.local" });

console.log("🚀 Bot file loaded, starting execution...");
console.log("📋 Environment check:");
console.log("- DISCORD_BOT_TOKEN:", process.env.DISCORD_BOT_TOKEN ? "✅ Set" : "❌ Missing");
console.log("- BOT_WALLET_PRIVATE_KEY:", process.env.BOT_WALLET_PRIVATE_KEY ? "✅ Set" : "❌ Missing");
console.log("- SWIFT_PAY_PROGRAM_ID:", process.env.SWIFT_PAY_PROGRAM_ID ? "✅ Set" : "❌ Missing");
console.log("- SUPABASE_URL:", process.env.NEXT_PUBLIC_SUPABASE_URL ? "✅ Set" : "❌ Missing");
console.log("- SUPABASE_SERVICE_KEY:", process.env.SUPABASE_SERVICE_ROLE_KEY ? "✅ Set" : "❌ Missing");




interface PayoutDetails {
  account_number: string;
  bank_code?: string;
  account_bank?: string;
  account_name?: string;
  beneficiary_name?: string;
  phone_number?: string;
  network?: string;
  narration?: string;
  type?: 'bank_transfer' | 'mobile_money' | 'flutterwave_wallet';
  [key: string]: string | undefined;
}

interface FlutterwaveTransferData {
  id: number;
  account_number: string;
  bank_code: string;
  full_name: string;
  created_at: string;
  currency: string;
  debit_currency: string;
  amount: number;
  fee: number;
  status: string;
  reference: string;
  meta?: Record<string, unknown>;
  narration: string;
  complete_message: string;
  requires_approval: number;
  is_approved: number;
  bank_name: string;
  [key: string]: unknown; 
}

interface ReservedAmount {
  taker: PublicKey;
  amount: string;
  fiatAmount: string;
  timestamp: string;
  sellerInstructions: string | null;
  status: number;
  disputeReason: string | null;
  disputeId: string | null;
  payoutDetails: string | null;
  payoutReference: string | null;
}


interface PayoutResult {
  success: boolean;
  error?: string;
  errorCode?: string;
  flw_ref?: string | null;
  reference: string;
  data?: {
    id?: number;
    account_number?: string;
    bank_code?: string;
    full_name?: string;
    created_at?: string;
    currency?: string;
    debit_currency?: string;
    amount?: number;
    fee?: number;
    status?: string;
    reference?: string;
    meta?: Record<string, unknown>;
    narration?: string;
    complete_message?: string;
    requires_approval?: number;
    is_approved?: number;
    bank_name?: string;
    [key: string]: unknown;
  } | null;
}

interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

interface LogsContext {
  signature?: string;
  accounts?: string[];
  programId?: string;
}

interface TransactionLogs {
  logs: string[];
  signature?: string;
}


interface EventData {
  swiftPay?: string;
  taker?: string;
  amount?: string;
  fiatAmount?: string;
  currency?: string;
  payoutDetails?: string | null;
  payoutReference?: string | null;
  
  [key: string]: string | null | undefined;
}

interface ParsedEvent {
  type: string;
  data: EventData;
  participants: { [key: string]: string };
  signature: string;
  timestamp: number;
}


function parsePayoutDetails(details: string | null): PayoutDetails | null {
  if (!details) return null;
  
  try {
    const parsed = typeof details === "string" ? JSON.parse(details) : details;
    
    
    if (!parsed.account_number) {
      throw new Error('Missing required field: account_number');
    }
    
    return {
      account_number: parsed.account_number,
      bank_code: parsed.bank_code,
      account_bank: parsed.account_bank,
      account_name: parsed.account_name,
      beneficiary_name: parsed.beneficiary_name,
      phone_number: parsed.phone_number,
      network: parsed.network,
      narration: parsed.narration,
      type: parsed.type,
    };
  } catch (error) {
    console.error('Failed to parse payout details:', error);
    return null;
  }
}



class SwiftPayDiscordBot {
  private readonly client: Client;
  private readonly connection: Connection;
  private readonly botWallet: Keypair;
  private readonly eventParser: EventParser;
  private readonly notificationManager: NotificationManager;
  private readonly embedCreator: RoleSpecificEmbeds;
  private readonly flutterwaveService: FlutterwaveService;
  private isListening: boolean;
  private eventsProcessed: number;
  private notificationsSent: number;
  private payoutsProcessed: number;
  private readonly flutterwaveBreaker: CircuitBreaker;
  private readonly solanaBreaker: CircuitBreaker;
  private pendingPayments: Set<string>;

  constructor() {
    console.log("🏗️ Initializing SwiftPayDiscordBot constructor...");
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.DirectMessages,
      ],
    });
    console.log("✅ Discord client created");
    this.connection = new Connection(
      process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com",
      "confirmed"
    );

    try {
      const privateKeyBytes = bs58.decode(process.env.BOT_WALLET_PRIVATE_KEY!);
      this.botWallet = Keypair.fromSecretKey(privateKeyBytes);
      console.log("✅ Bot wallet initialized:", this.botWallet.publicKey.toString());
    } catch (error) {
      console.error("❌ Failed to initialize bot wallet:", error);
      throw error;
    }

    this.eventParser = new EventParser();
    this.notificationManager = new NotificationManager(this.client);
    this.embedCreator = new RoleSpecificEmbeds();

    try {
      this.flutterwaveService = new FlutterwaveService();
      console.log("✅ Flutterwave service initialized");
    } catch (error) {
      console.error("❌ Failed to initialize Flutterwave service:", error);
      throw error;
    }

    this.isListening = false;
    this.eventsProcessed = 0;
    this.notificationsSent = 0;
    this.payoutsProcessed = 0;
    this.pendingPayments = new Set();
    
    this.flutterwaveBreaker = new CircuitBreaker("Flutterwave", {
      threshold: 3,
      timeout: 30000,
      resetTimeout: 60000,
    });
    
    this.solanaBreaker = new CircuitBreaker("Solana", {
      threshold: 5,
      timeout: 10000,
      resetTimeout: 30000,
    });
  }

  private validatePaymentData(eventData: EventData): ValidationResult {
    const errors: string[] = [];
    
    if (!eventData.taker) errors.push('Taker address required');
    if (!eventData.payoutReference) errors.push('Payout reference required');
    if (!eventData.fiatAmount || isNaN(Number(eventData.fiatAmount))) {
      errors.push('Valid fiat amount required');
    }
    if (!eventData.currency) errors.push('Currency required');
    if (!eventData.payoutDetails) errors.push('Payout details required');
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

 private async handleInstantPaymentReserved(event: ParsedEvent): Promise<void> {
  const payoutReference = event.data.payoutReference;
  if (!payoutReference) {
    console.error("❌ Missing payout reference");
    return;
  }

  this.pendingPayments.add(payoutReference);
  let payoutResult: PayoutResult | null = null;

  try {
    console.log(`🎯 Processing InstantPaymentReserved event:`, event.data);

    const inputValidation = this.validatePaymentData(event.data);
    if (!inputValidation.isValid) {
      await this.logPayoutError(event, 'VALIDATION_ERROR', inputValidation.errors.join(', '));
      return;
    }

    const { fiatAmount, currency, payoutDetails, swiftPay } = event.data;
    
    if (!fiatAmount || !currency || !payoutDetails || !swiftPay) {
      await this.logPayoutError(event, 'MISSING_DATA', 'Required payment data missing');
      return;
    }

    // NEW: Fetch swift_pay account to get maker address
    try {
      const swiftPayPubkey = new PublicKey(swiftPay);
      const swiftPayAccountInfo = await this.connection.getAccountInfo(swiftPayPubkey);
      
      if (swiftPayAccountInfo) {
        const { maker } = await this.deserializeSwiftPayAccount(swiftPayAccountInfo.data);
        
        // Add maker to participants so they receive notifications
        event.participants.maker = maker.toString();
        console.log(`✅ Added maker to participants: ${maker.toString()}`);
      } else {
        console.warn(`⚠️ Could not fetch swift_pay account: ${swiftPay}`);
      }
    } catch (accountError) {
      console.error('❌ Error fetching maker from swift_pay account:', accountError);
      // Continue processing even if we can't get the maker
    }

    // Send notification for InstantPaymentReservedEvent to all participants (including maker now)
    await this.sendEventNotifications(event);

    const parsedPayoutDetails = parsePayoutDetails(payoutDetails);
    if (!parsedPayoutDetails) {
      await this.logPayoutError(event, 'PARSE_ERROR', 'Invalid payout details format');
      return;
    }

    const flutterwaveValidation = this.flutterwaveService.validatePayoutDetails(
      parsedPayoutDetails,
      parseFloat(fiatAmount),
      currency
    );

    if (!flutterwaveValidation.isValid) {
      const errorMsg = `Validation failed: ${flutterwaveValidation.errors.join(", ")}`;
      console.error("❌ Payout validation failed:", flutterwaveValidation.errors);
      await this.logPayoutError(event, 'VALIDATION_FAILED', errorMsg);
      return;
    }

    await this.logPayoutAttempt(event, "initiated");

    console.log(`🚀 Initiating payout: ${payoutReference} - ${fiatAmount} ${currency}`);

    try {
      const flutterwaveResponse = await this.flutterwaveBreaker.call(
        () => this.flutterwaveService.initiatePayout(
          parsedPayoutDetails,
          parseFloat(fiatAmount),
          currency,
          payoutReference
        ),
        () => ({
          success: false,
          error: "Payout service temporarily unavailable",
          errorCode: "SERVICE_CIRCUIT_OPEN",
          flw_ref: undefined,
          reference: payoutReference,
          data: undefined,
        })
      );

      payoutResult = {
        success: flutterwaveResponse.success,
        error: flutterwaveResponse.error,
        errorCode: undefined,
        flw_ref: flutterwaveResponse.flw_ref,
        reference: flutterwaveResponse.reference,
        data: flutterwaveResponse.data ? {
          id: flutterwaveResponse.data.id,
          account_number: flutterwaveResponse.data.account_number,
          bank_code: flutterwaveResponse.data.bank_code,
          full_name: flutterwaveResponse.data.full_name,
          created_at: flutterwaveResponse.data.created_at,
          currency: flutterwaveResponse.data.currency,
          debit_currency: flutterwaveResponse.data.debit_currency,
          amount: flutterwaveResponse.data.amount,
          fee: flutterwaveResponse.data.fee,
          status: flutterwaveResponse.data.status,
          reference: flutterwaveResponse.data.reference,
          meta: flutterwaveResponse.data.meta as Record<string, unknown>,
          narration: flutterwaveResponse.data.narration,
          complete_message: flutterwaveResponse.data.complete_message,
          requires_approval: flutterwaveResponse.data.requires_approval,
          is_approved: flutterwaveResponse.data.is_approved,
          bank_name: flutterwaveResponse.data.bank_name,
        } : null,
      };

      if (payoutResult.success) {
        console.log(`✅ Payout successful: ${payoutReference}`);
        this.payoutsProcessed++;
      } else {
        console.error(`❌ Payout failed: ${payoutReference}`, payoutResult.error);
      }
    } catch (payoutError) {
      console.error(`❌ Payout service error: ${payoutReference}`, payoutError);
      const error = payoutError as Error & { 
        code?: string; 
        response?: { data?: Record<string, unknown> } 
      };
      
      payoutResult = {
        success: false,
        error: error.message || "Payout service unavailable",
        errorCode: error.code || "SERVICE_ERROR",
        flw_ref: null,
        reference: payoutReference,
        data: (error.response?.data as FlutterwaveTransferData) || null,
      };
    }

    console.log("⏳ Waiting 5 seconds before on-chain confirmation...");
    await new Promise((resolve) => setTimeout(resolve, 5000));

    try {
      await this.solanaBreaker.call(() =>
        this.confirmPayoutOnChain(event, payoutResult!, payoutResult!.success)
      );
    } catch (onChainError) {
      console.error("❌ On-chain confirmation failed:", onChainError);
      await this.logTransactionError(event, onChainError as Error);
    }

    // This will send InstantPaymentPayoutResultEvent notification
    try {
      await this.sendPayoutNotification(event, payoutResult!.success, payoutResult!);
    } catch (notificationError) {
      console.error("❌ Error sending notification:", notificationError);
    }

    await this.logPayoutAttempt(
      event,
      payoutResult!.success ? "completed" : "failed",
      payoutResult!
    );

  } catch (error) {
    console.error("❌ Error handling InstantPaymentReserved:", error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    await this.logPayoutError(event, 'PROCESSING_ERROR', errorMessage);
  } finally {
    this.pendingPayments.delete(payoutReference);
  }
}

  private async logPayoutError(
    event: ParsedEvent,
    errorType: string,
    errorMessage: string
  ): Promise<void> {
    try {
      const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );
      
      await supabaseAdmin.from('payout_errors').insert({
        payout_reference: event.data.payoutReference,
        taker: event.data.taker,
        error_type: errorType,
        error_message: errorMessage,
        event_data: JSON.stringify(event.data),
        timestamp: new Date().toISOString(),
      });
    } catch (dbError) {
      console.error('❌ Failed to log payout error:', dbError);
    }
  }

  private async logPayoutAttempt(
    event: ParsedEvent,
    status: 'initiated' | 'completed' | 'failed',
    result?: PayoutResult
  ): Promise<void> {
    try {
      const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );
      
      await supabaseAdmin.from('payout_logs').insert({
        payout_reference: event.data.payoutReference,
        taker: event.data.taker,
        amount: event.data.amount,
        fiat_amount: event.data.fiatAmount,
        currency: event.data.currency,
        status,
        flw_ref: result?.flw_ref,
        error_message: result?.error,
        error_code: result?.errorCode,
        timestamp: new Date().toISOString(),
        event_signature: event.signature
      });
    } catch (dbError) {
      console.error('❌ Failed to log payout attempt:', dbError);
    }
  }

  private async logTransactionError(event: ParsedEvent, error: Error): Promise<void> {
    try {
      const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );
      
      await supabaseAdmin.from('transaction_errors').insert({
        payout_reference: event.data.payoutReference,
        error_message: error.message,
        error_stack: error.stack,
        timestamp: new Date().toISOString(),
      });
    } catch (dbError) {
      console.error('❌ Failed to log transaction error:', dbError);
    }
  }

private async confirmPayoutOnChain(
  event: ParsedEvent,
  payoutResult: PayoutResult,
  success: boolean
): Promise<string | null> {
  try {
    console.log(`🔗 Confirming payout on-chain: ${success ? "SUCCESS" : "FAILURE"}`);

   
    if (!event.data.swiftPay || !event.data.taker || !event.data.payoutReference) {
      throw new Error("Missing required event data for on-chain confirmation");
    }

   
    const message = success
      ? "Payout completed successfully"
      : `Payout failed: ${payoutResult.error || "Unknown error"}`;

    const confirmPayoutInstruction = await this.buildConfirmPayoutInstruction(
      event.data.swiftPay,
      event.data.taker,
      event.data.payoutReference,
      success,
      payoutResult.flw_ref || "",
      message,
      event
    );

    const transaction = new Transaction();
    transaction.add(confirmPayoutInstruction);

   
    const { blockhash } = await this.connection.getLatestBlockhash("confirmed");
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = this.botWallet.publicKey;

   
    transaction.sign(this.botWallet);

   
    const signature = await this.connection.sendTransaction(transaction, [this.botWallet], {
      skipPreflight: false,
      preflightCommitment: "confirmed",
    });

   
    const confirmation = await this.connection.confirmTransaction(signature, "confirmed");

    if (confirmation.value.err) {
      throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
    }

    console.log(`✅ Payout confirmation confirmed on-chain: ${signature}`);
    return signature;

  } catch (error) {
    console.error("❌ Failed to confirm payout on-chain:", error);
    await this.logTransactionError(event, error as Error);
    return null;
  }
}

private async buildConfirmPayoutInstruction(
  swiftPayAddress: string,
  taker: string,
  payoutReference: string,
  success: boolean,
  flwRef: string,
  message: string,
  event: ParsedEvent
): Promise<TransactionInstruction> {
  try {
    const swiftPayAccount = new PublicKey(swiftPayAddress);
    const takerPubkey = new PublicKey(taker);

   
    const swiftPayAccountInfo = await this.connection.getAccountInfo(swiftPayAccount);
    if (!swiftPayAccountInfo) {
      throw new Error(`SwiftPay account not found: ${swiftPayAddress}`);
    }

   
    const { maker, mintA, feeDestination, reservedAmounts, seed, bump } = 
      await this.deserializeSwiftPayAccount(swiftPayAccountInfo.data);

   
    const seedAsU64 = BigInt(seed);
    const seedBuffer = Buffer.alloc(8);
    seedBuffer.writeBigUInt64LE(seedAsU64, 0);

    const [derivedSwiftPayPDA, derivedBump] = await PublicKey.findProgramAddress(
      [
        Buffer.from("swift-pay"), 
        maker.toBuffer(),
        seedBuffer
      ],
      new PublicKey(process.env.SWIFT_PAY_PROGRAM_ID!)
    );

    console.log(`🔍 DEBUG: PDA derivation:`, {
      provided: swiftPayAddress,
      derived: derivedSwiftPayPDA.toString(),
      matches: derivedSwiftPayPDA.toString() === swiftPayAddress,
      maker: maker.toString(),
      seed: seed,
      derivedBump,
      storedBump: bump
    });

   
    const correctSwiftPayAccount = derivedSwiftPayPDA;

   
    const reservation = reservedAmounts.find(
      (r: ReservedAmount) => r.taker.toString() === taker && r.payoutReference === payoutReference
    );

    if (!reservation) {
      throw new Error(`Reservation not found for taker: ${taker}, reference: ${payoutReference}`);
    }

   
    const { tokenProgram } = await this.detectTokenProgram(mintA);
    const ATA_PROGRAM = new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');
    
    const [swiftPayAta] = await PublicKey.findProgramAddress(
      [correctSwiftPayAccount.toBuffer(), tokenProgram.toBuffer(), mintA.toBuffer()],
      ATA_PROGRAM
    );

    const [feeDestinationAta] = await PublicKey.findProgramAddress(
      [feeDestination.toBuffer(), tokenProgram.toBuffer(), mintA.toBuffer()],
      ATA_PROGRAM
    );

    const [takerAta] = await PublicKey.findProgramAddress(
      [takerPubkey.toBuffer(), tokenProgram.toBuffer(), mintA.toBuffer()],
      ATA_PROGRAM
    );

    let makerAta = SystemProgram.programId;
    if (success) {
      [makerAta] = await PublicKey.findProgramAddress(
        [maker.toBuffer(), tokenProgram.toBuffer(), mintA.toBuffer()],
        ATA_PROGRAM
      );
    }

   
    const accounts = [
      { pubkey: correctSwiftPayAccount, isSigner: false, isWritable: true },  
      { pubkey: this.botWallet.publicKey, isSigner: true, isWritable: false },
      { pubkey: maker, isSigner: false, isWritable: false },
      { pubkey: mintA, isSigner: false, isWritable: false },
      { pubkey: swiftPayAta, isSigner: false, isWritable: true },
      { pubkey: feeDestinationAta, isSigner: false, isWritable: true },
      { pubkey: !success ? takerAta : SystemProgram.programId, isSigner: false, isWritable: !success },
      { pubkey: success ? makerAta : SystemProgram.programId, isSigner: false, isWritable: success },
      { pubkey: tokenProgram, isSigner: false, isWritable: false },
    ];

   
    const instructionData = this.buildConfirmPayoutInstructionData({
      taker: takerPubkey,
      amount: BigInt(reservation.amount),
      fiatAmount: BigInt(reservation.fiatAmount),
      currency: event.data.currency || 'NGN',
      payoutReference,
      success,
      message: message.substring(0, 200),
    });

    return new TransactionInstruction({
      programId: new PublicKey(process.env.SWIFT_PAY_PROGRAM_ID!),
      keys: accounts,
      data: instructionData,
    });

  } catch (error) {
    console.error("❌ Error building confirm payout instruction:", error);
    throw error;
  }
}

private buildConfirmPayoutInstructionData({
  taker,
  amount,
  fiatAmount,
  currency,
  payoutReference,
  success,
  message,
}: {
  taker: PublicKey;
  amount: bigint;
  fiatAmount: bigint;
  currency: string;
  payoutReference: string;
  success: boolean;
  message: string;
}): Buffer {
  try {
   
    const instructionDiscriminator = Buffer.from([148, 97, 145, 2, 85, 139, 4, 140]);
    
    const currencyBytes = Buffer.from(currency, "utf8");
    const payoutRefBytes = Buffer.from(payoutReference, "utf8");
    const messageBytes = Buffer.from(message, "utf8");

    const bufferSize =
      8 +
      32 +
      8 +
      8 +
      4 + currencyBytes.length +
      4 + payoutRefBytes.length +
      1 +
      4 + messageBytes.length;

    const instructionData = Buffer.alloc(bufferSize);
    let offset = 0;

   
    instructionDiscriminator.copy(instructionData, offset);
    offset += 8;

   
    taker.toBuffer().copy(instructionData, offset);
    offset += 32;

   
    instructionData.writeBigUInt64LE(amount, offset);
    offset += 8;

   
    instructionData.writeBigUInt64LE(fiatAmount, offset);
    offset += 8;

   
    instructionData.writeUInt32LE(currencyBytes.length, offset);
    offset += 4;
    currencyBytes.copy(instructionData, offset);
    offset += currencyBytes.length;

   
    instructionData.writeUInt32LE(payoutRefBytes.length, offset);
    offset += 4;
    payoutRefBytes.copy(instructionData, offset);
    offset += payoutRefBytes.length;

   
    instructionData.writeUInt8(success ? 1 : 0, offset);
    offset += 1;

   
    instructionData.writeUInt32LE(messageBytes.length, offset);
    offset += 4;
    messageBytes.copy(instructionData, offset);

    return instructionData;

  } catch (error) {
  console.error("❌ Failed to build instruction data:", error);
  const errorMessage = error instanceof Error ? error.message : String(error);
  throw new Error(`Instruction data building failed: ${errorMessage}`);
}
}

private async deserializeSwiftPayAccount(data: Buffer): Promise<{
  seed: string;
  maker: PublicKey;
  mintA: PublicKey;
  currency: string;
  trustExpressType: number;
  feePercentage: number;
  feeDestination: PublicKey;
  reservedFee: string;
  amount: string;
  pricePerToken: string;
  paymentInstructions: string;
  reservedAmounts: ReservedAmount[];
  bump: number;
}> {
  try {
    if (!data || data.length < 200) {
      throw new Error(`Account data too small: ${data?.length || 0} bytes`);
    }

    let offset = 0;

   
    const discriminator = Array.from(data.slice(0, 8));
    const expectedDiscriminator = [ 81, 251, 203, 243, 129, 60, 135, 244 ];

    if (!this.arraysEqual(discriminator, expectedDiscriminator)) {
      throw new Error(
        `Invalid account discriminator. Expected: ${expectedDiscriminator}, Got: ${discriminator}`
      );
    }

    offset = 8;

   
    const seed = data.readBigUInt64LE(offset);
    offset += 8;

   
    const maker = new PublicKey(data.slice(offset, offset + 32));
    offset += 32;

   
    const mintA = new PublicKey(data.slice(offset, offset + 32));
    offset += 32;

   
    const currencyBytes = data.slice(offset, offset + 3);
    const currency = String.fromCharCode(...currencyBytes).replace(/\0/g, "");
    offset += 3;

   
    const trustExpressType = data.readUInt8(offset);
    offset += 1;

   
    const feePercentage = data.readUInt16LE(offset);
    offset += 2;

   
    const feeDestination = new PublicKey(data.slice(offset, offset + 32));
    offset += 32;

   
    const reservedFee = data.readBigUInt64LE(offset);
    offset += 8;

   
    const amount = data.readBigUInt64LE(offset);
    offset += 8;

   
    const pricePerToken = data.readBigUInt64LE(offset);
    offset += 8;

   
    const paymentInstructionsLength = data.readUInt32LE(offset);
    offset += 4;

    if (paymentInstructionsLength > 300) {
      throw new Error(`Invalid payment_instructions length: ${paymentInstructionsLength}`);
    }

    const paymentInstructions = data
      .slice(offset, offset + paymentInstructionsLength)
      .toString("utf8");
    offset += paymentInstructionsLength;

   
    const reservedAmountsLength = data.readUInt32LE(offset);
    offset += 4;

    if (reservedAmountsLength > 10) {
      throw new Error(`Invalid reserved_amounts length: ${reservedAmountsLength}`);
    }

    const reservedAmounts = [];
    for (let i = 0; i < reservedAmountsLength; i++) {
      const reservation = this.deserializeReservedAmount(data, offset);
      reservedAmounts.push(reservation.data);
      offset = reservation.newOffset;
    }

   
    const bump = data.readUInt8(offset);

    return {
      seed: seed.toString(),
      maker,
      mintA,
      currency,
      trustExpressType,
      feePercentage,
      feeDestination,
      reservedFee: reservedFee.toString(),
      amount: amount.toString(),
      pricePerToken: pricePerToken.toString(),
      paymentInstructions,
      reservedAmounts,
      bump,
    };

  } catch (error) {
    throw new Error(`SwiftPay account deserialization failed: ${(error as Error).message}`);
  }
}

private arraysEqual(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

private deserializeReservedAmount(data: Buffer, startOffset: number): {
  data: ReservedAmount;
  newOffset: number;
} {
  let offset = startOffset;

  
  const taker = new PublicKey(data.slice(offset, offset + 32));
  offset += 32;

  
  const amount = data.readBigUInt64LE(offset);
  offset += 8;

  
  const fiatAmount = data.readBigUInt64LE(offset);
  offset += 8;

  
  const timestamp = data.readBigInt64LE(offset);
  offset += 8;

  
  const hasSellerInstructions = data.readUInt8(offset) === 1;
  offset += 1;

  let sellerInstructions = null;
  if (hasSellerInstructions) {
    const instructionsLength = data.readUInt32LE(offset);
    offset += 4;
    sellerInstructions = data
      .slice(offset, offset + instructionsLength)
      .toString("utf8");
    offset += instructionsLength;
  }

  
  const status = data.readUInt8(offset);
  offset += 1;

  
  const hasDisputeReason = data.readUInt8(offset) === 1;
  offset += 1;

  let disputeReason = null;
  if (hasDisputeReason) {
    const reasonLength = data.readUInt32LE(offset);
    offset += 4;
    disputeReason = data
      .slice(offset, offset + reasonLength)
      .toString("utf8");
    offset += reasonLength;
  }

  
  const hasDisputeId = data.readUInt8(offset) === 1;
  offset += 1;

  let disputeId = null;
  if (hasDisputeId) {
    const disputeIdLength = data.readUInt32LE(offset);
    offset += 4;
    disputeId = data.slice(offset, offset + disputeIdLength).toString("utf8");
    offset += disputeIdLength;
  }

  
  const hasPayoutDetails = data.readUInt8(offset) === 1;
  offset += 1;

  let payoutDetails = null;
  if (hasPayoutDetails) {
    const payoutDetailsLength = data.readUInt32LE(offset);
    offset += 4;
    payoutDetails = data
      .slice(offset, offset + payoutDetailsLength)
      .toString("utf8");
    offset += payoutDetailsLength;
  }

  
  const hasPayoutReference = data.readUInt8(offset) === 1;
  offset += 1;

  let payoutReference = null;
  if (hasPayoutReference) {
    const payoutReferenceLength = data.readUInt32LE(offset);
    offset += 4;
    payoutReference = data
      .slice(offset, offset + payoutReferenceLength)
      .toString("utf8");
    offset += payoutReferenceLength;
  }

  return {
    data: {
      taker,
      amount: amount.toString(),
      fiatAmount: fiatAmount.toString(),
      timestamp: timestamp.toString(),
      sellerInstructions,
      status,
      disputeReason,
      disputeId,
      payoutDetails,
      payoutReference,
    },
    newOffset: offset,
  };
}

  private async getConfirmPayoutAccounts(event: ParsedEvent, success: boolean) {
    const swiftPayAccountPubkey = new PublicKey(event.data.swiftPay!);
        
    const accounts = [

      { pubkey: swiftPayAccountPubkey, isSigner: false, isWritable: true },

      { pubkey: this.botWallet.publicKey, isSigner: true, isWritable: false },

      { pubkey: swiftPayAccountPubkey, isSigner: false, isWritable: false }, 

      { pubkey: new PublicKey('11111111111111111111111111111111'), isSigner: false, isWritable: false }, 

      { pubkey: new PublicKey('11111111111111111111111111111111'), isSigner: false, isWritable: true }, 

      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, 

      { pubkey: success ? SystemProgram.programId : new PublicKey('11111111111111111111111111111111'), isSigner: false, isWritable: true },

      { pubkey: success ? new PublicKey('11111111111111111111111111111111') : SystemProgram.programId, isSigner: false, isWritable: true },

      { pubkey: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'), isSigner: false, isWritable: false },
    ];

    return accounts;
  }

  private async detectTokenProgram(mint: PublicKey): Promise<{ tokenProgram: PublicKey }> {
  const TOKEN_PROGRAM = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
  const TOKEN_2022_PROGRAM = new PublicKey('TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb');

  const mintAccountInfo = await this.connection.getAccountInfo(mint);
  
  if (!mintAccountInfo) {
    throw new Error(`Mint account not found: ${mint.toString()}`);
  }

  if (mintAccountInfo.owner.equals(TOKEN_2022_PROGRAM)) {
    return { tokenProgram: TOKEN_2022_PROGRAM };
  } else if (mintAccountInfo.owner.equals(TOKEN_PROGRAM)) {
    return { tokenProgram: TOKEN_PROGRAM };
  } else {
    throw new Error(`Unknown token program for mint: ${mintAccountInfo.owner.toString()}`);
  }
}



  private async sendPayoutNotification(
    event: ParsedEvent,
    success: boolean,
    result: PayoutResult
  ): Promise<void> {
    console.log(`📬 Sending payout notification: ${success ? 'SUCCESS' : 'FAILURE'}`);
    console.log(`Event: ${event.data.payoutReference}, FlwRef: ${result.flw_ref}`);
    // TODO: Implement actual notification sending
  }

  async initialize(): Promise<void> {
    console.log("🔧 Starting bot initialization...");
    try {
      console.log("🔌 Testing Supabase connection...");
      const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );
      
      const { error } = await supabaseAdmin
        .from("user_subscriptions")
        .select("id")
        .limit(1);

      if (error) {
        console.error("❌ Supabase connection failed:", error);
        throw error;
      }

      await this.client.login(process.env.DISCORD_BOT_TOKEN!);

      this.client.on("clientReady", () => {
        console.log(`✅ Discord bot logged in as ${this.client.user?.tag}`);
        this.startEventListening();
      });

      this.client.on("error", (error) => {
        console.error("❌ Discord client error:", error);
      });
    } catch (error) {
      console.error("❌ Failed to initialize Discord bot:", error);
      throw error;
    }
  }

  private async startEventListening(): Promise<void> 
  {
    if (this.isListening) return;

    try {
      const programId = new PublicKey(process.env.SWIFT_PAY_PROGRAM_ID!);

      console.log("🎯 Listening for program ID:", programId.toString());
console.log("📡 RPC URL:", process.env.NEXT_PUBLIC_SOLANA_RPC_URL);
     this.connection.onLogs(
      programId,
      (logs: TransactionLogs) => {
        console.log(`Received logs for program ${programId.toString()}:`, logs.signature); 
        const logsContext: LogsContext = {
          signature: logs.signature || 'unknown',
          accounts: [],
          programId: programId.toString(),
        };
        
        this.processLogs(logs, logsContext);
      },
      "confirmed"
    );

      this.isListening = true;
      console.log("✅ Started listening for program events");
    } catch (error) {
      console.error("❌ Failed to start event listening:", error);
    }
  }

  private async processLogs(logs: TransactionLogs, context: LogsContext): Promise<void> {
    try {
      this.eventsProcessed++;

      
      const events = this.eventParser.parseLogsForEvents(logs, context);
      
      if (events.length === 0) return;

      for (const event of events) {
        
        const compatibleEvent: ParsedEvent = {
          type: event.type,
          data: {
            swiftPay: event.data.swiftPay,
            taker: event.data.taker,
            amount: event.data.amount,
            fiatAmount: event.data.fiatAmount,
            currency: event.data.currency,
            payoutDetails: event.data.payoutDetails,
            payoutReference: event.data.payoutReference,
          },
          participants: event.participants,
          signature: event.signature || context.signature || 'unknown',
          timestamp: event.timestamp || Date.now(),
        };
        
        await this.handleEvent(compatibleEvent);
      }
    } catch (error) {
      console.error("❌ Bot: Error processing logs:", error);
    }
  }

  private async handleEvent(event: ParsedEvent): Promise<void> {
    try {
      console.log(`🔎 Processing event: ${event.type}`);

      if (event.type === "InstantPaymentReservedEvent") {
        await this.handleInstantPaymentReserved(event);
        return;
      }
      await this.sendEventNotifications(event);

      console.log(`ℹ️ Event ${event.type} processed`);
    } catch (error) {
      console.error(`❌ Bot: Error handling event ${event.type}:`, error);
    }
  }

private async sendEventNotifications(event: ParsedEvent): Promise<void> {
  try {
    console.log(`📧 sendEventNotifications called for ${event.type}`);
    console.log(`📧 Participants:`, event.participants);
    const participants = event.participants || {};
    
    if (Object.keys(participants).length === 0) {
      console.log(`⚠️ No participants found for event ${event.type}`);
      return;
    }

    const validEventTypes = [
      'BuyOrderCreatedEvent',
      'BuyOrderCancelledEvent',
      'BuyOrderReducedEvent',
      'PriceUpdatedEvent',
      'ReservationCancelledEvent',
      'InstantPaymentReservedEvent',
      'InstantPaymentPayoutResultEvent'
    ] as const;

    type ValidEventType = typeof validEventTypes[number];
    type UserRole = 'buyer' | 'seller' | 'taker' | 'maker' | 'user';

    if (!validEventTypes.includes(event.type as ValidEventType)) {
      console.log(`⚠️ Unknown event type: ${event.type}`);
      return;
    }

    for (const [role, walletAddress] of Object.entries(participants)) {
      console.log(`📧 Processing role: ${role}, wallet: ${walletAddress}`);

      if (!walletAddress || !this.isValidRole(role)) {
        console.log(`⚠️ Skipping - invalid role or no wallet`);
        continue;
      }

      try {
        console.log(`📧 Creating embed for ${event.type} - ${role}`);
        // Pass event.data directly - createEmbed handles the type narrowing
        const embed = this.embedCreator.createEmbed(
          event.type as ValidEventType,
          event.data as never, // Use 'never' to bypass the union type check
          role as UserRole
        );

        const eventTypeKey = this.notificationManager.getEventTypeForRole(
          event.type,
          role as UserRole
        );
console.log(`📧 Event type key: ${eventTypeKey}`);

        const sent = await this.notificationManager.sendNotificationToWallet(
          walletAddress,
          eventTypeKey,
          embed
        );
console.log(`📧 Notifications sent to: ${sent.join(', ')}`);

        if (sent.length > 0) {
          this.notificationsSent += sent.length;
          console.log(`✅ Sent ${event.type} notification to ${role}: ${walletAddress}`);
        }
      } catch (error) {
        console.error(`❌ Failed to send notification to ${role} (${walletAddress}):`, error);
      }
    }
  } catch (error) {
    console.error(`❌ Error sending event notifications:`, error);
  }
}

private isValidRole(role: string): role is 'buyer' | 'seller' | 'taker' | 'maker' | 'user' {
  const validRoles = ['buyer', 'seller', 'taker', 'maker', 'user'];
  return validRoles.includes(role);
}

  private async waitForPendingPayments(timeoutMs: number): Promise<void> {
    const startTime = Date.now();
    
    while (this.pendingPayments.size > 0 && (Date.now() - startTime) < timeoutMs) {
      console.log(`⏳ Waiting for ${this.pendingPayments.size} pending payments to complete...`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    if (this.pendingPayments.size > 0) {
      console.warn(`⚠️ ${this.pendingPayments.size} payments still pending after timeout`);
    }
  }

  async shutdown(): Promise<void> {
    console.log("🛑 Shutting down bot...");
    this.isListening = false;
    await this.waitForPendingPayments(30000);
    await this.client.destroy();
    console.log("✅ Bot shutdown complete");
  }
}


class CircuitBreaker {
  private name: string;
  private failureCount: number;
  private threshold: number;
  private timeout: number;
  private resetTimeout: number;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  private nextAttempt: number;
  private lastFailure: Error | null;

  constructor(name: string, options: { threshold?: number; timeout?: number; resetTimeout?: number } = {}) {
    this.name = name;
    this.failureCount = 0;
    this.threshold = options.threshold ?? 5;
    this.timeout = options.timeout ?? 60000;
    this.resetTimeout = options.resetTimeout ?? 30000;
    this.state = "CLOSED";
    this.nextAttempt = Date.now();
    this.lastFailure = null;
  }

  async call<T>(fn: () => Promise<T>, fallback?: () => T): Promise<T> {
    if (this.state === "OPEN") {
      if (Date.now() < this.nextAttempt) {
        console.log(`🚫 Circuit breaker ${this.name} is OPEN, rejecting call`);
        if (fallback) return fallback();
        throw new Error(`Circuit breaker ${this.name} is OPEN`);
      } else {
        this.state = "HALF_OPEN";
        console.log(`🔄 Circuit breaker ${this.name} moving to HALF_OPEN`);
      }
    }

    try {
      const result = await fn();
      this.reset();
      return result;
    } catch (error) {
      this.recordFailure(error as Error);
      throw error;
    }
  }

  private recordFailure(error: Error): void {
    this.failureCount++;
    this.lastFailure = error;

    if (this.failureCount >= this.threshold) {
      this.state = "OPEN";
      this.nextAttempt = Date.now() + this.resetTimeout;
      console.log(`🔴 Circuit breaker ${this.name} is now OPEN for ${this.resetTimeout}ms`);
    }
  }

  private reset(): void {
    if (this.failureCount > 0) {
      console.log(`✅ Circuit breaker ${this.name} reset - service healthy`);
    }
    this.failureCount = 0;
    this.state = "CLOSED";
    this.lastFailure = null;
  }
}

export default SwiftPayDiscordBot;


async function main() {
  console.log("Starting SwiftPay Discord Bot...");
  
  const bot = new SwiftPayDiscordBot();
  
  
  process.on('SIGINT', async () => {
    console.log('\nReceived SIGINT, shutting down gracefully...');
    await bot.shutdown();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('\nReceived SIGTERM, shutting down gracefully...');
    await bot.shutdown();
    process.exit(0);
  });

  try {
    await bot.initialize();
    console.log("Bot initialized successfully!");
  } catch (error) {
    console.error("Failed to start bot:", error);
    process.exit(1);
  }
}


main().catch(console.error);