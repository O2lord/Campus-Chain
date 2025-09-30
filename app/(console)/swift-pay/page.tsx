"use client";
import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import ExpressTabs from "./Tabs";
import { Zap } from "lucide-react";
import { ExpressFilterState } from "@/components/swift-pay/Filter";
import { Separator } from "@/components/ui/separator";
import { SwiftPayGridRef } from "@/components/swift-pay/ExpressBuyGrid";
import useSwiftPay from "@/hooks/swift-pay/useSwiftPay";
import CreateBuyButton from "@/components/swift-pay/CreateBuyButton";
import InstantPayButton from "@/components/swift-pay/InstantPayButton";
import ConnectButton from "@/components/discord/ConnectButton"

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
interface SwiftPayPageProps {}

const SwiftPayPage: React.FC<SwiftPayPageProps> = () => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, 100);
    
    return () => clearTimeout(timer);
  }, []);

  const [filters, setFilters] = useState<ExpressFilterState>({
    token: null,
    currency: null,
    sort: null,
  });

  const expressGridRef = useRef<SwiftPayGridRef>(null);

  const { program } = useSwiftPay();
      
  const { data: swiftPayAccounts } = useQuery({
    queryKey: ["get-swiftPay-accounts"],
    queryFn: async () => {
      if (!program) return [];
      return await program.account.swiftPay.all();
    },
    enabled: !!program,
  });

  // Extract unique tokens and currencies for filter options
  const { tokens, currencies } = useMemo(() => {
    if (!swiftPayAccounts) {
      return { tokens: [], currencies: [] };
    }

    const uniqueTokens = new Set<string>();
    const uniqueCurrencies = new Set<string>();

    swiftPayAccounts.forEach((account) => {
      
      if (account.account.mint) {
        uniqueTokens.add(account.account.mint.toString());
      }
      
      
      if (account.account.currency) {
        try {
          const currencyStr = String.fromCharCode(...account.account.currency).trim();
          if (currencyStr) {
            uniqueCurrencies.add(currencyStr);
          }
        } catch (error) {
          console.warn("Error parsing currency:", error);
        }
      }
    });

    return {
      tokens: Array.from(uniqueTokens).map((token) => ({
        value: token,
        label: token.substring(0, 4) + "..." + token.substring(token.length - 4),
      })),
      currencies: Array.from(uniqueCurrencies).map((currency) => ({
        value: currency,
        label: currency,
      })),
    };
  }, [swiftPayAccounts]);

  
  const handleFilterChange = useCallback((newFilters: ExpressFilterState) => {
    setFilters(newFilters);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-black">
      {/* Animated background overlay */}
      <div className="fixed inset-0 bg-gradient-to-br from-yellow-950/10 via-transparent to-blue-950/10 pointer-events-none" />
      
      <div className="container mx-auto py-10 relative z-10">
        <div className={`space-y-8 transition-all duration-1000 ${isVisible ? 'opacity-100 transform translate-y-0' : 'opacity-0 transform translate-y-10'}`}>
          
          {/* Header Section */}
          <div className="text-center space-y-4 mb-12">
            <div className="inline-flex items-center space-x-2 mb-4">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full blur-lg opacity-50 animate-pulse" />
                <div className="relative bg-gradient-to-r from-yellow-400 to-orange-500 p-3 rounded-full">
                  <Zap className="w-8 h-8 text-white" />
                </div>
              </div>
            </div>
            <h1 className="text-6xl font-bold bg-gradient-to-r from-yellow-400 via-orange-400 to-red-400 bg-clip-text text-transparent tracking-tight">
              Swift Pay
            </h1>
            <p className="text-xl text-gray-300 max-w-3xl mx-auto leading-relaxed">
              Convert your tokens to fiat you can use to make payments, instantly with automated payment processing.
            </p>
          </div>

          {/* Buttons to buy and sell*/}
          <Separator/>
          <div className="flex flex-wrap gap-2 sm:gap-3">
            <CreateBuyButton/>
            <InstantPayButton/>
            <ConnectButton/>
            {/* How It Works */}
            <div className="rounded-xl bg-gradient-to-r from-gray-800 to-gray-850 border border-gray-700 p-6">
              <div className="flex items-center gap-2 mb-6">
                <Zap className="w-5 h-5 text-blue-400" />
                <span className="text-white font-medium text-lg">How It Works</span>
              </div>
              <div className="grid md:grid-cols-3 gap-6">
                <div className="flex items-start gap-3">
                  <div className="bg-blue-500 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold flex-shrink-0">
                    1
                  </div>
                  <div>
                    <div className="text-gray-200 font-medium">Select Currency</div>
                    <div className="text-gray-400 text-sm mt-1">Choose your preferred fiat currency from our supported options ( NGN, KES, GHS)</div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="bg-green-500 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold flex-shrink-0">
                    2
                  </div>
                  <div>
                    <div className="text-gray-200 font-medium">Enter Amount & Details</div>
                    <div className="text-gray-400 text-sm mt-1">Specify the amount you want to send/receive and enter the payout details. Required tokens are calculate automatically, using the exchange rate set by LP.</div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="bg-purple-500 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold flex-shrink-0">
                    3
                  </div>
                  <div>
                    <div className="text-gray-200 font-medium">Get Paid Instantly</div>
                    <div className="text-gray-400 text-sm mt-1">Receive instant payment to your bank account.</div>
                  </div>
                </div>
              </div>
            </div>     
          </div>
          <Separator/>
          {/* Main section */}
          <div>
            <ExpressTabs
              tokens={tokens}
              currencies={currencies}
              onFilterChange={handleFilterChange}
              expressGridRef={expressGridRef}
              filters={filters}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default SwiftPayPage;