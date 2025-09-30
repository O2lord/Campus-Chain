import { EmbedBuilder } from "discord.js";

interface BaseEventData {
  swiftPay?: string;
  timestamp?: number;
  transactionHash?: string;
  blockNumber?: number;
}

interface BuyOrderCreatedEventData extends BaseEventData {
  buyer: string;
  amountFormatted: string;
  pricePerToken: string;
  currency: string;
}

interface BuyOrderCancelledEventData extends BaseEventData {
  buyer: string;
  orderId?: string;
}

interface BuyOrderReducedEventData extends BaseEventData {
  buyer: string;
  originalAmount: string;
  newAmount: string;
  orderId?: string;
}

interface PriceUpdatedEventData extends BaseEventData {
  seller: string;
  oldPrice?: string;
  newPrice: string;
  currency: string;
}

interface ReservationCancelledEventData extends BaseEventData {
  seller: string;
  buyer: string;
  amountFormatted: string;
}

interface InstantPaymentReservedEventData extends BaseEventData {
  taker: string;
  maker: string;
  amountFormatted: string;
  fiatAmountFormatted: string;
  currency: string;
  payoutReference: string;
}

interface InstantPaymentPayoutResultEventData extends BaseEventData {
  taker: string;
  maker: string;
  amountFormatted: string;
  fiatAmountFormatted: string;
  currency: string;
  payoutReference: string;
  success: boolean;
  message?: string;
}


type EventData = 
  | BuyOrderCreatedEventData
  | BuyOrderCancelledEventData
  | BuyOrderReducedEventData
  | PriceUpdatedEventData
  | ReservationCancelledEventData
  | InstantPaymentReservedEventData
  | InstantPaymentPayoutResultEventData;


type UserRole = 'buyer' | 'seller' | 'taker' | 'maker' | 'user';


type EventType = 
  | 'BuyOrderCreatedEvent'
  | 'BuyOrderCancelledEvent'
  | 'BuyOrderReducedEvent'
  | 'PriceUpdatedEvent'
  | 'ReservationCancelledEvent'
  | 'InstantPaymentReservedEvent'
  | 'InstantPaymentPayoutResultEvent';


interface Colors {
  readonly SUCCESS: number;
  readonly WARNING: number;
  readonly ERROR: number;
  readonly INFO: number;
  readonly NEUTRAL: number;
  readonly PURPLE: number;
}

/**
 * Creates role-specific Discord embeds for different Swift Pay events
 */
export class RoleSpecificEmbeds {
  private readonly colors: Colors = {
    SUCCESS: 0x00ff00,
    WARNING: 0xffaa00,
    ERROR: 0xff0000,
    INFO: 0x0099ff,
    NEUTRAL: 0x808080,
    PURPLE: 0x9932cc,
  };

  /**
   * Create an embed for a specific event type and user role
   */
  createEmbed(eventType: EventType, eventData: EventData, userRole: UserRole): EmbedBuilder {
    switch (eventType) {
      case "BuyOrderCreatedEvent":
        return this.createBuyOrderEmbed(eventData as BuyOrderCreatedEventData, userRole);

      case "BuyOrderCancelledEvent":
        return this.createBuyOrderCancelledEmbed(eventData as BuyOrderCancelledEventData, userRole);

      case "BuyOrderReducedEvent":
        return this.createBuyOrderReduceEmbed(eventData as BuyOrderReducedEventData, userRole);

      case "PriceUpdatedEvent":
        return this.createPriceUpdatedEmbed(eventData as PriceUpdatedEventData, userRole);

      case "ReservationCancelledEvent":
        return this.createCancellationEmbed(eventData as ReservationCancelledEventData, userRole);

      case "InstantPaymentReservedEvent":
        return this.createInstantPaymentReservedEmbed(eventData as InstantPaymentReservedEventData, userRole);

      case "InstantPaymentPayoutResultEvent":
        return this.createInstantPaymentPayoutResultEmbed(eventData as InstantPaymentPayoutResultEventData, userRole);

      default:
        return this.createGenericEmbed(eventType, eventData, userRole);
    }
  }

  /**
   * Buy Order Created - Role-specific messages
   */
  private createBuyOrderEmbed(data: BuyOrderCreatedEventData, role: UserRole): EmbedBuilder {
    if (role === "buyer") {
      return new EmbedBuilder()
        .setTitle("🛒 Your Buy Order is Active!")
        .setColor(this.colors.SUCCESS)
        .setDescription(
          "Your buy order is now live. Sellers can now reserve tokens for you."
        )
        .addFields(
          {
            name: "🎯 Buying",
            value: `${data.amountFormatted} tokens`,
            inline: true,
          },
          {
            name: "💵 At price of",
            value: `${data.pricePerToken} ${data.currency} per token`,
            inline: true,
          },
          {
            name: "🏪 Vault Address",
            value: `\`${data.swiftPay || 'N/A'}\``,
            inline: false,
          },
          {
            name: "📋 Next Steps",
            value:
              "Wait for sellers to reserve tokens for you. You'll be notified when someone accepts your order.",
            inline: false,
          }
        )
        .setTimestamp()
        .setFooter({ text: "Swift Pay Notification" });
    }

    return new EmbedBuilder()
      .setTitle("🛒 New Buy Order Available")
      .setColor(this.colors.INFO)
      .addFields(
        { name: "Buyer", value: `\`${data.buyer}\``, inline: true },
        {
          name: "Amount",
          value: `${data.amountFormatted} tokens`,
          inline: true,
        },
        {
          name: "Price",
          value: `${data.pricePerToken} ${data.currency}`,
          inline: true,
        }
      )
      .setTimestamp()
      .setFooter({ text: "Swift Pay Notification" });
  }

  /**
   * Buy Order Reduce - Role-specific messages
   */
  private createBuyOrderReduceEmbed(data: BuyOrderReducedEventData, role: UserRole): EmbedBuilder {
    if (role === "buyer") {
      return new EmbedBuilder()
        .setTitle("💰 Buy order reduced")
        .setColor(this.colors.PURPLE)
        .setDescription("Your buy order has been reduced.")
        .addFields(
          {
            name: "🪙 Original amount",
            value: `${data.originalAmount} tokens`,
            inline: true,
          },
          {
            name: "💸 New amount",
            value: `${data.newAmount} tokens`,
            inline: true,
          }
        )
        .setTimestamp()
        .setFooter({ text: "Swift Pay Notification" });
    }

    return this.createGenericEmbed("BuyOrderReducedEvent", data, role);
  }

  /**
   * Buy Order cancelled - Role-specific messages
   */
  private createBuyOrderCancelledEmbed(data: BuyOrderCancelledEventData, role: UserRole): EmbedBuilder {
    if (role === "buyer") {
      return new EmbedBuilder()
        .setTitle("💰 Buy order cancelled")
        .setColor(this.colors.PURPLE)
        .setDescription("You have cancelled your buy order.")
        .addFields()
        .setTimestamp()
        .setFooter({ text: "Swift Pay Notification" });
    }

    return this.createGenericEmbed("BuyOrderCancelledEvent", data, role);
  }

  /**
   * Price Updated - Role-specific messages
   */
  private createPriceUpdatedEmbed(data: PriceUpdatedEventData, role: UserRole): EmbedBuilder {
    if (role === "seller") {
      return new EmbedBuilder()
        .setTitle("💰 Price changed")
        .setColor(this.colors.PURPLE)
        .setDescription("You have changed the price.")
        .addFields(
          {
            name: "💵 New Price",
            value: `${data.newPrice} ${data.currency}`,
            inline: true,
          },
          ...(data.oldPrice ? [{
            name: "📊 Previous Price",
            value: `${data.oldPrice} ${data.currency}`,
            inline: true,
          }] : [])
        )
        .setTimestamp()
        .setFooter({ text: "Swift Pay Notification" });
    }

    return this.createGenericEmbed("PriceUpdatedEvent", data, role);
  }

  /**
   * Reservation Cancelled - Role-specific messages
   */
  private createCancellationEmbed(data: ReservationCancelledEventData, role: UserRole): EmbedBuilder {
    if (role === "seller") {
      return new EmbedBuilder()
        .setTitle("❌ Reservation Cancelled")
        .setColor(this.colors.WARNING)
        .setDescription("A buyer has cancelled their token reservation.")
        .addFields({
          name: "📋 Status",
          value: "These tokens are now available for other buyers to reserve.",
          inline: false,
        })
        .setTimestamp()
        .setFooter({ text: "Swift Pay Notification" });
    } else if (role === "buyer") {
      return new EmbedBuilder()
        .setTitle("❌ Reservation Cancelled")
        .setColor(this.colors.INFO)
        .setDescription(
          "You have successfully cancelled your token reservation."
        )
        .addFields(
          { name: "👤 Seller", value: `\`${data.seller}\``, inline: true },
          {
            name: "🪙 Cancelled Amount",
            value: `${data.amountFormatted} tokens`,
            inline: true,
          },
          {
            name: "📋 Status",
            value:
              "Your reservation has been cancelled. No payment is required.",
            inline: false,
          }
        )
        .setTimestamp()
        .setFooter({ text: "Swift Pay Notification" });
    }

    return this.createGenericEmbed("ReservationCancelledEvent", data, role);
  }

  /**
   * Instant Payment Reserved - Role-specific messages
   */
  private createInstantPaymentReservedEmbed(data: InstantPaymentReservedEventData, role: UserRole): EmbedBuilder {
    if (role === "taker" || role === "user") {
      return new EmbedBuilder()
        .setTitle("⚡ Instant Payment Initiated!")
        .setColor(this.colors.INFO)
        .setDescription(
          "Your instant payment request has been processed. Payout is being initiated."
        )
        .addFields(
          {
            name: "💰 Token Amount",
            value: `${data.amountFormatted} tokens`,
            inline: true,
          },
          {
            name: "💵 Fiat Amount",
            value: `${data.fiatAmountFormatted} ${data.currency}`,
            inline: true,
          },
          {
            name: "📖 Reference",
            value: `\`${data.payoutReference}\``,
            inline: true,
          },
          {
            name: "📋 Status",
            value:
              "Processing payout to your account. You'll be notified once complete.",
            inline: false,
          }
        )
        .setTimestamp()
        .setFooter({ text: "Swift Pay Instant Payment" });
    } else if (role === "maker") {
      return new EmbedBuilder()
        .setTitle("⚡ Instant Payment Request Received")
        .setColor(this.colors.WARNING)
        .setDescription(
          "A user has initiated an instant payment through your liquidity pool."
        )
        .addFields(
          {
            name: "👤 User",
            value: `\`${data.taker}\``,
            inline: true,
          },
          {
            name: "💰 Token Amount",
            value: `${data.amountFormatted} tokens`,
            inline: true,
          },
          {
            name: "💵 Payout Amount",
            value: `${data.fiatAmountFormatted} ${data.currency}`,
            inline: true,
          },
          {
            name: "📖 Reference",
            value: `\`${data.payoutReference}\``,
            inline: true,
          },
          {
            name: "📋 Status",
            value: "Payout is being processed through your payment service.",
            inline: false,
          }
        )
        .setTimestamp()
        .setFooter({ text: "Swift Pay Liquidity Provider" });
    }

    return this.createGenericEmbed("InstantPaymentReservedEvent", data, role);
  }

  /**
   * Instant Payment Payout Result - Role-specific messages
   */
  private createInstantPaymentPayoutResultEmbed(data: InstantPaymentPayoutResultEventData, role: UserRole): EmbedBuilder {
    if (role === "taker" || role === "user") {
      if (data.success) {
        return new EmbedBuilder()
          .setTitle("🎉 Instant Payment Completed!")
          .setColor(this.colors.SUCCESS)
          .setDescription(
            "Your instant payment has been successfully processed and sent to your account."
          )
          .addFields(
            {
              name: "💰 Token Amount",
              value: `${data.amountFormatted} tokens`,
              inline: true,
            },
            {
              name: "💵 Amount Received",
              value: `${data.fiatAmountFormatted} ${data.currency}`,
              inline: true,
            },
            {
              name: "📖 Reference",
              value: `\`${data.payoutReference}\``,
              inline: true,
            },
            {
              name: "✅ Status",
              value: "Payment completed successfully! Check your account.",
              inline: false,
            }
          )
          .setTimestamp()
          .setFooter({ text: "Swift Pay Instant Payment" });
      } else {
        return new EmbedBuilder()
          .setTitle("❌ Instant Payment Failed")
          .setColor(this.colors.ERROR)
          .setDescription(
            "Your instant payment could not be processed. Tokens have been refunded."
          )
          .addFields(
            {
              name: "💰 Refunded Amount",
              value: `${data.amountFormatted} tokens`,
              inline: true,
            },
            {
              name: "📖 Reference",
              value: `\`${data.payoutReference}\``,
              inline: true,
            },
            {
              name: "❌ Error",
              value: String(data.message || "Payout failed"),
              inline: false,
            },
            {
              name: "📋 Next Steps",
              value:
                "Your tokens have been returned to your wallet. You can try again or contact support.",
              inline: false,
            }
          )
          .setTimestamp()
          .setFooter({ text: "Swift Pay Instant Payment" });
      }
    } else if (role === "maker") {
      if (data.success) {
        return new EmbedBuilder()
          .setTitle("✅ Instant Payment Processed")
          .setColor(this.colors.SUCCESS)
          .setDescription(
            "An instant payment through your liquidity pool was successfully processed."
          )
          .addFields(
            {
              name: "👤 User",
              value: `\`${data.taker}\``,
              inline: true,
            },
            {
              name: "💰 Token Amount",
              value: `${data.amountFormatted} tokens`,
              inline: true,
            },
            {
              name: "💵 Payout Amount",
              value: `${data.fiatAmountFormatted} ${data.currency}`,
              inline: true,
            },
            {
              name: "📖 Reference",
              value: `\`${data.payoutReference}\``,
              inline: true,
            }
          )
          .setTimestamp()
          .setFooter({ text: "Swift Pay Liquidity Provider" });
      } else {
        return new EmbedBuilder()
          .setTitle("❌ Instant Payment Failed")
          .setColor(this.colors.ERROR)
          .setDescription(
            "An instant payment through your liquidity pool failed. User has been refunded."
          )
          .addFields(
            {
              name: "👤 User",
              value: `\`${data.taker}\``,
              inline: true,
            },
            {
              name: "📖 Reference",
              value: `\`${data.payoutReference}\``,
              inline: true,
            },
            {
              name: "❌ Error",
              value: String(data.message || "Payout failed"),
              inline: false,
            }
          )
          .setTimestamp()
          .setFooter({ text: "Swift Pay Liquidity Provider" });
      }
    }

    return this.createGenericEmbed("InstantPaymentPayoutResultEvent", data, role);
  }

  /**
   * Helper function to safely convert data values to strings for embeds
   */
  private formatEmbedValue(value: unknown): string {
    if (value === null || value === undefined) {
      return "N/A";
    }
    if (typeof value === "boolean") {
      return value ? "✅ Success" : "❌ Failed";
    }
    if (typeof value === "object") {
      return JSON.stringify(value);
    }
    return String(value);
  }

  /**
   * Create a generic embed for unhandled event types
   */
  private createGenericEmbed(eventType: EventType, data: EventData, role: UserRole): EmbedBuilder {
    const embed = new EmbedBuilder()
      .setTitle(`${eventType} - ${role}`)
      .setColor(this.colors.INFO)
      .setTimestamp();

    
    const fields = [];
    for (const [key, value] of Object.entries(data)) {
      if (key !== "success" || typeof value !== "boolean") {
        fields.push({
          name: key.charAt(0).toUpperCase() + key.slice(1),
          value: this.formatEmbedValue(value),
          inline: true,
        });
      } else {
        
        fields.push({
          name: "Status",
          value: this.formatEmbedValue(value),
          inline: true,
        });
      }
    }

    if (fields.length > 0) {
      embed.addFields(fields);
    }

    return embed;
  }

  /**
   * Helper method to get user wallet address from role
   */
  getUserWalletFromRole(data: EventData, role: UserRole): string | null {
    switch (role) {
      case "seller":
        return ('maker' in data && data.maker) || ('seller' in data && data.seller) || null;
      case "buyer":
        return ('taker' in data && data.taker) || ('buyer' in data && data.buyer) || null;
      case "taker":
        return ('taker' in data && data.taker) || null;
      case "maker":
        return ('maker' in data && data.maker) || null;
      default:
        return null;
    }
  }

  /**
   * Create a test notification embed
   */
  createTestEmbed(): EmbedBuilder {
    return new EmbedBuilder()
      .setTitle("🤖 Bot Started Successfully")
      .setColor(this.colors.SUCCESS)
      .setDescription(
        "The Swift Pay Discord bot is now monitoring blockchain events."
      )
      .addFields(
        { name: "✅ Status", value: "Online and monitoring", inline: true },
        {
          name: "🔔 Notifications",
          value: "You will receive real-time updates",
          inline: true,
        },
        {
          name: "📋 Coverage",
          value: "All Swift Pay events are monitored",
          inline: false,
        }
      )
      .setTimestamp()
      .setFooter({ text: "Swift Pay Notification System" });
  }
}


export type {
  BaseEventData,
  BuyOrderCreatedEventData,
  BuyOrderCancelledEventData,
  BuyOrderReducedEventData,
  PriceUpdatedEventData,
  ReservationCancelledEventData,
  InstantPaymentReservedEventData,
  InstantPaymentPayoutResultEventData,
  EventData,
  UserRole,
  EventType,
  Colors
};