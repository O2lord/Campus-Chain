import * as React from "react";
import { cn } from "@/lib/utils";
import TokenDisplay from "@/components/TokenDisplay";
import { useTokenMetadata} from "@/hooks/useTokenMetadata";

export interface TokenInfo {
  mint: string;
  balance: number;
  tokenMetadata?: {
    logoURI?: string;
    symbol?: string;
  }
}

export interface TokenSelectProps {
  tokens: TokenInfo[];
  onTokenChange: (token: TokenInfo | null) => void; // Passes the full token object
  onMaxClick: (balance: number) => void;
  onHalfClick: (balance: number) => void;
  className?: string;
  ringColorClass?: string;
}

const TokenSelect: React.FC<TokenSelectProps> = ({tokens,onTokenChange,onMaxClick, onHalfClick,className, ringColorClass}) => {
  const [selectedToken, setSelectedToken] = React.useState<TokenInfo | null>(
    null
  );
  const  tokenMetadata  = useTokenMetadata(selectedToken?.mint || "");

  const handleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedMint = event.target.value;
    const token = tokens.find((t) => t.mint === selectedMint) || null;
    setSelectedToken(token);
    onTokenChange(token);
  };

  return (
    <div>
       {selectedToken && (
      <div className="absolute right-7 top-2 flex items-center space-x-2">
        <TokenDisplay
            logoURI={tokenMetadata?.metadata?.logoURI}
            amount={(selectedToken.balance).toFixed(2)}
            symbol={tokenMetadata?.metadata?.symbol}
            
          />
        <button type="button" className="px-2 py-1 text-xs text-white bg-gray-900 rounded"
        onClick={() => onMaxClick(parseFloat(Number(selectedToken.balance).toFixed(2)))}>Max</button>
       
        <button type="button"  className="px-2 py-1 text-xs text-white bg-gray-900 rounded"
        onClick={()=> onHalfClick(parseFloat(Number(selectedToken.balance).toFixed(2)))}>Half </button>
      </div>
    )}
    
    <select
      className={cn(
                "relative rounded-lg border border-gray-600 p-3 bg-gray-700 focus-within:border-blue-500",
        ringColorClass, className
      )}
      value={selectedToken?.mint || ""}
      onChange={handleChange}
    >
      <option value="" disabled className="bg-gray-800 text-gray-400">
        Select a token
      </option>
      {tokens.map((token, index) => (
        <option 
        key={index} 
        value={token.mint}
        className="bg-gray-800 text-white hover:bg-gray-700"
        >
          {token.mint.slice(0, 4)}
        </option>
      ))}
    </select>
    </div>
  );
};

TokenSelect.displayName = "TokenSelect";

export { TokenSelect };