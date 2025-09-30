"use client";
import {
  TableCaption,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
  Table,
} from "@/components/ui/table";
import React from "react";
import ExplorerLink from "@/components/ExplorerLink";
import SkeletonWapper from "@/components/SkeletonWapper";
import { getStudents } from "@/services/studentIdentityService"; 
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Users } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

interface StudentDataTableProps {
  selectedSetFilter: string;
}

const StudentDataTable = ({ selectedSetFilter }: StudentDataTableProps) => {
  const { data: students, isLoading, isError } = useQuery({
    queryKey: ["students"],
    queryFn: getStudents,
  });

  const filteredStudents = React.useMemo(() => {
    if (selectedSetFilter === 'ALL') {
      return students;
    }
    // Add .trim() to both sides for robust comparison
    return students?.filter(student => student.set.trim() === selectedSetFilter.trim()) || [];
  }, [students, selectedSetFilter]);

  if (isError) {
    return (
      <div>
        <p className="text-red-500">Error loading student data.</p>
      </div>
    );
  }

  return (
    <SkeletonWapper isLoading={isLoading}>
      <Table>
        <TableCaption>
          A list of registered students
          {selectedSetFilter !== 'ALL' && ` (filtered by set: ${selectedSetFilter})`}.
        </TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>Set/Level</TableHead>
            <TableHead>Matric No</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Wallet</TableHead>
            <TableHead className="text-right">Attendance</TableHead>
            <TableHead className="text-right">Eligibility</TableHead>
            <TableHead className="text-right">Academic Records</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredStudents && filteredStudents.length > 0 ? (
            filteredStudents.map((item) => (
              <TableRow key={item.id}>
                <TableCell>{item.set}</TableCell>
                <TableCell>{item.matric_no}</TableCell>
                <TableCell>{item.name}</TableCell>
                <TableCell>
                  {item.wallet ? (
                    <ExplorerLink type="address"  value={item.wallet} />
                  ) : (
                    "N/A"
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {item.attendance?.toLocaleString() ?? 0}%
                </TableCell>
                <TableCell className="text-right">
                  <span className={`inline-flex px-2 py-1 text-xs rounded-full ${
                    item.eligible === true
                      ? "bg-green-100 text-green-800"
                      : "bg-red-100 text-red-800"
                  }`}>
                    {item.eligible ? "Eligible" : "Not Eligible"}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <Link href={`/admin/student-identity/${item.id}`}>
                    <Button size="sm" variant="outline">
                      <Users className="w-4 h-4 mr-2" />
                      View
                    </Button>
                  </Link>
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={7} className="text-center">
                {selectedSetFilter === 'ALL' 
                  ? "No student data available."
                  : `No students found for set: ${selectedSetFilter}`
                }
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </SkeletonWapper>
  );
};

export default StudentDataTable;