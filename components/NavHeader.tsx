import React from "react";
import { SidebarTrigger } from "./ui/sidebar";
import { Separator } from "./ui/separator";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbPage,
} from "./ui/breadcrumb";
import Link from "next/link";
import { cn } from "@/lib/utils";
import ConnectWalletButton from "./ConnectWalletButton";

type Props = {
  navs: {
    title: string;
    url?: string;
    icon?: React.ElementType;
    isActive?: boolean;
  }[];
};

const NavHeader: React.FC<Props> = ({ navs }) => {
  return (
    <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
      <div className="flex items-center gap-2 px-4 w-full">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mr-2 data-[orientation=vertical]:h-4"
        />
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem className="hidden md:block">
              <BreadcrumbLink asChild>
                <Link href="/">Campus Chain </Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            {navs.map((nav) => (
              <React.Fragment key={nav.title}>
                <BreadcrumbSeparator className="hidden md:block" />
                <BreadcrumbItem>
                  {nav.url ? (
                    <BreadcrumbLink asChild>
                      <Link href={nav.url}>{nav.title}</Link>
                    </BreadcrumbLink>
                  ) : (
                    <BreadcrumbPage
                      className={cn(nav.isActive && "font-semibold")}
                    >
                      {nav.title}
                    </BreadcrumbPage>
                  )}
                </BreadcrumbItem>
              </React.Fragment>
            ))}
          </BreadcrumbList>
        </Breadcrumb>
        <div className="ml-auto flex items-center gap-2">
          <ConnectWalletButton />
        </div>
      </div>
    </header>
  );
};

export default NavHeader;
