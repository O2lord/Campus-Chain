"use client";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu"; 

export default function ConnectWalletButton() {
    const { publicKey, connected, disconnect,  wallet } = useWallet();
  const { setVisible } = useWalletModal();

 const handleConnect = async () => {
  console.log('Connect button clicked');
  console.log('No wallet selected, opening modal');
  setVisible(true);
};

  const handleChangeWallet = () => {
  console.log('Change wallet clicked');
  setVisible(true);
};

  const shortKey =
    publicKey?.toBase58().slice(0, 4) +
    "..." +
    publicKey?.toBase58().slice(-4);

    console.log('Wallet state:', { connected, publicKey: publicKey?.toString(), wallet: wallet?.adapter.name });
  return connected ? (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="gradient">{shortKey}</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem
          onClick={() =>
            navigator.clipboard.writeText(publicKey!.toBase58())
          }
        >
          Copy Address
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleChangeWallet}>
          Change Wallet
        </DropdownMenuItem>
        <DropdownMenuItem onClick={disconnect}>
          Disconnect
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ) : (
    <Button variant="gradient" onClick={handleConnect}>
      Connect Wallet
    </Button>
  );
}