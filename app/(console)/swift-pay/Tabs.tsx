"use client";
import React from "react";
import { DollarSign, RefreshCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import UnifiedFilter, { ExpressFilterState } from "@/components/swift-pay/Filter";
import SwiftPayGrid from "@/components/swift-pay/ExpressBuyGrid";
import { SwiftPayGridRef } from "@/components/swift-pay/ExpressBuyGrid";
import { toast } from "sonner";


interface ExpressTabsProps {
  tokens: { value: string; label: string }[];
  currencies: { value: string; label: string }[];
  onFilterChange: (filters: ExpressFilterState) => void;
  expressGridRef: React.RefObject<SwiftPayGridRef | null>;
  filters: ExpressFilterState;
}

const ExpressTabs: React.FC<ExpressTabsProps> = ({
  tokens,
  currencies,
  onFilterChange,
  expressGridRef,
  filters
}) => {
  const [isRefreshing, setIsRefreshing] = React.useState(false);

  
  const handleRefresh = async () => {
    if (isRefreshing) return;
    
    setIsRefreshing(true);
    
    await new Promise(resolve => setTimeout(resolve, 300));
    
    try {
      if (expressGridRef.current) {
        expressGridRef.current.refresh();
      }
      
      
      await new Promise(resolve => setTimeout(resolve, 500));
      toast.success("Data refreshed successfully");
    } catch (error) {
      console.error("Error refreshing data:", error);
      toast.error("Failed to refresh data");
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className="w-full mx-auto">
      {/* Header Section - No tabs, just sell section */}
      <div className="relative mb-8">
        {/* Background glow */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-gray-700/20 to-transparent h-px top-12" />
        
        <div className="flex relative justify-between items-center">
          {/* Left side - Title section */}
          <div className="flex items-center space-x-3">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-orange-500 to-red-600 rounded-lg blur-sm opacity-30" />
              <div className="relative bg-gradient-to-r from-orange-500 to-red-600 p-2 rounded-lg">
                <DollarSign className="w-4 h-4 text-white" />
              </div>
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">Sell Digital Assets</h3>
              <p className="text-sm text-gray-400 font-medium">Exchange your USDT/USDC for local currency</p>
            </div>
          </div>

          {/* Right side - Filter */}
          <div className="transition-all duration-300">
            <UnifiedFilter
              tokens={tokens}
              currencies={currencies}
              onFilterChange={onFilterChange}
              initialFilters={filters}
            />
          </div>
        </div>
      </div>

      {/* Refresh button section */}
      <div className="transition-all duration-300 mb-6">
        <div className="flex justify-end items-center">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleRefresh}
            disabled={isRefreshing}
            className={cn(
              "transition-all duration-300 transform hover:scale-105",
              isRefreshing && "scale-95 opacity-80"
            )}
          >
            <RefreshCcw className={cn(
              "mr-2 h-4 w-4 transition-all duration-300",
              isRefreshing ? 'animate-spin text-blue-500' : 'hover:rotate-180'
            )} />
            <span className="transition-all duration-300">
              {isRefreshing ? 'Refreshing...' : 'Refresh'}
            </span>
          </Button>
        </div>
      </div>
      
      {/* Content area with smooth transitions and refresh animation */}
      <div className={cn(
        "transition-all duration-500 transform",
        isRefreshing ? "opacity-70 scale-[0.98]" : "opacity-100 scale-100"
      )}>
        <div className="space-y-6">
          <div className="relative">
            <SwiftPayGrid
              ref={expressGridRef}
              tokenFilter={filters.token}
              currencyFilter={filters.currency}
              sortOrder={filters.sort}
              title=""
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExpressTabs;