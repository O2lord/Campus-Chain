// InstantPayButton.tsx
"use client";
import React from "react";
import { Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import InstantPayDialog from "./InstantPayDialog";

type Props = {
  className?: string;
};

const InstantPayButton: React.FC<Props> = ({ className }) => {
  return (
    <InstantPayDialog 
      trigger={
        <Button 
          variant="default" 
          className={`bg-blue-600 hover:bg-blue-700 text-white transition-all duration-200 ${className}`}
        >
          <div className="relative flex items-center space-x-2">
            <div className="relative">
              <div className="relative bg-gradient-to-r from-blue-400 to-cyan-300 p-1.5 rounded-md group">
                <Zap className="w-4 h-4" />
              </div>
            </div>
            <span>
              Pay
            </span>    
          </div>   
        </Button>
      } 
    />
  );
};

export default InstantPayButton;