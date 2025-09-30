"use client";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { NAVBAR_ITEMS } from "@/lib/constants";
import { Menu } from "lucide-react";
import React, { useState } from "react";

import EndNavbarSection from "./EndNavbarSection";
import Logo from "../Logo";
import NavbarItem from "./NavbarItem";

const MobileNavbar = ({}) => {
  const [isOpened, setIsOpened] = useState(false);
  return (
    <div className="block border-separate bg-background md:hidden">
      <nav className="container flex items-center justify-between px-8 border-separate border-b">
        <Sheet open={isOpened} onOpenChange={setIsOpened}>
          <SheetTrigger asChild>
            <Button variant={"ghost"} size={"icon"}>
              <Menu />
            </Button>
          </SheetTrigger>
          <SheetContent
            className="w-[400px] sm:w-[540px]"
            side={"left"}
            aria-describedby=""
          >
            <SheetTitle></SheetTitle>
            <Logo />
            <div className="flex flex-col gap-1 pt-4">
              {NAVBAR_ITEMS.map((item) => (
                <NavbarItem
                  key={item.label}
                  item={item}
                  onClick={() => setIsOpened((prev) => !prev)}
                />
              ))}
            </div>
          </SheetContent>
        </Sheet>
        <div className="flex h-[64px] min-h-[60px] items-center gap-x-4">
          <Logo isMobile />
        </div>
        <EndNavbarSection />
      </nav>
    </div>
  );
};

export default MobileNavbar;
