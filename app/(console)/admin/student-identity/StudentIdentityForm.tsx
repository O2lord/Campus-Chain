"use client";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { zodResolver } from "@hookform/resolvers/zod";
import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import SetSelect from "./SetSelect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, SaveIcon, Search } from "lucide-react";
import { updateStudent, getStudents, Student } from "@/services/studentIdentityService";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

const formSchema = z.object({
  set: z.string().min(1, "Please select a set/level"),
  name: z.string().min(1, "Student name is required"),
  matric_no: z.string().min(1, "Matric number is required"),
  wallet: z.string().nullable().optional(),
  attendance: z.number().min(0, "Attendance must be 0 or greater").max(100, "Attendance cannot exceed 100"),
});

type FormSchemaType = z.infer<typeof formSchema>;

interface StudentIdentityFormProps {
  onSetChange: (set: string) => void;
}

const StudentIdentityForm = ({ onSetChange }: StudentIdentityFormProps) => {
  const queryClient = useQueryClient();
  const [selectedStudentId, setSelectedStudentId] = useState<string>("");
  const [isUpdateMode, setIsUpdateMode] = useState(false);
  const [searchMatric, setSearchMatric] = useState("");
  const [searchResult, setSearchResult] = useState<Student | null>(null);

  const form = useForm<FormSchemaType>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      set: "",
      matric_no: "",
      wallet: "",
      name: "",
      attendance: 0,
    },
  });

  
  const { watch } = form;
  const selectedSet = watch("set");

  
  const { data: students = [], isLoading: studentsLoading } = useQuery({
    queryKey: ["students"],
    queryFn: getStudents,
  });

  
  const filteredStudentsForDropdown = React.useMemo(() => {
    if (!selectedSet || selectedSet === "") {
      return students; 
    }
    return students.filter(student => student.set.trim() === selectedSet.trim());
  }, [students, selectedSet]);

  const updateStudentMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Student> }) => 
      updateStudent(id, updates),
    onSuccess: () => {
      toast.success("Student data updated successfully!");
      queryClient.invalidateQueries({ queryKey: ["students"] });
      form.reset();
      setSelectedStudentId("");
      setIsUpdateMode(false);
      setSearchMatric("");
      setSearchResult(null);
    },
    onError: (error) => {
      toast.error(`Failed to update student data: ${error.message}`);
      console.error("Error updating student:", error);
    },
  });

  
  const handleSearch = () => {
    if (!searchMatric.trim()) {
      toast.error("Please enter a matric number to search");
      return;
    }

    const foundStudent = students.find(student => 
      student.matric_no.toLowerCase().includes(searchMatric.toLowerCase().trim())
    );

    if (foundStudent) {
      setSearchResult(foundStudent);
      setSelectedStudentId(foundStudent.id!);
      setIsUpdateMode(true);
      
      
      form.reset({
        set: foundStudent.set,
        name: foundStudent.name,
        matric_no: foundStudent.matric_no,
        wallet: foundStudent.wallet || "",
        attendance: foundStudent.attendance,
      });

      
      onSetChange(foundStudent.set);

      toast.success(`Student found: ${foundStudent.name}`);
    } else {
      setSearchResult(null);
      setSelectedStudentId("");
      setIsUpdateMode(false);
      form.reset();
      
      onSetChange('ALL');
      toast.error("No student found with that matric number");
    }
  };

  
  const handleStudentSelect = (studentId: string) => {
    const selectedStudent = students.find(student => student.id === studentId);
    if (selectedStudent) {
      setSelectedStudentId(studentId);
      setIsUpdateMode(true);
      setSearchResult(selectedStudent);
      setSearchMatric(selectedStudent.matric_no);
      
      
      form.reset({
        set: selectedStudent.set,
        name: selectedStudent.name,
        matric_no: selectedStudent.matric_no,
        wallet: selectedStudent.wallet || "",
        attendance: selectedStudent.attendance,
      });

      
      onSetChange(selectedStudent.set);
    } else {
      
      onSetChange('ALL');
    }
  };

  
  const handleClearSearch = () => {
    setSearchMatric("");
    setSearchResult(null);
    setSelectedStudentId("");
    setIsUpdateMode(false);
    form.reset();
    
    onSetChange('ALL');
  };

  async function onSubmit(values: FormSchemaType) {
    if (!isUpdateMode || !selectedStudentId) {
      toast.error("Please search for and select a student to update");
      return;
    }

    
    await updateStudentMutation.mutateAsync({
      id: selectedStudentId,
      updates: {
        set: values.set,
        name: values.name,
        matric_no: values.matric_no,
        wallet: values.wallet || null,
        attendance: values.attendance,
      }
    });
  }

  const isPending = updateStudentMutation.isPending;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Set/Level Field */}
        <FormField
          control={form.control}
          name="set"
          render={() => (
            <FormItem>
              <FormLabel>Set/Level</FormLabel>
              <FormControl>
                {/* Pass the onSetChange prop to SetSelect */}
                <SetSelect onExternalChange={onSetChange} />
              </FormControl>
              <FormDescription>
                Select the academic level/set of the student first to filter the student dropdown.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Student Search and Selection */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Select Student</label>
          <Select value={selectedStudentId || ""} onValueChange={handleStudentSelect}>
            <SelectTrigger className="w-full max-w-xs">
              <SelectValue placeholder="Select a student or search by matric no">
                {searchResult ? `${searchResult.matric_no} - ${searchResult.name}` : 
                 selectedSet ? `Search by matric number or select from ${selectedSet} students` :
                 "Please select a set first, then choose a student"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <div className="p-2 border-b">
                <div className="flex gap-2">
                  <Input
                    type="text"
                    placeholder="Search by matric number..."
                    value={searchMatric}
                    onChange={(e) => setSearchMatric(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleSearch();
                      }
                    }}
                    className="flex-1"
                  />
                  <Button 
                    type="button" 
                    size="sm"
                    variant="outline" 
                    onClick={handleSearch}
                    disabled={studentsLoading}
                  >
                    <Search className="h-4 w-4" />
                  </Button>
                  {(searchResult || searchMatric) && (
                    <Button 
                      type="button" 
                      size="sm"
                      variant="ghost" 
                      onClick={handleClearSearch}
                    >
                      Clear
                    </Button>
                  )}
                </div>
              </div>
              {/* Use filteredStudentsForDropdown here */}
              {filteredStudentsForDropdown.length > 0 ? (
                filteredStudentsForDropdown.map((student) => (
                  <SelectItem key={student.id} value={student.id!}>
                    {student.matric_no} - {student.name}
                  </SelectItem>
                ))
              ) : (
                <div className="p-2 text-sm text-muted-foreground text-center">
                  {selectedSet ? `No students found in ${selectedSet}` : "No students available"}
                </div>
              )}
            </SelectContent>
          </Select>
          <p className="text-sm text-muted-foreground">
            {isUpdateMode ? "Updating existing student data" : 
             selectedSet ? `Showing ${filteredStudentsForDropdown.length} student(s) from ${selectedSet}` :
             "Please select a set first to see available students"}
          </p>
        </div>

        <FormField
          control={form.control}
          name="matric_no"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Matric Number</FormLabel>
              <FormControl>
                <Input
                  type="text"
                  placeholder="e.g., CSC/2021/001"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Student Name</FormLabel>
              <FormControl>
                <Input
                  type="text"
                  placeholder="Enter student's full name"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="wallet"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Wallet Address (Optional)</FormLabel>
              <FormControl>
                <Input
                  type="text"
                  placeholder="Dzi..."
                  {...field}
                  value={field.value || ""}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="attendance"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Attendance Percentage</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  placeholder="Enter attendance percentage (0-100)"
                  {...field}
                  onChange={(e) => field.onChange(e.target.value === "" ? 0 : parseFloat(e.target.value))}
                  value={field.value}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />


        <div className="flex gap-2">
          <Button type="submit" disabled={isPending || !isUpdateMode} className="flex-1">
            {isPending ? (
              <>
                <Loader2 className="animate-spin mr-2 h-4 w-4" />
                Updating...
              </>
            ) : (
              <>
                <SaveIcon className="mr-2 h-4 w-4" />
                Update Student Data
              </>
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
};

export default StudentIdentityForm;