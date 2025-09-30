"use client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DatabaseZapIcon } from "lucide-react";
import React, { useState } from "react";
import StudentIdentityForm from "./StudentIdentityForm";
import StudentDataTable from "./StudentDataTable";
import { useQuery } from "@tanstack/react-query";
import { getDistinctSets } from "@/services/studentIdentityService";

const StudentIdentity = () => {
  const [selectedSetFilter, setSelectedSetFilter] = useState<string>('ALL');

  const { data: distinctSets, isLoading: isLoadingSets } = useQuery({
    queryKey: ["distinctSets"],
    queryFn: getDistinctSets,
  });

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DatabaseZapIcon className="mr-2" />
            Student Identity
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Pass the setter function to the form */}
          <StudentIdentityForm onSetChange={setSelectedSetFilter} />
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-bold flex items-center justify-between">
            <div className="flex items-center">
              <DatabaseZapIcon className="mr-2 size-5" />
              Student Data
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-normal">Filter by Set:</span>
              <Select 
                value={selectedSetFilter} 
                onValueChange={setSelectedSetFilter}
                disabled={isLoadingSets}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Select a set" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Sets</SelectItem>
                  {distinctSets?.map((set) => (
                    <SelectItem key={set} value={set}>
                      {set}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <StudentDataTable selectedSetFilter={selectedSetFilter} />
        </CardContent>
      </Card>
    </>
  );
};

export default StudentIdentity;