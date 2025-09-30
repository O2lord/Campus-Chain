"use client";
import NavHeader from "@/components/NavHeader";

import React from "react";

export default function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <NavHeader navs={[]} />

      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <div className="p-3 space-y-6">{children}</div>
      </div>
    </>
  );
}
