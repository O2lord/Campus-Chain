import { PublicKey } from "@solana/web3.js";
import { Buffer } from "buffer";

interface EventDiscriminators {
  [key: string]: number[];
}

interface DecodedEvent {
  eventType: string;
  swiftPay?: string;
  trustVault?: string;
  participants?: { [key: string]: string };
  maker?: string;
  buyer?: string;
  taker?: string;
  amount?: string;
  fiatAmount?: string;
  currency?: string;
  oldPrice?: string;
  newPrice?: string;
  mint?: string;
  pricePerToken?: string;
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
}

interface AddressInfo {
  address: string;
  offset: number;
  type: string;
}

interface Participants {
  [role: string]: string;
}

/**
 * Decodes Solana program event data from base64 encoded program data
 */
export class EventDecoder {
  private eventDiscriminators: EventDiscriminators;

  constructor() {
    this.eventDiscriminators = {
      PriceUpdatedEvent: [217, 171, 222, 24, 64, 152, 217, 36],
      BuyOrderReducedEvent: [250, 72, 155, 121, 173, 162, 112, 178],
      BuyOrderCancelledEvent: [118, 145, 69, 220, 68, 112, 48, 144],
      BuyOrderCreatedEvent: [158, 4, 42, 74, 250, 125, 66, 173],
      InstantPaymentReservedEvent: [1, 110, 251, 231, 168, 10, 216, 190],
      InstantPaymentPayoutResultEvent: [114, 61, 126, 78, 83, 230, 103, 231],
    };
  }

  /**
   * Decode program data to extract event information
   */
  decodeProgramData(programDataBase64: string): DecodedEvent | null {
    try {
      
      const buffer = Buffer.from(programDataBase64, "base64");

      
      const eventType = this.identifyEventType(buffer);
      if (!eventType) {
        return null;
      }

      
      switch (eventType) {
        case "PriceUpdatedEvent":
          return this.decodePriceUpdatedEvent(buffer);
        case "BuyOrderReducedEvent":
          return this.decodeBuyOrderReducedEvent(buffer);
        case "BuyOrderCancelledEvent":
          return this.decodeBuyOrderCancelledEvent(buffer);
        case "BuyOrderCreatedEvent":
          return this.decodeBuyOrderCreatedEvent(buffer);
        case "InstantPaymentReservedEvent":
          return this.decodeInstantPaymentReservedEvent(buffer);
        case "InstantPaymentPayoutResultEvent":
          return this.decodeInstantPaymentPayoutResultEvent(buffer);
        default:
          return null;
      }
    } catch (error) {
      console.error("❌ EventDecoder: Error decoding program data:", error);
      return null;
    }
  }

  /**
   * Identify event type from buffer discriminator
   */
  private identifyEventType(buffer: Buffer): string | null {
    
    if (buffer.length < 8) {
      return null;
    }

   
    const discriminator = Array.from(buffer.slice(0, 8));

   
    for (const [eventType, expectedDiscriminator] of Object.entries(
      this.eventDiscriminators
    )) {
      if (this.arraysEqual(discriminator, expectedDiscriminator)) {
        console.log(`EventDecoder: Identified event type: ${eventType}`); 
        return eventType;
      }
    }
    console.log("EventDecoder: No event type identified from discriminator."); 
    return null;
  }

  /**
   * Helper function to compare two arrays
   */
  private arraysEqual(a: number[], b: number[]): boolean {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return false;
    }
    return true;
  }

  /**
   * Decode PriceUpdatedEvent from buffer
   * Updated to match: swift_pay, maker, old_price, new_price, currency
   */
  private decodePriceUpdatedEvent(buffer: Buffer): DecodedEvent | null {
    try {
      let offset = 8;

      const swiftPay = new PublicKey(buffer.slice(offset, offset + 32));
      offset += 32;

      const maker = new PublicKey(buffer.slice(offset, offset + 32));
      offset += 32;

      const oldPrice = buffer.readBigUInt64LE(offset);
      offset += 8;

      const newPrice = buffer.readBigUInt64LE(offset);
      offset += 8;

      const currencyLength = buffer.readUInt32LE(offset);
      offset += 4;

      const currency = buffer
        .slice(offset, offset + currencyLength)
        .toString("utf8");

      return {
        eventType: "PriceUpdatedEvent",
        swiftPay: swiftPay.toString(),
        maker: maker.toString(),
        oldPrice: oldPrice.toString(),
        newPrice: newPrice.toString(),
        currency,
        oldPriceFormatted: (Number(oldPrice) / 1e9).toFixed(2),
        newPriceFormatted: (Number(newPrice) / 1e9).toFixed(2),
        participants: { seller: maker.toString() },
      };
    } catch (error) {
      console.error(
        "❌ EventDecoder: Error decoding PriceUpdatedEvent:",
        error
      );
      return this.createGenericDecoding(buffer, "PriceUpdatedEvent");
    }
  }

  /**
   * Decode BuyOrderCreatedEvent from buffer
   * Updated to match: swift_pay, buyer, mint, amount, price_per_token, currency, payment_instructions
   */
  private decodeBuyOrderCreatedEvent(buffer: Buffer): DecodedEvent | null {
    try {
      let offset = 8;

      const swiftPay = new PublicKey(buffer.slice(offset, offset + 32));
      offset += 32;

      const buyer = new PublicKey(buffer.slice(offset, offset + 32));
      offset += 32;

      const mint = new PublicKey(buffer.slice(offset, offset + 32));
      offset += 32;

      const amount = buffer.readBigUInt64LE(offset);
      offset += 8;

      const pricePerToken = buffer.readBigUInt64LE(offset);
      offset += 8;

      const currencyLength = buffer.readUInt32LE(offset);
      offset += 4;

      const currency = buffer
        .slice(offset, offset + currencyLength)
        .toString("utf8");
      offset += currencyLength;

      const instructionsLength = buffer.readUInt32LE(offset);
      offset += 4;

      const paymentInstructions = buffer
        .slice(offset, offset + instructionsLength)
        .toString("utf8");

      return {
        eventType: "BuyOrderCreatedEvent",
        swiftPay: swiftPay.toString(),
        buyer: buyer.toString(),
        mint: mint.toString(),
        amount: amount.toString(),
        pricePerToken: pricePerToken.toString(),
        currency,
        paymentInstructions,
        amountFormatted: (Number(amount) / 1e9).toFixed(2),
        pricePerTokenFormatted: (Number(pricePerToken) / 1e9).toLocaleString(),
        participants: { buyer: buyer.toString() },
      };
    } catch (error) {
      console.error(
        "❌ EventDecoder: Error decoding BuyOrderCreatedEvent:",
        error
      );
      return null;
    }
  }

  /**
   * Decode BuyOrderReducedEvent from buffer
   * Updated to match: swift_pay, buyer, original_amount, new_amount, timestamp
   */
  private decodeBuyOrderReducedEvent(buffer: Buffer): DecodedEvent | null {
    try {
      let offset = 8;

      const swiftPay = new PublicKey(buffer.slice(offset, offset + 32));
      offset += 32;

      const buyer = new PublicKey(buffer.slice(offset, offset + 32));
      offset += 32;

      const originalAmount = buffer.readBigUInt64LE(offset);
      offset += 8;

      const newAmount = buffer.readBigUInt64LE(offset);
      offset += 8;

      const timestamp = buffer.readBigInt64LE(offset);

      return {
        eventType: "BuyOrderReducedEvent",
        swiftPay: swiftPay.toString(),
        buyer: buyer.toString(),
        originalAmount: originalAmount.toString(),
        newAmount: newAmount.toString(),
        timestamp: timestamp.toString(),
        participants: { buyer: buyer.toString() },
      };
    } catch (error) {
      console.error(
        "❌ EventDecoder: Error decoding BuyOrderReducedEvent:",
        error
      );
      return null;
    }
  }

  /**
   * Decode BuyOrderCancelledEvent from buffer
   * Updated to match: swift_pay, buyer, original_amount, timestamp
   */
  private decodeBuyOrderCancelledEvent(buffer: Buffer): DecodedEvent | null {
    try {
      let offset = 8;

      const swiftPay = new PublicKey(buffer.slice(offset, offset + 32));
      offset += 32;

      const buyer = new PublicKey(buffer.slice(offset, offset + 32));
      offset += 32;

      const originalAmount = buffer.readBigUInt64LE(offset);
      offset += 8;

      const timestamp = buffer.readBigInt64LE(offset);

      return {
        eventType: "BuyOrderCancelledEvent",
        swiftPay: swiftPay.toString(),
        buyer: buyer.toString(),
        originalAmount: originalAmount.toString(),
        timestamp: timestamp.toString(),
        participants: { buyer: buyer.toString() },
      };
    } catch (error) {
      console.error(
        "❌ EventDecoder: Error decoding BuyOrderCancelledEvent:",
        error
      );
      return null;
    }
  }

  /**
   * Decode InstantPaymentReservedEvent from buffer
   * Updated to match: swift_pay, taker, amount, fiat_amount, currency, payout_details, payout_reference
   */
  private decodeInstantPaymentReservedEvent(buffer: Buffer): DecodedEvent | null {
    try {
      console.log("🔍 DEBUG: Buffer length:", buffer.length);
      console.log("🔍 DEBUG: Buffer hex:", buffer.toString("hex"));

      let offset = 8;
      console.log("🔍 DEBUG: Starting offset:", offset);

      const swiftPay = new PublicKey(buffer.slice(offset, offset + 32));
      offset += 32;
      console.log(
        "🔍 DEBUG: SwiftPay:",
        swiftPay.toString(),
        "offset now:",
        offset
      );

      const taker = new PublicKey(buffer.slice(offset, offset + 32));
      offset += 32;
      console.log("🔍 DEBUG: Taker:", taker.toString(), "offset now:", offset);

      const amount = buffer.readBigUInt64LE(offset);
      offset += 8;
      console.log(
        "🔍 DEBUG: Amount:",
        amount.toString(),
        "offset now:",
        offset
      );

      const fiatAmount = buffer.readBigUInt64LE(offset);
      offset += 8;
      console.log(
        "🔍 DEBUG: FiatAmount:",
        fiatAmount.toString(),
        "offset now:",
        offset
      );

      console.log("🔍 DEBUG: About to read currency length at offset:", offset);
      console.log("🔍 DEBUG: Remaining buffer length:", buffer.length - offset);

      if (buffer.length < offset + 4) {
        console.log("❌ DEBUG: Not enough buffer for currency length");
        return null;
      }

      const currencyLength = buffer.readUInt32LE(offset);
      offset += 4;
      console.log(
        "🔍 DEBUG: Currency length:",
        currencyLength,
        "offset now:",
        offset
      );

      if (buffer.length < offset + currencyLength) {
        console.log("❌ DEBUG: Not enough buffer for currency string");
        return null;
      }

      const currency = buffer
        .slice(offset, offset + currencyLength)
        .toString("utf8");
      offset += currencyLength;
      console.log("🔍 DEBUG: Currency:", currency, "offset now:", offset);

      console.log("🔍 DEBUG: About to parse payout details at offset:", offset);
      console.log("🔍 DEBUG: Remaining buffer length:", buffer.length - offset);

      let payoutDetails: string | null = null;
      if (buffer.length > offset) {
        const hasPayoutDetails = buffer.readUInt8(offset) === 1;
        offset += 1;
        console.log(
          "🔍 DEBUG: Has payout details:",
          hasPayoutDetails,
          "offset now:",
          offset
        );

        if (hasPayoutDetails) {
          if (buffer.length >= offset + 4) {
            const payoutDetailsLength = buffer.readUInt32LE(offset);
            offset += 4;
            console.log(
              "🔍 DEBUG: PayoutDetails length:",
              payoutDetailsLength,
              "offset now:",
              offset
            );

            if (
              payoutDetailsLength > 0 &&
              payoutDetailsLength < 10000 && 
              buffer.length >= offset + payoutDetailsLength
            ) {
              payoutDetails = buffer
                .slice(offset, offset + payoutDetailsLength)
                .toString("utf8");
              offset += payoutDetailsLength;
              console.log(
                "🔍 DEBUG: PayoutDetails parsed successfully, offset now:",
                offset
              );
            } else {
              console.log(
                "❌ DEBUG: PayoutDetails length invalid or not enough buffer"
              );
            }
          } else {
            console.log("❌ DEBUG: Not enough buffer for PayoutDetails length");
          }
        }
      }

      console.log(
        "🔍 DEBUG: About to parse payout reference at offset:",
        offset
      );
      console.log("🔍 DEBUG: Remaining buffer length:", buffer.length - offset);

      let payoutReference: string | null = null;
      if (buffer.length >= offset + 4) {
        const payoutReferenceLength = buffer.readUInt32LE(offset);
        offset += 4;
        console.log(
          "🔍 DEBUG: PayoutReference length:",
          payoutReferenceLength,
          "offset now:",
          offset
        );

        if (
          payoutReferenceLength > 0 &&
          payoutReferenceLength < 1000 && 
          buffer.length >= offset + payoutReferenceLength
        ) {
          payoutReference = buffer
            .slice(offset, offset + payoutReferenceLength)
            .toString("utf8");
          offset += payoutReferenceLength;
          console.log(
            "🔍 DEBUG: PayoutReference parsed successfully:",
            payoutReference
          );
        } else {
          console.log(
            "❌ DEBUG: PayoutReference length invalid or not enough buffer"
          );
        }
      } else {
        console.log("❌ DEBUG: Not enough buffer for PayoutReference length");
      }

      console.log("🔍 DEBUG: Final parsed values:", {
        payoutDetails,
        payoutReference,
        currency,
        amount: amount.toString(),
        fiatAmount: fiatAmount.toString(),
      });

      return {
        eventType: "InstantPaymentReservedEvent",
        swiftPay: swiftPay.toString(),
        taker: taker.toString(),
        amount: amount.toString(),
        fiatAmount: fiatAmount.toString(),
        currency,
        payoutDetails,
        payoutReference,
        amountFormatted: (Number(amount) / 1e9).toFixed(2),
        fiatAmountFormatted: Number(fiatAmount).toLocaleString(),
        participants: {
          taker: taker.toString(),
          user: taker.toString(),
        },
      };
    } catch (error) {
      console.error(
        "❌ EventDecoder: Error decoding InstantPaymentReservedEvent:",
        error
      );
      return null;
    }
  }

  /**
   * Decode InstantPaymentPayoutResultEvent from buffer
   * Updated to match: swift_pay, taker, amount, fiat_amount, currency, payout_reference, success, message
   */
  private decodeInstantPaymentPayoutResultEvent(buffer: Buffer): DecodedEvent | null {
    try {
      let offset = 8; 

      const swiftPay = new PublicKey(buffer.slice(offset, offset + 32));
      offset += 32;

      const taker = new PublicKey(buffer.slice(offset, offset + 32));
      offset += 32;

      const amount = buffer.readBigUInt64LE(offset);
      offset += 8;

      const fiatAmount = buffer.readBigUInt64LE(offset);
      offset += 8;

      
      const currencyLength = buffer.readUInt32LE(offset);
      offset += 4;
      const currency = buffer
        .slice(offset, offset + currencyLength)
        .toString("utf8");
      offset += currencyLength;

      
      const payoutReferenceLength = buffer.readUInt32LE(offset);
      offset += 4;
      const payoutReference = buffer
        .slice(offset, offset + payoutReferenceLength)
        .toString("utf8");
      offset += payoutReferenceLength;

      
      const success = buffer.readUInt8(offset) === 1;
      offset += 1;

      
      const messageLength = buffer.readUInt32LE(offset);
      offset += 4;
      const message = buffer
        .slice(offset, offset + messageLength)
        .toString("utf8");

      return {
        eventType: "InstantPaymentPayoutResultEvent",
        swiftPay: swiftPay.toString(),
        taker: taker.toString(),
        amount: amount.toString(),
        fiatAmount: fiatAmount.toString(),
        currency,
        payoutReference,
        success,
        message,
        amountFormatted: (Number(amount) / 1e9).toFixed(2),
        fiatAmountFormatted: Number(fiatAmount).toLocaleString(),
        participants: {
          taker: taker.toString(),
          user: taker.toString(),
        },
      };
    } catch (error) {
      console.error(
        "❌ EventDecoder: Error decoding InstantPaymentPayoutResultEvent:",
        error
      );
      return null;
    }
  }

  /**
   * Generic decoding for events not yet fully implemented
   */
  private createGenericDecoding(buffer: Buffer, eventType: string): DecodedEvent {
    try {
      let offset = 8; 
      const addresses: string[] = [];

      
      while (offset + 32 <= buffer.length) {
        try {
          const potentialKey = new PublicKey(buffer.slice(offset, offset + 32));
          if (this.isValidSolanaAddress(potentialKey.toString())) {
            addresses.push(potentialKey.toString());
          }
        } catch (error) {
          console.error("Error parsing potential key:", error);
          
        }
        offset += 32;
      }

      
      const participants = this.mapAddressesToParticipants(
        addresses,
        eventType
      );

      return {
        eventType,
        addresses,
        participants,
        note: `Generic decoding for ${eventType} - implement specific decoder for full functionality`,
      };
    } catch (error) {
      console.error(
        `❌ EventDecoder: Error in generic decoding for ${eventType}:`,
        error
      );
      return {
        eventType,
        error: "Failed to decode generically",
        participants: {},
      };
    }
  }

  /**
   * Map extracted addresses to likely participant roles based on event type
   */
  private mapAddressesToParticipants(addresses: string[], eventType: string): Participants {
    const participants: Participants = {};

    if (addresses.length === 0) {
      return participants;
    }

    
    switch (eventType) {
      case "DisputeResolvedEvent":
        
        if (addresses.length >= 3) {
          participants.seller = addresses[1]; 
          participants.buyer = addresses[2]; 
        } else if (addresses.length >= 2) {
          participants.seller = addresses[1];
          participants.buyer = addresses[0]; 
        } else if (addresses.length >= 1) {
          participants.seller = addresses[0];
        }
        break;

      case "BuyOrderReservedEvent":
        
        if (addresses.length >= 3) {
          participants.buyer = addresses[1]; 
          participants.seller = addresses[2]; 
        } else if (addresses.length >= 2) {
          participants.buyer = addresses[1];
          participants.seller = addresses[0]; 
        } else if (addresses.length >= 1) {
          participants.buyer = addresses[0];
        }
        break;

      case "BuyerPaymentSentEvent":
        
        if (addresses.length >= 3) {
          participants.buyer = addresses[1]; 
          participants.seller = addresses[2]; 
        } else if (addresses.length >= 2) {
          participants.buyer = addresses[1];
          participants.seller = addresses[0]; 
        } else if (addresses.length >= 1) {
          participants.buyer = addresses[0];
        }
        break;

      case "SellerConfirmsPaymentEvent":
        
        if (addresses.length >= 3) {
          participants.buyer = addresses[1]; 
          participants.seller = addresses[2]; 
        } else if (addresses.length >= 2) {
          participants.buyer = addresses[1];
          participants.seller = addresses[0]; 
        } else if (addresses.length >= 1) {
          participants.seller = addresses[0];
        }
        break;
      default:
        
        if (addresses.length >= 1) {
          participants.participant1 = addresses[0];
        }
        if (addresses.length >= 2) {
          participants.participant2 = addresses[1];
        }
        if (addresses.length >= 3) {
          participants.participant3 = addresses[2];
        }
        break;
    }

    return participants;
  }

  /**
   * Alternative method: Try to extract addresses using pattern matching
   */
  private extractAddressesFromBuffer(buffer: Buffer): AddressInfo[] {
    const addresses: AddressInfo[] = [];

    for (let i = 0; i <= buffer.length - 32; i++) {
      try {
        const potentialKey = new PublicKey(buffer.slice(i, i + 32));
        const keyString = potentialKey.toString();
        if (this.isValidSolanaAddress(keyString)) {
          addresses.push({
            address: keyString,
            offset: i,
            type: this.guessAddressType(keyString, i),
          });
        }
      } catch (error) {
        console.error("Error parsing potential key:", error);
        
      }
    }

    return addresses;
  }

  /**
   * Guess the type of address based on position and known patterns
   */
  private guessAddressType(address: string, offset: number): string {
    const knownAddresses: { [key: string]: string } = {
      ComputeBudget111111111111111111111111111111: "compute_budget_program",
      TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb: "token_program",
      "11111111111111111111111111111111": "system_program",
    };

    if (knownAddresses[address]) {
      return knownAddresses[address];
    }

    
    if (offset === 8) return "swift_pay";
    if (offset === 40) return "maker_or_buyer";
    if (offset === 72) return "taker_or_mint";

    return "unknown";
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