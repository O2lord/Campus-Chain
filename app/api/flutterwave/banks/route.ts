import { NextRequest, NextResponse } from "next/server";
import FlutterwaveService from "@/bot/services/flutterwaveService"; 

export async function GET(request: NextRequest) {
  try {
    
    const { searchParams } = new URL(request.url);
    const country = searchParams.get('country') || 'NG';

    
    const validCountries = ['NG', 'GH', 'KE', 'UG', 'TZ', 'ZA'];
    if (!validCountries.includes(country.toUpperCase())) {
      return NextResponse.json(
        { error: "Invalid country code. Supported: " + validCountries.join(', ') },
        { status: 400 }
      );
    }

    
    const flutterwaveService = new FlutterwaveService();
    
    
    const banks = await flutterwaveService.getBanks(country.toUpperCase());

    const processedBanks = banks.map(bank => ({
  ...bank,
  code: bank.code.toString() 
}));

    
    return NextResponse.json({
      success: true,
      country: country.toUpperCase(),
      banks: processedBanks,
    });

  } catch (error) {
    console.error("Error fetching banks:", error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: "Failed to fetch banks. Please try again later." 
      },
      { status: 500 }
    );
  }
}