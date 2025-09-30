import React from "react";
import ConnectWalletButton from "../ConnectWalletButton";
import ThemeToogle from "../ThemeToogle";

export default function EndNavbarSection() {
  return (
    <div className="flex items-center gap-2">
      <ConnectWalletButton />
      <ThemeToogle />
    </div>
  );
}
