"use client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import React from "react";
import { getDistinctSets } from "@/services/studentIdentityService";
import { useQuery } from "@tanstack/react-query";

interface ClassSelectProps {
  value?: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

const ClassSelect = ({ value, onChange, disabled }: ClassSelectProps) => {
  const { data: sets, isLoading } = useQuery({
    queryKey: ["distinctSets"],
    queryFn: getDistinctSets,
  });

  return (
    <Select
      disabled={disabled || isLoading}
      value={value || ""}
      onValueChange={onChange}
    >
      <SelectTrigger className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-black focus:border-transparent">
        <SelectValue placeholder="Select class/set" />
      </SelectTrigger>
      <SelectContent>
        {isLoading ? (
          <SelectItem value="loading" disabled>Loading classes...</SelectItem>
        ) : (
          sets?.map((set) => (
            <SelectItem
              key={set}
              value={set}
              className="capitalize"
            >
              {set}
            </SelectItem>
          ))
        )}
      </SelectContent>
    </Select>
  );
};

export default ClassSelect;