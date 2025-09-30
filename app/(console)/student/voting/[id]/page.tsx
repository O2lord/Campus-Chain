"use client"
import React, { useState, useEffect } from 'react';
import { Vote, Clock, Users, Trophy, CheckCircle, ArrowLeft, Calendar, User, Building } from 'lucide-react';
import useElectorateProgram, { PollStatus, PollData, VoteChoiceProgram, Winner } from '@/hooks/useElectorate';
import { useWallet } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { useRouter, useParams } from 'next/navigation';
import { BN } from '@coral-xyz/anchor';
import { getCandidateImageMetadataForPoll, PollCandidateMetadata } from '@/services/electorateService';
import Image from 'next/image';
import { useQuery } from '@tanstack/react-query';
import { useSupabaseClient } from '@supabase/auth-helpers-react';

// Define types for the poll structure
interface PollAccount {
  publicKey: PublicKey;
  account: PollData;
}

interface Candidate {
  name: string;
  department: string;
  motto: string;
  voteCount: BN;
}

interface Position {
  name: string;
  maxSelections: number;
  candidates: Candidate[];
}

// Component for handling candidate images with fallback
const CandidateImage: React.FC<{
  imageUrl?: string;
  candidateName: string;
  className?: string;
}> = ({ imageUrl, candidateName, className = "w-16 h-16 object-cover rounded-full" }) => {
  const [imageError, setImageError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const handleImageError = () => {
    console.log(`Image failed to load for ${candidateName}:`, imageUrl);
    setImageError(true);
    setIsLoading(false);
  };

  const handleImageLoad = () => {
    setIsLoading(false);
    setImageError(false);
  };

  // Don't render anything if no image URL or if there was an error
  if (!imageUrl || imageError) {
    return (
      <div className={`${className} bg-gray-200 flex items-center justify-center rounded-full`}>
        <User className="w-6 h-6 text-gray-400" />
      </div>
    );
  }

  return (
    <div className="relative">
      {isLoading && (
        <div className={`${className} bg-gray-200 animate-pulse rounded-full`} />
      )}
      <Image
        width={64}
        height={64}
        src={imageUrl}
        alt={candidateName}
        className={`${className} ${isLoading ? 'opacity-0' : 'opacity-100'} transition-opacity`}
        onError={handleImageError}
        onLoad={handleImageLoad}
        unoptimized 
      />
    </div>
  );
};

const ElectionDetailPage: React.FC = () => {
  const { 
    getPolls, 
    castVote, 
    hasUserVoted, 
    getPollStatusString, 
    getPollTypeString, 
    isVotingActive,
    convertPollStatusFromProgram,
  } = useElectorateProgram();
  
  const { publicKey } = useWallet();
  const router = useRouter();
  const params = useParams();
  const pollId = params.id as string;
  const supabaseClient = useSupabaseClient();

  const [selectedChoices, setSelectedChoices] = useState<Map<number, Set<number>>>(new Map());
  const [isSubmittingVote, setIsSubmittingVote] = useState<boolean>(false);
  const [voteMessage, setVoteMessage] = useState<string>('');
  const [processedImageUrls, setProcessedImageUrls] = useState<Map<string, string>>(new Map());

  const { data: polls = [], isLoading, error } = getPolls;
  const selectedPoll = polls.find((poll: PollAccount) => 
    poll.publicKey.toString() === pollId
  );

  const { data: candidateImages, isLoading: isLoadingImages } = useQuery<PollCandidateMetadata[]>({
    queryKey: ['candidateImages', pollId],
    queryFn: () => getCandidateImageMetadataForPoll(pollId, supabaseClient),
    enabled: !!selectedPoll && !!supabaseClient,
  });

  // Check if a candidate is a winner
  const isWinner = (pollData: PollData, positionIndex: number, candidateIndex: number): boolean => {
    if (!pollData.winners || pollData.winners.length === 0) return false;
    const position = pollData.positions[positionIndex];
    return pollData.winners.some((winner: Winner) => 
      winner.position === position.name && 
      winner.candidateIndices.includes(candidateIndex)
    );
  };

  // Process image URLs to handle potential issues
  useEffect(() => {
    if (candidateImages) {
      const processImages = async () => {
        const processed = new Map<string, string>();
        
        for (const image of candidateImages) {
          const key = `${image.position_index}-${image.candidate_index}`;
          
          // Check if it's a public URL or if we need to get a signed URL
          if (image.image_url.includes('/storage/v1/object/public/')) {
            // It's a public URL, use as-is but verify it works
            processed.set(key, image.image_url);
          } else {
            // If it's not a public URL, try to get a signed URL
            try {
              const pathMatch = image.image_url.match(/\/storage\/v1\/object\/([^/]+)\/(.+)$/);
              if (pathMatch) {
                const [, bucketName, filePath] = pathMatch;
                const { data: signedUrl } = await supabaseClient.storage
                  .from(bucketName)
                  .createSignedUrl(filePath, 60 * 60); // 1 hour expiry
                
                if (signedUrl?.signedUrl) {
                  processed.set(key, signedUrl.signedUrl);
                } else {
                  processed.set(key, image.image_url); // Fallback to original
                }
              } else {
                processed.set(key, image.image_url);
              }
            } catch (error) {
              console.warn(`Failed to create signed URL for image ${key}:`, error);
              processed.set(key, image.image_url); // Fallback to original
            }
          }
        }
        
        setProcessedImageUrls(processed);
      };
      
      processImages();
    }
  }, [candidateImages, supabaseClient]);

  const formatDate = (timestamp: number): string => {
    return new Date(timestamp * 1000).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getTimeRemaining = (endTime: number): string => {
    const now = Date.now() / 1000;
    const remaining = endTime - now;
    
    if (remaining <= 0) return 'Ended';
    
    const hours = Math.floor(remaining / 3600);
    const minutes = Math.floor((remaining % 3600) / 60);
    
    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `${days}d ${hours % 24}h remaining`;
    }
    
    return `${hours}h ${minutes}m remaining`;
  };

  const handleCandidateSelect = (positionIndex: number, candidateIndex: number): void => {
    setSelectedChoices(prev => {
      const newChoices = new Map(prev);
      const currentSelections = newChoices.get(positionIndex) || new Set();
      const position = selectedPoll?.account.positions[positionIndex];

      if (!position) return prev;

      if (currentSelections.has(candidateIndex)) {
        currentSelections.delete(candidateIndex);
        if (voteMessage.includes('maximum')) {
          setVoteMessage('');
        }
      } else {
        if (currentSelections.size < position.maxSelections) {
          currentSelections.add(candidateIndex);
          if (voteMessage.includes('maximum')) {
            setVoteMessage('');
          }
        } else {
          setVoteMessage(`You can select a maximum of ${position.maxSelections} candidate(s) for ${position.name}.`);
          return prev;
        }
      }
      newChoices.set(positionIndex, currentSelections);
      return newChoices;
    });
  };

  const handleVoteSubmission = async (): Promise<void> => {
    if (!publicKey || !selectedPoll || selectedChoices.size === 0) {
      setVoteMessage('Please select at least one candidate.');
      return;
    }

    setIsSubmittingVote(true);
    setVoteMessage('');

    try {
      const votesToSend: VoteChoiceProgram[] = Array.from(selectedChoices.entries()).map(([posIdx, candSet]) => ({
        positionIndex: posIdx,
        candidateIndices: Array.from(candSet),
      }));

      await castVote.mutateAsync({
        pollPubkey: selectedPoll.publicKey.toString(),
        votes: votesToSend,
      });

      setVoteMessage('Your vote has been cast successfully!');
      setSelectedChoices(new Map());
      
      setTimeout(() => {
        window.location.reload();
      }, 2000);

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      setVoteMessage(`Failed to cast vote: ${errorMessage}`);
    } finally {
      setIsSubmittingVote(false);
    }
  };

  if (!publicKey) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-blue-100 flex items-center justify-center">
        <div className="text-center">
          <Vote className="w-16 h-16 text-indigo-600 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Connect Your Wallet</h1>
          <p className="text-gray-600">Please connect your wallet to view and participate in elections</p>
        </div>
      </div>
    );
  }

  if (isLoading || isLoadingImages) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-blue-100">
        <div className="max-w-4xl mx-auto p-6">
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
            <p className="text-gray-600 mt-4">
              {isLoading ? 'Loading election details...' : 'Loading candidate images...'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !selectedPoll) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-blue-100">
        <div className="max-w-4xl mx-auto p-6">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-indigo-600 hover:text-indigo-800 mb-6"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Elections
          </button>
          
          <div className="text-center py-12">
            <p className="text-red-600">Election not found or failed to load.</p>
          </div>
        </div>
      </div>
    );
  }

  const pollData = selectedPoll.account;
  const userHasVoted = publicKey ? hasUserVoted(pollData, publicKey) : false;
  const votingActive = isVotingActive(pollData);
  const status = convertPollStatusFromProgram(pollData.status);
  const showResults = status === PollStatus.ResultsDeclared;

  const totalCandidates = pollData.positions.reduce((sum, pos) => sum + pos.candidates.length, 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-blue-100">
      <div className="max-w-4xl mx-auto p-6">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-indigo-600 hover:text-indigo-800 mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Elections
        </button>

        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
          {/* Header */}
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">
                  {getPollTypeString(pollData)} Election
                </h1>
                <p className="text-gray-600 mt-2">
                  {votingActive && !userHasVoted ? 'Select candidates to vote for' : 
                   showResults ? 'Election Results' : 'Election Details'}
                </p>
              </div>
              <span className={`px-4 py-2 rounded-full text-sm font-medium ${
                status === PollStatus.Upcoming ? 'bg-blue-100 text-blue-800' :
                status === PollStatus.Active ? 'bg-green-100 text-green-800' :
                status === PollStatus.Ended ? 'bg-orange-100 text-orange-800' :
                status === PollStatus.ResultsDeclared ? 'bg-purple-100 text-purple-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                {getPollStatusString(pollData)}
              </span>
            </div>

            <div className="flex items-center gap-6 mt-4 text-sm text-gray-600">
              <div className="flex items-center gap-1">
                <Users className="w-4 h-4" />
                <span>{totalCandidates} candidates</span>
              </div>
              <div className="flex items-center gap-1">
                <Vote className="w-4 h-4" />
                <span>{pollData.voters.length} votes</span>
              </div>
              <div className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                <span>Ends: {formatDate(pollData.endTime.toNumber())}</span>
              </div>
              {votingActive && (
                <div className="flex items-center gap-1 text-orange-600 font-medium">
                  <Clock className="w-4 h-4" />
                  <span>{getTimeRemaining(pollData.endTime.toNumber())}</span>
                </div>
              )}
            </div>
          </div>

          {/* Content */}
          <div className="p-6">
            {voteMessage && (
              <div className={`mb-6 p-4 rounded-lg ${
                voteMessage.includes('success') ? 'bg-green-50 text-green-700' : 
                voteMessage.includes('maximum') ? 'bg-yellow-50 text-yellow-700' : 
                'bg-red-50 text-red-700'
              }`}>
                {voteMessage}
              </div>
            )}

            {userHasVoted && (
              <div className="flex items-center gap-2 text-green-600 bg-green-50 p-4 rounded-lg mb-6">
                <CheckCircle className="w-5 h-5" />
                <span className="font-medium">You have already voted in this election</span>
              </div>
            )}

            {/* Positions and Candidates */}
            <div className="space-y-8">
              {pollData.positions.map((position: Position, positionIndex: number) => (
                <div key={positionIndex} className="mb-8">
                  <h2 className="text-xl font-semibold text-gray-900 mb-4">
                    {position.name} ({position.maxSelections === 1 ? 'Select 1' : `Select up to ${position.maxSelections}`})
                  </h2>
                  <div className="space-y-4">
                    {position.candidates.map((candidate: Candidate, candidateIndex: number) => {
                      const voteCount = showResults ? candidate.voteCount.toNumber() : 0;
                      const totalPositionVotes = showResults ? position.candidates.reduce((sum, c) => sum + c.voteCount.toNumber(), 0) : 0;
                      const percentage = showResults && totalPositionVotes > 0 ? (voteCount / totalPositionVotes) * 100 : 0;
                      
                      // Get processed image URL
                      const imageKey = `${positionIndex}-${candidateIndex}`;
                      const candidateImageUrl = processedImageUrls.get(imageKey);
                      
                      // Check if this candidate is a winner
                      const isWinnerCandidate = isWinner(pollData, positionIndex, candidateIndex);

                      const isSelected = selectedChoices.get(positionIndex)?.has(candidateIndex) || false;

                      return (
                        <div
                          key={candidateIndex}
                          className={`p-6 border rounded-lg transition-all ${
                            votingActive && !userHasVoted && isSelected
                              ? 'border-indigo-500 bg-indigo-50'
                              : isWinnerCandidate && showResults
                              ? 'border-yellow-400 bg-yellow-50'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-3">
                                {votingActive && !userHasVoted && (
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => handleCandidateSelect(positionIndex, candidateIndex)}
                                    className="w-5 h-5 text-indigo-600 rounded focus:ring-2 focus:ring-indigo-500"
                                  />
                                )}
                                <div className="relative">
                                  <CandidateImage
                                    imageUrl={candidateImageUrl}
                                    candidateName={candidate.name}
                                    className="w-16 h-16 object-cover rounded-full"
                                  />
                                  {isWinnerCandidate && showResults && (
                                    <div className="absolute -top-1 -right-1 bg-white rounded-full p-0.5 shadow-sm">
                                      <Trophy className="w-5 h-5 text-yellow-500" />
                                    </div>
                                  )}
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <h3 className="font-semibold text-gray-900 flex items-center gap-2 text-lg">
                                      <span className='text-sm text-gray-600'>Name:</span>
                                      {candidate.name}
                                    </h3>
                                  </div>
                                  <div className="flex items-center gap-4 text-sm text-gray-600 mt-2">
                                    <span className="flex items-center gap-1">
                                      <span className='text-sm font-medium'>Dept:</span>
                                      {candidate.department}
                                    </span>
                                  </div>
                                  {candidate.motto && (
                                    <div className="flex items-center gap-4 text-sm text-gray-600 mt-2">
                                      <span className="flex items-center gap-1">
                                        <span className='text-sm font-medium'>Motto:</span>
                                        <p className="text-sm text-gray-700 italic">
                                          &quot;{candidate.motto}&quot;
                                        </p>
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>

                            {showResults && (
                              <div className="text-right ml-4">
                                <div className="text-2xl font-bold text-gray-900">
                                  {voteCount}
                                </div>
                                <div className="text-sm text-gray-600">
                                  {percentage.toFixed(1)}% of votes
                                </div>
                              </div>
                            )}
                          </div>

                          {showResults && (
                            <div className="mt-4">
                              <div className="bg-gray-200 rounded-full h-3">
                                <div
                                  className={`h-3 rounded-full transition-all duration-500 ${
                                    isWinnerCandidate ? 'bg-yellow-500' : 'bg-indigo-600'
                                  }`}
                                  style={{ width: `${percentage}%` }}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Voting Actions */}
            {votingActive && !userHasVoted && publicKey && (
              <div className="mt-8 pt-6 border-t border-gray-200">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">
                    {Array.from(selectedChoices.values()).reduce((sum, set) => sum + set.size, 0)} candidate(s) selected
                  </span>
                  <button
                    onClick={handleVoteSubmission}
                    disabled={Array.from(selectedChoices.values()).every(set => set.size === 0) || isSubmittingVote}
                    className="bg-indigo-600 text-white px-8 py-3 rounded-lg hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium text-lg"
                  >
                    {isSubmittingVote ? 'Submitting Vote...' : 'Submit Vote'}
                  </button>
                </div>
              </div>
            )}

            {showResults && (
              <div className="mt-8 pt-6 border-t border-gray-200">
                <div className="flex items-center justify-center gap-2 text-purple-600">
                  <Trophy className="w-6 h-6" />
                  <span className="font-medium text-lg">Results have been declared</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ElectionDetailPage;