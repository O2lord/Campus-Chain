"use client";
import React from "react";
import { ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import CreateExpressBuyDialog from "./CreateExpressBuyDialog";

type Props = {
  className?: string;
};

const MakeNewTrustVaultButton: React.FC<Props> = ({}) => {
  return (
      <CreateExpressBuyDialog 
      trigger={
      <Button
      className="bg-green-700"
      >
        <div className="relative flex items-center space-x-2">
        <div className="relative">
           <div className="relative bg-gradient-to-r from-green-400 to-emerald-300 p-1.5 rounded-md">
              <ShoppingCart className="w-4 h-4 " />
            </div>
        </div>
        <span>
        Create Buy Order
        </span>
        </div>
      </Button>
      } 
    />
  );
};

export default MakeNewTrustVaultButton;
