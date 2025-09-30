import React from "react";
import { NAVBAR_ITEMS } from "@/lib/constants";
import Logo from "../Logo";
import EndNavbarSection from "./EndNavbarSection";
import NavbarItem from "./NavbarItem";

const DesktopNavbar = ({}) => {
  return (
    <div className="hidden border-separate border-b bg-background md:block">
      <nav className="container mx-auto flex items-center justify-between px-8">
        <div className="flex h-[64px] min-h-[60px] items-center gap-x-4">
          <Logo />
          <div className="flex h-full gap-x-4">
            {NAVBAR_ITEMS.map((item) => (
              <NavbarItem key={item.label} item={item} />
            ))}
          </div>
        </div>
        <EndNavbarSection />
      </nav>
    </div>
  );
};

export default DesktopNavbar;
