"use client";
import useSwiftPay from "@/hooks/swift-pay/useSwiftPay";
import React, { forwardRef, useMemo, useImperativeHandle } from "react";
import BuyOrderCard from "./BuyOrderCard";
import SkeletonWapper from "@/components/SkeletonWapper";
import { useWallet } from "@solana/wallet-adapter-react";
import { SortOrder, TokenFilter, CurrencyFilter } from "@/components/swift-pay/Filter";

export interface SwiftPayGridRef {
  refresh: () => void;
}

interface SwiftPayGridProps {
  filterByCurrentUser?: boolean;
  tokenFilter?: TokenFilter;
  currencyFilter?: CurrencyFilter;
  sortOrder?: SortOrder;
  title?: string;
}

const SwiftPayGrid = forwardRef<SwiftPayGridRef, SwiftPayGridProps>(
  ({ 
    filterByCurrentUser = false, 
    tokenFilter = null,
    currencyFilter = null,
    sortOrder = null,
    title
  }, ref) => {
    const { getSwiftPayAccounts } = useSwiftPay();
    const { publicKey } = useWallet();

    // Expose refresh method to parent component
    useImperativeHandle(ref, () => ({
      refresh: () => {
        // Refetch the data
        getSwiftPayAccounts.refetch();
      }
    }), [getSwiftPayAccounts]);
    
    
    const filteredSwiftPays = useMemo(() => {
      const swiftPaysData = getSwiftPayAccounts.data || [];
      
      if (filterByCurrentUser && (!publicKey)) {
        return [];
      }

      let filtered = filterByCurrentUser && publicKey
        ? swiftPaysData.filter(swiftPay => 
            swiftPay.account.maker.toString() === publicKey.toString())
        : swiftPaysData;

      if (tokenFilter) {
        filtered = filtered.filter(swiftPay => 
          swiftPay.account.mint && swiftPay.account.mint.toString() === tokenFilter
        );
      }
 
      if (currencyFilter) {
        filtered = filtered.filter(swiftPay => {
         
          const currencyStr = String.fromCharCode(...swiftPay.account.currency).trim();
          return currencyStr === currencyFilter;
        });
      }

      if (sortOrder) {
        filtered = [...filtered].sort((a, b) => {
          const priceA = Number(a.account.pricePerToken);
          const priceB = Number(b.account.pricePerToken);
          
          return sortOrder === 'asc' ? priceA - priceB : priceB - priceA;
        });
      }
      
      return filtered;
    }, [
      getSwiftPayAccounts.data, 
      filterByCurrentUser, 
      publicKey, 
      tokenFilter, 
      currencyFilter, 
      sortOrder
    ]);

    if (getSwiftPayAccounts.isError) {
      return (
        <div className="text-center my-10">
          <h2 className="text-2xl font-semibold text-red-500">Error loading swiftPays</h2>
          <p className="mt-2 text-gray-600">There was an error loading the swiftPay data.</p>
        </div>
      );
    }

    const displayTitle = title || (filterByCurrentUser ? "Your Buy Orders" : "Buy Order");

    if (filteredSwiftPays.length === 0) {
      return (
        <div className="flex flex-col">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-semibold">{displayTitle}</h2>
          </div>
          <div className="text-center my-10">
            <h2 className="text-2xl font-semibold">No buy orders found</h2>
            <p className="mt-2 text-gray-600">
              {filterByCurrentUser 
                ? "You haven't created any buy orders matching these filters." 
                : "No buy orders match the selected filters."}
            </p>
          </div>
        </div>
      );
    }
    
    return (
      <SkeletonWapper isLoading={getSwiftPayAccounts.isLoading}>
        <div className="flex flex-col">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl text-white font-semibold">{displayTitle}</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredSwiftPays.map((swiftPay) => (
              <BuyOrderCard key={swiftPay.publicKey.toString()} data={swiftPay} />
            ))}
          </div>
        </div>
      </SkeletonWapper>
    );
  }
);

SwiftPayGrid.displayName = "SwiftPayGrid";

export default SwiftPayGrid;