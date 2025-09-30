import React, { PropsWithChildren } from "react";
import { cn } from "@/lib/utils";
import { Skeleton } from "./ui/skeleton";

type Props = {
  isLoading: boolean;
  fullWidth?: boolean;
} & PropsWithChildren;

const SkeletonWapper: React.FC<Props> = ({
  children,
  isLoading,
  fullWidth = true,
}) => {
  if (!isLoading) return children;
  return (
    <Skeleton className={cn(fullWidth && "w-full")}>
      <div className="opacity-10">{children}</div>
    </Skeleton>
  );
};

export default SkeletonWapper;
