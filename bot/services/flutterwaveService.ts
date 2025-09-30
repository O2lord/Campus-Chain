import axios, { AxiosInstance, AxiosError } from "axios";
import dotenv from "dotenv";
dotenv.config();

interface PayoutDetails {
  type?: 'bank_transfer' | 'mobile_money' | 'flutterwave_wallet';
  bank_code?: string;
  account_bank?: string;
  account_number: string;
  account_name?: string;
  beneficiary_name?: string;
  phone_number?: string;
  network?: string;
  narration?: string;
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
  meta?: unknown;
  narration: string;
  complete_message: string;
  requires_approval: number;
  is_approved: number;
  bank_name: string;
}

interface FlutterwaveErrorData {
  message: string;
  code?: string;
  data?: unknown;
}

interface PayoutResponse {
  success: boolean;
  data?: FlutterwaveTransferData;
  reference: string;
  flw_ref?: string;
  error?: string;
}

interface PayoutStatusResponse {
  success: boolean;
  status?: string;
  data?: FlutterwaveTransferData;
  error?: string;
}

interface BankInfo {
  id: number;
  code: string;
  name: string;
}

interface AccountVerificationDetails {
  account_number: string;
  account_bank: string;
}

interface AccountVerificationResponse {
  success: boolean;
  accountName?: string;
  accountNumber?: string;
  error?: string;
}

interface CurrencyInfo {
  name: string;
  min_amount: number;
  max_amount: number;
}

interface SupportedCurrencies {
  [key: string]: CurrencyInfo;
}

interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

class FlutterwaveService {
  private baseURL: string;
  private secretKey: string;
  private client: AxiosInstance;

  constructor() {
    this.baseURL = "https://api.flutterwave.com/v3";
    this.secretKey = process.env.FLUTTERWAVE_SECRET_KEY as string;

    if (!this.secretKey) {
      throw new Error(
        "FLUTTERWAVE_SECRET_KEY environment variable is required"
      );
    }

    
    this.client = axios.create({
      baseURL: this.baseURL,
      headers: {
        Authorization: `Bearer ${this.secretKey}`,
        "Content-Type": "application/json",
      },
    });
  }

  /**
   * Initiate a payout through Flutterwave
   */
  async initiatePayout(
    payoutDetails: PayoutDetails | string,
    amount: number,
    currency: string,
    payoutReference: string
  ): Promise<PayoutResponse> {
    try {
      
      const details: PayoutDetails =
        typeof payoutDetails === "string"
          ? JSON.parse(payoutDetails)
          : payoutDetails;

      
      const payoutRequest = this._buildPayoutRequest(
        details,
        amount,
        currency,
        payoutReference
      );

      console.log(
        `Initiating payout: ${payoutReference} - ${amount} ${currency}`
      );

      const response = await this.client.post("/transfers", payoutRequest);

      if (response.data.status === "success") {
        console.log(`Payout initiated successfully: ${payoutReference}`);
        return {
          success: true,
          data: response.data.data,
          reference: payoutReference,
          flw_ref: response.data.data.reference,
        };
      } else {
        console.error(`Payout failed: ${response.data.message}`);
        return {
          success: false,
          error: response.data.message,
          reference: payoutReference,
        };
      }
    } catch (error: unknown) {
      const axiosError = error as AxiosError;
      console.error(
        `Payout error for ${payoutReference}:`,
        axiosError.response?.data || axiosError.message
      );
      return {
        success: false,
        error: this.getErrorMessage(axiosError.response?.data),
        reference: payoutReference,
      };
    }
  }

  /**
   * Check the status of a payout
   */
  async checkPayoutStatus(transferId: string): Promise<PayoutStatusResponse> {
    try {
      const response = await this.client.get(`/transfers/${transferId}`);

      return {
        success: true,
        status: response.data.data.status,
        data: response.data.data,
      };
    } catch (error: unknown) {
      const axiosError = error as AxiosError;
      console.error(
        `Error checking payout status for ${transferId}:`,
        axiosError.response?.data || axiosError.message
      );
      return {
        success: false,
        error: this.getErrorMessage(axiosError.response?.data),
      };
    }
  }

  /**
   * Get available banks for bank transfers
   */
  async getBanks(country: string = "NG"): Promise<BankInfo[]> {
    try {
      const response = await this.client.get(`/banks/${country}`);
      return response.data.data;
    } catch (error: unknown) {
      const axiosError = error as AxiosError;
      console.error(
        `Error fetching banks for ${country}:`,
        axiosError.response?.data || axiosError.message
      );
      return [];
    }
  }

  /**
   * Verify account number and get account name
   */
  async verifyAccount(accountDetails: AccountVerificationDetails): Promise<AccountVerificationResponse> {
    try {
      const response = await this.client.post(
        "/accounts/resolve",
        accountDetails
      );

      if (response.data.status === "success") {
        return {
          success: true,
          accountName: response.data.data.account_name,
          accountNumber: response.data.data.account_number,
        };
      } else {
        return {
          success: false,
          error: response.data.message,
        };
      }
    } catch (error: unknown) {
      const axiosError = error as AxiosError;
      console.error(
        "Account verification error:",
        axiosError.response?.data || axiosError.message
      );
      return {
        success: false,
        error: this.getErrorMessage(axiosError.response?.data),
      };
    }
  }

  /**
   * Build payout request based on payout details type
   */
  private _buildPayoutRequest(
    details: PayoutDetails,
    amount: number,
    currency: string,
    payoutReference: string
  ) {
    const baseRequest = {
      account_bank: details.bank_code || details.account_bank,
      account_number: details.account_number,
      amount: amount,
      narration: details.narration || `Instant payout - ${payoutReference}`,
      currency: currency,
      reference: payoutReference,
      callback_url: process.env.FLUTTERWAVE_CALLBACK_URL,
      debit_currency: currency,
    };

    
    switch (details.type) {
      case "bank_transfer":
        return {
          ...baseRequest,
          beneficiary_name: details.beneficiary_name || details.account_name,
        };

      case "mobile_money":
        return {
          ...baseRequest,
          account_bank: "MPS", 
          account_number: details.phone_number,
          beneficiary_name: details.beneficiary_name,
          mobile_money: {
            phone: details.phone_number,
            network: details.network, 
          },
        };

      case "flutterwave_wallet":
        return {
          ...baseRequest,
          account_bank: "barter",
          beneficiary_name: details.beneficiary_name,
        };

      default:
        
        return {
          ...baseRequest,
          beneficiary_name: details.beneficiary_name || details.account_name,
        };
    }
  }

  /**
   * Get supported currencies and their limits
   */
  getSupportedCurrencies(): SupportedCurrencies {
    return {
      NGN: {
        name: "Nigerian Naira",
        min_amount: 10,
        max_amount: 50000000,
      },
      GHS: {
        name: "Ghanaian Cedi",
        min_amount: 1,
        max_amount: 500000,
      },
      KES: {
        name: "Kenyan Shilling",
        min_amount: 10,
        max_amount: 1000000,
      },
      UGX: {
        name: "Ugandan Shilling",
        min_amount: 100,
        max_amount: 50000000,
      },
      TZS: {
        name: "Tanzanian Shilling",
        min_amount: 100,
        max_amount: 5000000,
      },
      USD: {
        name: "US Dollar",
        min_amount: 1,
        max_amount: 20000,
      },
      EUR: {
        name: "Euro",
        min_amount: 1,
        max_amount: 20000,
      },
      GBP: {
        name: "British Pound",
        min_amount: 1,
        max_amount: 20000,
      },
    };
  }

  /**
   * Validate payout details before processing
   */
  validatePayoutDetails(
    details: PayoutDetails,
    amount: number,
    currency: string
  ): ValidationResult {
    const errors: string[] = [];
    const supportedCurrencies = this.getSupportedCurrencies();

    if (!supportedCurrencies[currency]) {
      errors.push(`Unsupported currency: ${currency}`);
    } else {
      const currencyInfo = supportedCurrencies[currency];
      if (amount < currencyInfo.min_amount) {
        errors.push(
          `Amount too low. Minimum: ${currencyInfo.min_amount} ${currency}`
        );
      }
      if (amount > currencyInfo.max_amount) {
        errors.push(
          `Amount too high. Maximum: ${currencyInfo.max_amount} ${currency}`
        );
      }
    }

    
    if (!details.account_number) {
      errors.push("Account number is required");
    }

    if (!details.bank_code && !details.account_bank) {
      errors.push("Bank code is required");
    }

    if (!details.beneficiary_name && !details.account_name) {
      errors.push("Beneficiary name is required");
    }

    
    if (details.type === "mobile_money") {
      if (!details.phone_number) {
        errors.push("Phone number is required for mobile money");
      }
      if (!details.network) {
        errors.push("Mobile network is required for mobile money");
      }
    }

    return {
      isValid: errors.length === 0,
      errors: errors,
    };
  }

  /**
   * Helper method to extract error message from API response
   */
  private getErrorMessage(responseData: unknown): string {
    if (responseData && typeof responseData === 'object') {
      const errorData = responseData as FlutterwaveErrorData;
      return errorData.message || 'Unknown API error';
    }
    return 'Network or unknown error occurred';
  }
}

export default FlutterwaveService;