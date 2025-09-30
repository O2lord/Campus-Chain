"use client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import React from "react";
import { useController } from "react-hook-form";
import { getDistinctSets } from "@/services/studentIdentityService";
import { useQuery } from "@tanstack/react-query";


interface SetSelectProps {
  onExternalChange?: (set: string) => void; 
}


const SetSelect = ({ onExternalChange }: SetSelectProps) => {
  const { field, formState } = useController({
    name: "set",
  });

  const { data: sets, isLoading } = useQuery({
    queryKey: ["distinctSets"],
    queryFn: getDistinctSets,
  });

  return (
    <Select
      disabled={formState.disabled || isLoading}
      key={field.value || ""}
      value={field.value || ""}
      defaultValue={field.value || ""}
      onValueChange={(value) => {
        field.onChange(value); 
        if (onExternalChange) {
          onExternalChange(value); 
        }
      }}
    >
      <SelectTrigger>
        <SelectValue placeholder="Select student level/set" />
      </SelectTrigger>
      <SelectContent>
        {isLoading ? (
          <SelectItem value="loading" disabled>Loading sets...</SelectItem>
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

export default SetSelect;