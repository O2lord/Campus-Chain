"use client"
import React, { useState } from 'react';
import { BN } from "@coral-xyz/anchor";
import { Plus, Trash2, Calendar as CalendarIcon, Users, Save, ArrowRight, ArrowLeft, ChevronDown, ChevronRight, Eye } from 'lucide-react';
import useElectorateProgram, { PollType } from '@/hooks/useElectorate';
import { toast } from 'sonner';
import { useSupabaseClient } from '@supabase/auth-helpers-react';
import { SupabaseClient } from '@supabase/supabase-js';
import { addCandidateImageMetadata } from '@/services/electorateService';
import SetSelect from '@/app/(console)/admin/student-identity/SetSelect';
import ClassSelect from '@/components/ClassSelect';
import Image from 'next/image';

interface CandidateInput {
  name: string;
  department: string;
  motto: string;
  imageFile?: File; 
  imageUrl?: string;
}

interface PositionInput {
  name: string;
  maxSelections: number;
  candidates: CandidateInput[];
}

interface PollFormData {
  pollType: PollType;
  className?: string;
  departmentName?: string;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  positions: PositionInput[];
}

const AdminPollCreation = () => {
  const { initializePoll, isProcessing } = useElectorateProgram();
  
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [collapsedPositions, setCollapsedPositions] = useState<Set<number>>(new Set());
  const [ canSubmit, setCanSubmit ] = useState(false);
  const supabaseClient = useSupabaseClient();

  const [pollData, setPollData] = useState<PollFormData>({
  pollType: PollType.Class,
  className: '',
  departmentName: '',
  startDate: new Date().toISOString().split('T')[0],
  startTime: new Date().toTimeString().slice(0, 5),
  endDate: new Date().toISOString().split('T')[0],
  endTime: new Date(Date.now() + 2 * 60 * 60 * 1000).toTimeString().slice(0, 5),
  positions: [
    {
      name: '',
      maxSelections: 1,
      candidates: [{ name: '', department: '', motto: '' }]
    }
  ]
});

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [successMessage, setSuccessMessage] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');

  const pollTypeOptions = [
    { value: PollType.Class, label: 'Class Election' },
    { value: PollType.Departmental, label: 'Departmental Election' },
    { value: PollType.SUG, label: 'Student Union Government' }
  ];

  const stepTitles = [
    'Basic Setup',
    'Positions & Candidates',
    'Preview & Submit'
  ];

  const addPosition = (): void => {
    if (pollData.positions.length >= 5) {
      setErrorMessage('You can create a maximum of 5 positions per poll.');
      return;
    }

    setPollData(prev => ({
      ...prev,
      positions: [...prev.positions, { name: '', maxSelections: 1, candidates: [{ name: '', department: '', motto: '' }] }]
    }));
  };

  const removePosition = (positionIndex: number): void => {
    if (pollData.positions.length > 1) {
      setPollData(prev => ({
        ...prev,
        positions: prev.positions.filter((_, i) => i !== positionIndex)
      }));
      setCollapsedPositions(prev => {
        const newSet = new Set(prev);
        newSet.delete(positionIndex);
        return newSet;
      });
    }
  };

  const togglePositionCollapse = (positionIndex: number): void => {
    setCollapsedPositions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(positionIndex)) {
        newSet.delete(positionIndex);
      } else {
        newSet.add(positionIndex);
      }
      return newSet;
    });
  };

  const addCandidate = (positionIndex: number): void => {
    setPollData(prev => ({
      ...prev,
      positions: prev.positions.map((pos, pIdx) =>
        pIdx === positionIndex
          ? { ...pos, candidates: [...pos.candidates, { name: '', department: '', motto: '' }] }
          : pos
      )
    }));
  };

  const removeCandidate = (positionIndex: number, candidateIndex: number): void => {
    setPollData(prev => ({
      ...prev,
      positions: prev.positions.map((pos, pIdx) =>
        pIdx === positionIndex
          ? { ...pos, candidates: pos.candidates.filter((_, cIdx) => cIdx !== candidateIndex) }
          : pos
      )
    }));
  };

  const updateCandidate = <K extends keyof CandidateInput>(positionIndex: number, candidateIndex: number, field: K, value: CandidateInput[K]): void => {
  setPollData(prev => ({
    ...prev,
    positions: prev.positions.map((pos, pIdx) =>
      pIdx === positionIndex
        ? {
            ...pos,
            candidates: pos.candidates.map((candidate, cIdx) =>
              cIdx === candidateIndex ? { ...candidate, [field]: value } : candidate
            )
          }
        : pos
    )
  }));
};

  const updatePositionField = (positionIndex: number, field: keyof PositionInput, value: string | number): void => {
    setPollData(prev => ({
      ...prev,
      positions: prev.positions.map((pos, pIdx) =>
        pIdx === positionIndex
          ? { ...pos, [field]: value }
          : pos
      )
    }));
  };

const uploadCandidateImagesAndMetadata = async (
  pollPubkey: string,
  positions: PositionInput[],
  supabase: SupabaseClient
) => {
  
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    console.log('Current user:', user);
    console.log('User error:', userError);
    
    if (!user) {
      console.error('No authenticated user found!');
      toast.error('You must be logged in to upload images');
      return;
    }
    
    const role = user.user_metadata?.role || user.user_metadata?.role;
    console.log('User role:', role);
    
    if (!role || !['lecturer', 'admin'].includes(role)) {
      console.error('User does not have required role. Current role:', role);
      toast.error('You do not have permission to upload images. Required role: lecturer or admin');
      return;
    }
    
  } catch (authError) {
    console.error('Authentication check failed:', authError);
    toast.error('Authentication check failed');
    return;
  }
  
  const metadataToInsert: {
    poll_pubkey: string;
    position_index: number;
    candidate_index: number;
    image_url: string;
  }[] = [];

  for (const [posIndex, position] of positions.entries()) {
    for (const [candIndex, candidate] of position.candidates.entries()) {
      if (candidate.imageFile) {

        
        const filePath = `candidate_images/${pollPubkey}/${posIndex}/${candIndex}-${candidate.imageFile.name}`;
        
        try {
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('candidate-images')
            .upload(filePath, candidate.imageFile, {
              cacheControl: '3600',
              upsert: false,
            });

          if (uploadError) {
            console.error(`Error uploading image for candidate ${candidate.name}:`, uploadError);
            console.error('Upload error details:', {
              message: uploadError.message,
              statusCode: uploadError.cause,
              error: uploadError.cause
            });
            toast.error(`Failed to upload image for ${candidate.name}: ${uploadError.message}`);
            continue;
          }


          const { data: publicUrlData } = supabase.storage
            .from('candidate-images')
            .getPublicUrl(filePath);

          if (publicUrlData?.publicUrl) {
            metadataToInsert.push({
              poll_pubkey: pollPubkey,
              position_index: posIndex,
              candidate_index: candIndex,
              image_url: publicUrlData.publicUrl,
            });
          }
        } catch (error) {
          console.error(`Exception during upload for ${candidate.name}:`, error);
          toast.error(`Exception uploading ${candidate.name}'s image`);
        }
      }
    }
  }

  // Insert metadata
  if (metadataToInsert.length > 0) {
    console.log("Attempting to insert metadata:", metadataToInsert);
    try {
      await addCandidateImageMetadata(metadataToInsert, supabase);
      toast.success('Candidate images and metadata saved!');
      console.log("Metadata inserted successfully.");
    } catch (insertError: unknown) {
      console.error('Error inserting candidate image metadata:', insertError);
      const errorMessage = insertError instanceof Error ? insertError.message : 'Unknown error during metadata insertion';
      toast.error(`Failed to save candidate image metadata: ${errorMessage}`);
    }
  } else {
    console.log("No image metadata to insert.");
  }
};


  // Step validation functions
  const validateStep1 = (): boolean => {
    if (!pollData.startDate || !pollData.startTime || !pollData.endDate || !pollData.endTime) {
      setErrorMessage('Please set both start and end dates/times');
      return false;
    }

     if (pollData.pollType === PollType.Class && !pollData.className?.trim()) {
    setErrorMessage('Class name is required for Class elections');
    return false;
  }

  if (pollData.pollType === PollType.Departmental && !pollData.departmentName?.trim()) {
    setErrorMessage('Department name is required for Departmental elections');
    return false;
  }

    const startDateTime = new Date(`${pollData.startDate}T${pollData.startTime}`);
    const endDateTime = new Date(`${pollData.endDate}T${pollData.endTime}`);

    if (startDateTime >= endDateTime) {
      setErrorMessage('End time must be after start time');
      return false;
    }

    if (startDateTime < new Date()) {
      setErrorMessage('Start time must be in the future');
      return false;
    }

    return true;
  };

  const validateStep2 = (): boolean => {
    if (pollData.positions.length === 0) {
      setErrorMessage('At least one position is required.');
      return false;
    }
    if (pollData.positions.length > 5) {
      setErrorMessage('Maximum of 5 positions allowed per poll.');
      return false;
    }

    for (let i = 0; i < pollData.positions.length; i++) {
      const position = pollData.positions[i];
      
      if (!position.name.trim()) {
        setErrorMessage(`Position ${i + 1} name is required`);
        return false;
      }

      if (position.maxSelections <= 0) {
        setErrorMessage(`Position "${position.name}" must allow at least 1 selection`);
        return false;
      }

      if (position.maxSelections > position.candidates.length) {
        setErrorMessage(`Position "${position.name}" cannot allow more selections than available candidates`);
        return false;
      }

      for (let j = 0; j < position.candidates.length; j++) {
        const candidate = position.candidates[j];
        if (!candidate.name.trim() || !candidate.department.trim()) {
          setErrorMessage(`All candidates in position "${position.name}" must have name and department filled`);
          return false;
        }
      }
    }

    return true;
  };

  const validateCurrentStep = (): boolean => {
    console.log('validateCurrentStep called for step:', currentStep);
    setErrorMessage('');
    
    switch (currentStep) {
      case 1:
        console.log('Validating step 1');
        return validateStep1();
      case 2:
        console.log('Validating step 2');
        const step2Valid = validateStep2();
        console.log('Step 2 validation result:', step2Valid);
        return step2Valid;
      case 3:
        console.log('Validating step 3');
        return true;
      default:
        console.log('Invalid step number:', currentStep);
        return false;
    }
  };

  const nextStep = (): void => {
  console.log('nextStep called, current step:', currentStep);
  
  if (validateCurrentStep() && currentStep < 3) {
    console.log('Validation passed, moving to next step');
    setCurrentStep(currentStep + 1);
    console.log('setCurrentStep called with:', currentStep + 1);
    
    // If moving to step 3, prevent immediate submission
    if (currentStep + 1 === 3) {
      setCanSubmit(false);
      // Allow submission after a brief delay
      setTimeout(() => setCanSubmit(true), 100);
    }
  } else {
    console.log('Validation failed or already at step 3');
  }
};


  const prevStep = (): void => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
      setErrorMessage('');
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
  console.log('handleSubmit called!');
    e.preventDefault();

    // Only allow submission if we're on step 3 and canSubmit is true
  if (currentStep !== 3 || !canSubmit) {
    console.log('Submission blocked - step:', currentStep, 'canSubmit:', canSubmit);
    return;
  }


    setErrorMessage('');
    setSuccessMessage('');

    if (!validateStep2()) return;

    setIsSubmitting(true);

    try {
      const startDateTime = new Date(`${pollData.startDate}T${pollData.startTime}`);
      const endDateTime = new Date(`${pollData.endDate}T${pollData.endTime}`);
      const pollId = new BN(Date.now() + Math.floor(Math.random() * 1000));
      
      const result = await initializePoll.mutateAsync({
        pollId,
        pollType: pollData.pollType,
        className: pollData.pollType === PollType.Class ? pollData.className : undefined,
        departmentName: pollData.pollType === PollType.Departmental ? pollData.departmentName : undefined,
        startTime: startDateTime,
        endTime: endDateTime,
        positions: pollData.positions
      });

      

        // After successful Solana poll creation, upload images to Supabase
        await uploadCandidateImagesAndMetadata(
          result.poll, // This is the poll's PublicKey string from Solana
          pollData.positions,
          supabaseClient
        );

      toast.success(`Poll created successfully! Transaction: ${result.signature}`);
      
      // Reset form
      setPollData({
        pollType: PollType.Class,
        className: '',
        departmentName: '',
        startDate: new Date().toISOString().split('T')[0],
        startTime: new Date().toTimeString().slice(0, 5),
        endDate: new Date().toISOString().split('T')[0],
        endTime: new Date(Date.now() + 2 * 60 * 60 * 1000).toTimeString().slice(0, 5),
        positions: [
          {
            name: '',
            maxSelections: 1,
            candidates: [{ name: '', department: '', motto: '' }]
          }
        ]
      });

      setCurrentStep(1);
      setCollapsedPositions(new Set());

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      setErrorMessage(`Failed to create poll: ${errorMessage}`);
    } finally {
      setIsSubmitting(false);
    }
  
  };

  // Render Step 1: Basic Setup
  const renderStep1 = () => (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Election Type
        </label>
        <select
          value={pollData.pollType}
          onChange={(e) => setPollData(prev => ({ ...prev, pollType: parseInt(e.target.value) as PollType }))}
          className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-black focus:border-transparent"
        >
          {pollTypeOptions.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      {/* Class and Dept Selection */}
       {pollData.pollType === PollType.Class && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Class/Set *
          </label>
          <ClassSelect 
            value={pollData.className}
            onChange={(value) => setPollData(prev => ({ ...prev, className: value }))}
          />
        </div>
      )}

        {pollData.pollType === PollType.Departmental && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Department Name *
            </label>
            <input
              type="text"
              value={pollData.departmentName || ''}
              onChange={(e) => setPollData(prev => ({ ...prev, departmentName: e.target.value }))}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-black focus:border-transparent"
              placeholder="e.g., Computer Science"
              required
            />
          </div>
        )}

      <div className="grid md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
            <CalendarIcon className="w-4 h-4" />
            Start Date & Time
          </label>
          <div className="space-y-2">
            <input
              type="date"
              value={pollData.startDate}
              onChange={(e) => setPollData(prev => ({ ...prev, startDate: e.target.value }))}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-black"
              min={new Date().toISOString().split('T')[0]}
            />
            <input
              type="time"
              value={pollData.startTime}
              onChange={(e) => setPollData(prev => ({ ...prev, startTime: e.target.value }))}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-black"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
            <CalendarIcon className="w-4 h-4" />
            End Date & Time
          </label>
          <div className="space-y-2">
            <input
              type="date"
              value={pollData.endDate}
              onChange={(e) => setPollData(prev => ({ ...prev, endDate: e.target.value }))}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-black"
              min={pollData.startDate || new Date().toISOString().split('T')[0]}
            />
            <input
              type="time"
              value={pollData.endTime}
              onChange={(e) => setPollData(prev => ({ ...prev, endTime: e.target.value }))}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-black"
            />
          </div>
        </div>
      </div>
    </div>
  );

  // Render Step 2: Positions and Candidates
  const renderStep2 = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <label className="block text-lg font-medium text-gray-700">
          Election Positions ({pollData.positions.length})
        </label>
        <button
          type="button"
          onClick={addPosition}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Position
        </button>
      </div>

      <div className="space-y-4">
        {pollData.positions.map((position, positionIndex) => {
          const isCollapsed = collapsedPositions.has(positionIndex);
          
          return (
            <div key={positionIndex} className="bg-gray-50 rounded-lg border-2 border-gray-200">
              {/* Position Header - Always Visible */}
              <div className="p-4 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => togglePositionCollapse(positionIndex)}
                  className="flex items-center gap-2 text-left flex-1"
                >
                  {isCollapsed ? (
                    <ChevronRight className="w-5 h-5 text-gray-500" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-500" />
                  )}
                  <h3 className="text-lg font-semibold text-gray-900">
                    {position.name || `Position ${positionIndex + 1}`}
                  </h3>
                  <span className="text-sm text-gray-500 ml-2">
                    ({position.candidates.length} candidates)
                  </span>
                </button>
                
                {pollData.positions.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removePosition(positionIndex)}
                    className="text-red-600 hover:text-red-700 p-2 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                )}
              </div>

              {/* Position Content - Collapsible */}
              {!isCollapsed && (
                <div className="px-4 pb-4 border-t border-gray-200">
                  {/* Position Details */}
                  <div className="grid md:grid-cols-2 gap-4 mb-6 mt-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Position Name *
                      </label>
                      <input
                        type="text"
                        value={position.name}
                        onChange={(e) => updatePositionField(positionIndex, 'name', e.target.value)}
                        className="w-full p-3 border border-gray-300 text-black rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        placeholder="e.g., Class President, Secretary"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Maximum Selections *
                      </label>
                      <input
                        type="number"
                        min="1"
                        max={position.candidates.length || 1}
                        value={position.maxSelections}
                        onChange={(e) => updatePositionField(positionIndex, 'maxSelections', parseInt(e.target.value))}
                        className="w-full p-3 border border-gray-300 text-black rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        required
                      />
                    </div>
                  </div>

                  {/* Candidates */}
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <label className="block text-sm font-medium text-gray-700">
                        Candidates ({position.candidates.length})
                      </label>
                      <button
                        type="button"
                        onClick={() => addCandidate(positionIndex)}
                        className="flex items-center gap-2 px-3 py-1 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
                      >
                        <Plus className="w-3 h-3" />
                        Add Candidate
                      </button>
                    </div>

                    <div className="space-y-4">
                      {position.candidates.map((candidate, candidateIndex) => (
                        <div key={candidateIndex} className="bg-white p-4 rounded-lg border">
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="text-md font-medium text-gray-800">
                              Candidate {candidateIndex + 1}
                            </h4>
                            {position.candidates.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeCandidate(positionIndex, candidateIndex)}
                                className="text-red-600 hover:text-red-700 p-1"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>

                          <div className="grid md:grid-cols-2 gap-3">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Full Name *
                              </label>
                              <input
                                type="text"
                                value={candidate.name}
                                onChange={(e) => updateCandidate(positionIndex, candidateIndex, 'name', e.target.value)}
                                className="w-full p-2 border border-gray-300 text-black rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                placeholder="Enter candidate's full name"
                                required
                              />
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Department *
                              </label>
                              <input
                                type="text"
                                value={candidate.department}
                                onChange={(e) => updateCandidate(positionIndex, candidateIndex, 'department', e.target.value)}
                                className="w-full p-2 border border-gray-300 text-black rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                placeholder="e.g., Computer Science"
                                required
                              />
                            </div>

                            <div className="md:col-span-2">
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Campaign Motto
                              </label>
                              <input
                                type="text"
                                value={candidate.motto}
                                onChange={(e) => updateCandidate(positionIndex, candidateIndex, 'motto', e.target.value)}
                                className="w-full p-2 border border-gray-300 text-black rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                placeholder="Enter campaign slogan (optional)"
                              />
                            </div>

                             <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                  Candidate Image (Optional)
                                </label>
                                <input
                                  type="file"
                                  accept="image/*" // Restrict to image files
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                      updateCandidate(positionIndex, candidateIndex, 'imageFile', file);
                                      // Optional: Display a local preview of the image
                                      const reader = new FileReader();
                                      reader.onloadend = () => {
                                        updateCandidate(positionIndex, candidateIndex, 'imageUrl', reader.result as string); // Use imageUrl for local preview
                                      };
                                      reader.readAsDataURL(file);
                                    } else {
                                      updateCandidate(positionIndex, candidateIndex, 'imageFile', undefined);
                                      updateCandidate(positionIndex, candidateIndex, 'imageUrl', undefined);
                                    }
                                  }}
                                  className="w-full p-2 border border-gray-300 text-black rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                />
                                {candidate.imageUrl && (
                                  <div className="mt-2">
                                    <Image 
                                    width={96}
                                    height={96}
                                    src={candidate.imageUrl} alt="Candidate Preview" className="w-24 h-24 object-cover rounded-md" />
                                  </div>
                                )}
                              </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  // Render Step 3: Preview
  const renderStep3 = () => (
    <div className="space-y-6">
      <div className="bg-blue-50 p-4 rounded-lg">
        <h3 className="text-lg font-semibold text-blue-900 mb-2 flex items-center gap-2">
          <Eye className="w-5 h-5" />
          Poll Preview
        </h3>
        <p className="text-blue-700">
          Please review all the details below before creating the poll. Once created, some details cannot be changed.
        </p>
      </div>

      {/* Basic Information */}
      <div className="bg-white p-6 rounded-lg border">
        <h4 className="text-lg font-semibold text-gray-900 mb-4">Basic Information</h4>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Election Type</label>
            <p className="text-gray-900 font-medium">
              {pollTypeOptions.find(opt => opt.value === pollData.pollType)?.label}
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Duration</label>
            <p className="text-gray-900">
              {new Date(`${pollData.startDate}T${pollData.startTime}`).toLocaleString()} 
              <br />
              to {new Date(`${pollData.endDate}T${pollData.endTime}`).toLocaleString()}
            </p>
          </div>
          {pollData.className && (
            <div>
              <label className="block text-sm font-medium text-gray-700">Class</label>
              <p className="text-gray-900 font-medium">{pollData.className}</p>
            </div>
          )}
          {pollData.departmentName && (
            <div>
              <label className="block text-sm font-medium text-gray-700">Department</label>
              <p className="text-gray-900 font-medium">{pollData.departmentName}</p>
            </div>
          )}
        </div>
      </div>

      {/* Positions Summary */}
      <div className="bg-white p-6 rounded-lg border">
        <h4 className="text-lg font-semibold text-gray-900 mb-4">
          Positions & Candidates ({pollData.positions.length} positions)
        </h4>
        <div className="space-y-4">
          {pollData.positions.map((position, positionIndex) => (
            <div key={positionIndex} className="border-l-4 border-indigo-500 pl-4">
              <h5 className="font-semibold text-gray-900 mb-2">
                {position.name} 
                <span className="text-sm text-gray-600 ml-2">
                  (Max selections: {position.maxSelections})
                </span>
              </h5>
              <div className="space-y-2">
                {position.candidates.map((candidate, candidateIndex) => (
                  <div key={candidateIndex} className="bg-gray-50 p-3 rounded flex gap-3">
                    {/* Candidate Image */}
                    {candidate.imageUrl && (
                      <div className="flex-shrink-0">
                        <Image 
                          width={80}
                          height={80}
                          src={candidate.imageUrl} 
                          alt={`${candidate.name} photo`}
                          className="w-20 h-20 object-cover rounded-md border-2 border-gray-200"
                        />
                      </div>
                    )}
                    
                    {/* Candidate Details */}
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">
                        <span className="text-gray-600 font-normal">Name:</span> {candidate.name}
                      </p>
                      <p className="text-sm text-gray-600">
                        <span className="font-medium">Dept:</span> {candidate.department}
                      </p>
                      {candidate.motto && (
                        <p className="text-sm text-gray-700 italic mt-1">&apos;{candidate.motto}&apos;</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {/* Header */}
          <div className="flex items-center gap-3 mb-8">
            <div className="bg-indigo-100 p-3 rounded-full">
              <Users className="w-6 h-6 text-indigo-600" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Create New Poll</h1>
              <p className="text-gray-600">Set up a new election for students to vote</p>
            </div>
          </div>

          {/* Step Indicator */}
          <div className="mb-8">
            <div className="flex items-center justify-between">
              {stepTitles.map((title, index) => {
                const stepNumber = index + 1;
                const isActive = currentStep === stepNumber;
                const isCompleted = currentStep > stepNumber;
                
                return (
                  <div key={stepNumber} className="flex items-center">
                    <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 ${
                      isCompleted 
                        ? 'bg-green-500 border-green-500 text-white' 
                        : isActive 
                          ? 'bg-indigo-600 border-indigo-600 text-white' 
                          : 'bg-white border-gray-300 text-gray-500'
                    }`}>
                      {isCompleted ? '✓' : stepNumber}
                    </div>
                    <div className="ml-3">
                      <p className={`text-sm font-medium ${
                        isActive ? 'text-indigo-600' : isCompleted ? 'text-green-600' : 'text-gray-500'
                      }`}>
                        Step {stepNumber}
                      </p>
                      <p className={`text-sm ${
                        isActive ? 'text-gray-900' : 'text-gray-500'
                      }`}>
                        {title}
                      </p>
                    </div>
                    {index < stepTitles.length - 1 && (
                      <div className={`flex-1 h-0.5 mx-4 ${
                        isCompleted ? 'bg-green-500' : 'bg-gray-300'
                      }`} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Messages */}
          {successMessage && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700">
              {successMessage}
            </div>
          )}

          {errorMessage && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
              {errorMessage}
            </div>
          )}

          {/* Form Content */}
          <form onSubmit={handleSubmit}>
            {currentStep === 1 && renderStep1()}
            {currentStep === 2 && renderStep2()}
            {currentStep === 3 && renderStep3()}

            {/* Navigation Buttons */}
            <div className="flex justify-between pt-8 mt-8 border-t border-gray-200">
              <div>
                {currentStep > 1 && (
                  <button
                    type="button"
                    onClick={prevStep}
                    className="flex items-center gap-2 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Back
                  </button>
                )}
              </div>

              <div>
                {currentStep < 3 ? (
                  <button
                    type="button"
                    onClick={nextStep}
                    className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                  >
                    Next
                    <ArrowRight className="w-4 h-4" />
                  </button>
                ) : (
              <button
                type="submit"
                disabled={isSubmitting || isProcessing || !canSubmit}
                className="flex items-center gap-2 px-8 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors text-lg font-medium"
              >
                <Save className="w-5 h-5" />
                {isSubmitting ? 'Creating Poll...' : 'Create Poll'}
              </button>
                )}
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AdminPollCreation;