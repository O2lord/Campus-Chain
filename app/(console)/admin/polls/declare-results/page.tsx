"use client"
import React, { useState, useMemo } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { Clock, Users, CheckCircle, XCircle, AlertTriangle, Calendar, Trophy, ChevronDown, ChevronUp, Eye, User } from 'lucide-react';
import useElectorateProgram, { 
  PollData, 
  PollStatus, 
  ElectionPosition, 
  Candidate,
  Winner 
} from '@/hooks/useElectorate';
import { useSupabaseClient } from '@supabase/auth-helpers-react';
import { useQuery } from '@tanstack/react-query';
import { getCandidateImageMetadataForPoll, PollCandidateMetadata } from '@/services/electorateService';
import Image from 'next/image';

interface PollAccount {
  publicKey: PublicKey;
  account: PollData;
}

// Candidate Image Component
const CandidateImage: React.FC<{
  imageUrl?: string;
  candidateName: string;
  className?: string;
}> = ({ imageUrl, candidateName, className = "w-12 h-12 object-cover rounded-full" }) => {
  const [imageError, setImageError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  if (!imageUrl || imageError) {
    return (
      <div className={`${className} bg-gray-200 flex items-center justify-center rounded-full`}>
        <User className="w-4 h-4 text-gray-400" />
      </div>
    );
  }

  return (
    <div className="relative">
      {isLoading && (
        <div className={`${className} bg-gray-200 animate-pulse rounded-full`} />
      )}
      <Image
        width={48}
        height={48}
        src={imageUrl}
        alt={candidateName}
        className={`${className} ${isLoading ? 'opacity-0' : 'opacity-100'} transition-opacity`}
        onError={() => { setImageError(true); setIsLoading(false); }}
        onLoad={() => setIsLoading(false)}
        unoptimized 
      />
    </div>
  );
};

const PollManagementPage: React.FC = () => {
  const { publicKey, connected } = useWallet();
  const [selectedPoll, setSelectedPoll] = useState<PollAccount | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);
  const [showDetailsModal, setShowDetailsModal] = useState<boolean>(false);
  const [actionType, setActionType] = useState<'end' | 'declare' | ''>('');
  const [filter, setFilter] = useState<string>('all');
  const [expandedSections, setExpandedSections] = useState<{[key: string]: {positions: boolean, winners: boolean}}>({});
  const supabaseClient = useSupabaseClient();

  const {
    getPolls,
    endVoting,
    declareResults,
    getPollStatusString,
    getPollTypeString,
    getEffectivePollStatus,
    convertPollStatusFromProgram,
    isProcessing,
    PollStatus,
  } = useElectorateProgram();

  const userPolls = useMemo(() => {
    if (!publicKey || !getPolls.data) return [];
    
    return getPolls.data.filter((poll: PollAccount) => 
      poll.account.authority.equals(publicKey)
    );
  }, [getPolls.data, publicKey]);

  const filteredPolls = useMemo(() => {
    if (filter === 'all') return userPolls;
    
    return userPolls.filter((poll: PollAccount) => {
      const status = getPollStatusString(poll.account).toLowerCase();
      return status === filter;
    });
  }, [userPolls, filter, getPollStatusString]);

  // Fetch candidate images for the selected poll in details view
  const { data: candidateImages } = useQuery<PollCandidateMetadata[]>({
    queryKey: ['candidateImages', selectedPoll?.publicKey.toString()],
    queryFn: () => getCandidateImageMetadataForPoll(selectedPoll!.publicKey.toString(), supabaseClient),
    enabled: !!selectedPoll && !!supabaseClient && showDetailsModal,
  });

  const formatDate = (timestamp: number): string => {
    return new Date(timestamp * 1000).toLocaleString();
  };

  const getStatusString = (status: PollStatus): string => {
    switch (status) {
      case PollStatus.Upcoming:
        return "Upcoming";
      case PollStatus.Active:
        return "Active";
      case PollStatus.Ended:
        return "Ended";
      case PollStatus.ResultsDeclared:
        return "Results Declared";
      default:
        return "Unknown";
    }
  };

  const getTotalVotes = (positions: ElectionPosition[]): number => {
    return positions.reduce((total: number, position: ElectionPosition) =>
      total + position.candidates.reduce((posTotal, candidate) => posTotal + candidate.voteCount.toNumber(), 0)
    , 0);
  };

  const toggleSection = (pollId: string, section: 'positions' | 'winners') => {
    setExpandedSections(prev => ({
      ...prev,
      [pollId]: {
        ...prev[pollId],
        [section]: !prev[pollId]?.[section]
      }
    }));
  };

  const isSectionExpanded = (pollId: string, section: 'positions' | 'winners'): boolean => {
    return expandedSections[pollId]?.[section] || false;
  };

  // Check if a candidate is a winner
  const isWinner = (pollData: PollData, positionIndex: number, candidateIndex: number): boolean => {
    if (!pollData.winners || pollData.winners.length === 0) return false;
    const position = pollData.positions[positionIndex];
    return pollData.winners.some((winner: Winner) => 
      winner.position === position.name && 
      winner.candidateIndices.includes(candidateIndex)
    );
  };

  const handleEndVoting = async (pollPubkey: PublicKey): Promise<void> => {
    try {
      await endVoting.mutateAsync({ pollPubkey: pollPubkey.toString() });
      await getPolls.refetch();
      setShowConfirmModal(false);
      setSelectedPoll(null);
    } catch (error) {
      console.error('Error ending voting:', error);
    }
  };

  const handleDeclareResults = async (pollPubkey: PublicKey): Promise<void> => {
    try {
      await declareResults.mutateAsync({ pollPubkey: pollPubkey.toString() });
      await getPolls.refetch();
      setShowConfirmModal(false);
      setSelectedPoll(null);
    } catch (error) {
      console.error('Error declaring results:', error);
    }
  };

  const openConfirmModal = (poll: PollAccount, action: 'end' | 'declare'): void => {
    setSelectedPoll(poll);
    setActionType(action);
    setShowConfirmModal(true);
  };

  const openDetailsModal = (poll: PollAccount): void => {
    setSelectedPoll(poll);
    setShowDetailsModal(true);
  };

  const getStatusBadge = (status: string): string => {
    const baseClasses = "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium";
    
    switch (status.toLowerCase()) {
      case 'upcoming':
        return `${baseClasses} bg-blue-100 text-blue-800`;
      case 'active':
        return `${baseClasses} bg-green-100 text-green-800`;
      case 'ended':
        return `${baseClasses} bg-yellow-100 text-yellow-800`;
      case 'results declared':
        return `${baseClasses} bg-purple-100 text-purple-800`;
      default:
        return `${baseClasses} bg-gray-100 text-gray-800`;
    }
  };

  const getCandidateImageUrl = (positionIndex: number, candidateIndex: number): string | undefined => {
    if (!candidateImages) return undefined;
    const image = candidateImages.find(
      img => img.position_index === positionIndex && img.candidate_index === candidateIndex
    );
    return image?.image_url;
  };

  if (getPolls.error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-md text-center">
          <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Error Loading Polls</h2>
          <p className="text-gray-600 mb-4">Failed to load polls from the blockchain.</p>
          <button
            onClick={() => getPolls.refetch()}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!connected) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-md text-center">
          <AlertTriangle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Wallet Not Connected</h2>
          <p className="text-gray-600">Please connect your wallet to manage polls.</p>
        </div>
      </div>
    );
  }

  if (getPolls.isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Poll Management</h1>
          <p className="text-gray-600">Manage your polls, end voting, and declare results</p>
        </div>

        {/* Filter Tabs */}
        <div className="mb-6">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              {['all', 'upcoming', 'active', 'ended', 'results declared'].map((filterOption) => (
                <button
                  key={filterOption}
                  onClick={() => setFilter(filterOption)}
                  className={`py-2 px-1 border-b-2 font-medium text-sm capitalize ${
                    filter === filterOption
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {filterOption}
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Polls Grid */}
        {filteredPolls.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Polls Found</h3>
            <p className="text-gray-600">
              {filter === 'all' 
                ? "You haven't created any polls yet." 
                : `No ${filter} polls found.`}
            </p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredPolls.map((poll: PollAccount) => {
              const pollData = poll.account;
              const currentEffectiveStatusEnum = getEffectivePollStatus(pollData);
              const onChainStatus = convertPollStatusFromProgram(pollData.status);
              const statusString = getStatusString(currentEffectiveStatusEnum);
              const pollType = getPollTypeString(pollData);
              const totalVotes = getTotalVotes(pollData.positions);
              const pollId = poll.publicKey.toString();
              
              return (
                <div key={pollId} className="bg-white rounded-lg shadow-md p-6">
                  {/* Poll Header */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-2">
                      <span className="text-lg font-semibold text-gray-900">
                        Poll #{pollData.pollId.toNumber()}
                      </span>
                      <span className={getStatusBadge(statusString)}>
                        {statusString}
                      </span>
                    </div>
                    <span className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded">
                      {pollType}
                    </span>
                  </div>

                  {/* Poll Details */}
                  <div className="space-y-3 mb-6">
                    <div className="flex items-center text-sm text-gray-600">
                      <Calendar className="h-4 w-4 mr-2" />
                      <span>Started: {formatDate(pollData.startTime.toNumber())}</span>
                    </div>
                    <div className="flex items-center text-sm text-gray-600">
                      <Clock className="h-4 w-4 mr-2" />
                      <span>Ends: {formatDate(pollData.endTime.toNumber())}</span>
                    </div>
                    <div className="flex items-center text-sm text-gray-600">
                      <Users className="h-4 w-4 mr-2" />
                      <span>{totalVotes} total votes cast</span>
                    </div>
                  </div>

                  {/* Collapsible Positions & Candidates Section */}
                  <div className="mb-6">
                    <button
                      onClick={() => toggleSection(pollId, 'positions')}
                      className="flex items-center justify-between w-full text-sm font-medium text-gray-900 mb-2 hover:text-blue-600 transition-colors"
                    >
                      <span>Positions & Candidates</span>
                      {isSectionExpanded(pollId, 'positions') ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </button>
                    
                    {isSectionExpanded(pollId, 'positions') && (
                      <div className="space-y-4 transition-all duration-200">
                        {pollData.positions.map((position, positionIndex) => (
                          <div key={positionIndex} className="bg-gray-50 p-3 rounded">
                            <p className="text-sm font-semibold text-gray-800 mb-2">{position.name} (Max selections: {position.maxSelections})</p>
                            <div className="space-y-1 pl-2 border-l border-gray-200">
                              {position.candidates.map((candidate: Candidate, candidateIndex: number) => {
                                const isWinnerCandidate = isWinner(pollData, positionIndex, candidateIndex);
                                return (
                                  <div key={candidateIndex} className="flex items-center justify-between text-xs text-gray-700">
                                    <span className="flex items-center gap-1">
                                      {isWinnerCandidate && <Trophy className="w-3 h-3 text-yellow-500" />}
                                      {candidate.name} ({candidate.department})
                                    </span>
                                    <span className="font-medium">{candidate.voteCount.toNumber()} votes</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Collapsible Declared Winners Section */}
                  {onChainStatus === PollStatus.ResultsDeclared && pollData.winners && pollData.winners.length > 0 && (
                    <div className="mb-6">
                      <button
                        onClick={() => toggleSection(pollId, 'winners')}
                        className="flex items-center justify-between w-full text-sm font-medium text-gray-900 mb-2 hover:text-blue-600 transition-colors"
                      >
                        <span className="flex items-center">
                          <Trophy className="h-4 w-4 text-yellow-500 mr-1" />
                          Declared Winners
                        </span>
                        {isSectionExpanded(pollId, 'winners') ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </button>
                      
                      {isSectionExpanded(pollId, 'winners') && (
                        <div className="space-y-3 transition-all duration-200">
                          {(pollData.winners as Winner[]).map((winner: Winner, winnerIndex: number) => {
                            const isTie = winner.isTie;
                            const containerClasses = isTie 
                              ? "p-3 bg-yellow-50 border border-yellow-200 rounded-lg"
                              : "p-3 bg-green-50 border border-green-200 rounded-lg";
                            
                            const positionTextClasses = isTie 
                              ? "text-sm font-semibold text-yellow-800"
                              : "text-sm font-semibold text-green-800";
                            
                            const voteTextClasses = isTie 
                              ? "text-sm text-yellow-700"
                              : "text-sm text-green-700";
                            
                            const candidateTextClasses = isTie 
                              ? "text-sm text-yellow-700 flex items-center gap-1"
                              : "text-sm text-green-700 flex items-center gap-1";
                            
                            const candidateNameClasses = isTie 
                              ? "font-medium text-yellow-700"
                              : "font-medium text-green-700";
                            
                            const candidateDeptClasses = isTie 
                              ? "ml-2 text-yellow-600"
                              : "ml-2 text-green-600";
                            
                            const trophyIconClasses = isTie 
                              ? "h-3 w-3 text-yellow-500"
                              : "h-3 w-3 text-green-500";

                            const winningPosition = pollData.positions.find(p => p.name === winner.position);

                            return (
                              <div key={winnerIndex} className={containerClasses}>
                                <div className="flex items-center justify-between mb-2">
                                  <span className={positionTextClasses}>
                                    {winner.position}
                                  </span>
                                  <div className="flex items-center space-x-2">
                                    <span className={voteTextClasses}>
                                      {winner.voteCount.toNumber()} votes
                                    </span>
                                    {winner.isTie && (
                                      <span className="px-2 py-1 bg-yellow-200 text-yellow-800 text-xs rounded-full">
                                        TIE
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <div className="space-y-1">
                                  {winningPosition && winner.candidateIndices.map((candidateIndex: number, idx: number) => {
                                    const candidate = winningPosition.candidates[candidateIndex];
                                    return candidate ? (
                                      <div key={idx} className={candidateTextClasses}>
                                        <Trophy className={trophyIconClasses} />
                                        <span className={candidateNameClasses}>{candidate.name}</span>
                                        <span className={candidateDeptClasses}>({candidate.department})</span>
                                      </div>
                                    ) : null;
                                  })}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex space-x-2">
                    <button
                      onClick={() => openDetailsModal(poll)}
                      className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 flex items-center justify-center gap-2"
                    >
                      <Eye className="w-4 h-4" />
                      View Details
                    </button>
                    
                    {onChainStatus !== PollStatus.Ended && onChainStatus !== PollStatus.ResultsDeclared && (
                      <button
                        onClick={() => openConfirmModal(poll, 'end')}
                        disabled={isProcessing}
                        className="flex-1 bg-red-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isProcessing ? 'Processing...' : 'End Voting'}
                      </button>
                    )}
                    
                    {onChainStatus === PollStatus.Ended && (
                      <button
                        onClick={() => openConfirmModal(poll, 'declare')}
                        disabled={isProcessing}
                        className="flex-1 bg-green-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isProcessing ? 'Processing...' : 'Declare Results'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Details Modal */}
        {showDetailsModal && selectedPoll && (
          <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">
                    Poll #{selectedPoll.account.pollId.toNumber()} - {getPollTypeString(selectedPoll.account)}
                  </h2>
                  <p className="text-gray-600 mt-1">Admin View - View Only</p>
                </div>
                <button
                  onClick={() => setShowDetailsModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XCircle className="w-6 h-6" />
                </button>
              </div>

              <div className="p-6">
                {/* Poll Info */}
                <div className="mb-6 grid grid-cols-2 gap-4">
                  <div className="flex items-center text-sm text-gray-600">
                    <Calendar className="h-4 w-4 mr-2" />
                    <span>Started: {formatDate(selectedPoll.account.startTime.toNumber())}</span>
                  </div>
                  <div className="flex items-center text-sm text-gray-600">
                    <Clock className="h-4 w-4 mr-2" />
                    <span>Ends: {formatDate(selectedPoll.account.endTime.toNumber())}</span>
                  </div>
                  <div className="flex items-center text-sm text-gray-600">
                    <Users className="h-4 w-4 mr-2" />
                    <span>{getTotalVotes(selectedPoll.account.positions)} total votes</span>
                  </div>
                  <div className="flex items-center text-sm">
                    <span className={getStatusBadge(getStatusString(getEffectivePollStatus(selectedPoll.account)))}>
                      {getStatusString(getEffectivePollStatus(selectedPoll.account))}
                    </span>
                  </div>
                </div>

                {/* Positions and Candidates */}
                <div className="space-y-6">
                  {selectedPoll.account.positions.map((position, positionIndex) => {
                    const showResults = convertPollStatusFromProgram(selectedPoll.account.status) === PollStatus.ResultsDeclared;
                    const totalPositionVotes = position.candidates.reduce((sum: number, c: Candidate) => sum + c.voteCount.toNumber(), 0);

                    return (
                      <div key={positionIndex}>
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">
                          {position.name} (Max selections: {position.maxSelections})
                        </h3>
                        <div className="space-y-3">
                          {position.candidates.map((candidate: Candidate, candidateIndex: number) => {
                            const voteCount = candidate.voteCount.toNumber();
                            const percentage = showResults && totalPositionVotes > 0 ? (voteCount / totalPositionVotes) * 100 : 0;
                            const imageUrl = getCandidateImageUrl(positionIndex, candidateIndex);
                            const isWinnerCandidate = isWinner(selectedPoll.account, positionIndex, candidateIndex);

                            return (
                              <div
                                key={candidateIndex}
                                className="p-4 border rounded-lg bg-gray-50"
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-3 flex-1">
                                    <div className="relative">
                                      <CandidateImage
                                        imageUrl={imageUrl}
                                        candidateName={candidate.name}
                                        className="w-12 h-12 object-cover rounded-full"
                                      />
                                      {isWinnerCandidate && (
                                        <div className="absolute -top-1 -right-1 bg-white rounded-full p-0.5 shadow-sm">
                                          <Trophy className="w-4 h-4 text-yellow-500" />
                                        </div>
                                      )}
                                    </div>
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2">
                                        <h4 className="font-medium text-gray-900">
                                          <span className="text-sm text-gray-600">Name:</span> {candidate.name}
                                        </h4>
                                      </div>
                                      <p className="text-sm text-gray-600 mt-1">
                                        <span className="font-medium">Dept:</span> {candidate.department}
                                      </p>
                                      {candidate.motto && (
                                        <div className="flex items-center gap-4 text-sm text-gray-600 mt-2">
                                          <span className="flex items-center gap-1">
                                            <span className='text-sm font-medium'>Motto:</span>
                                            <p className="text-sm text-gray-700 italic mt-1">
                                              &quot;{candidate.motto}&quot;
                                            </p>
                                          </span>
                                        </div>
                                      )}
                                    </div>
                                  </div>

                                  {showResults && (
                                    <div className="text-right ml-4">
                                      <div className="text-xl font-bold text-gray-900">
                                        {voteCount}
                                      </div>
                                      <div className="text-xs text-gray-600">
                                        {percentage.toFixed(1)}%
                                      </div>
                                    </div>
                                  )}
                                </div>

                                {showResults && (
                                  <div className="mt-3">
                                    <div className="bg-gray-200 rounded-full h-2">
                                      <div
                                        className="bg-indigo-600 h-2 rounded-full transition-all duration-500"
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
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Confirmation Modal */}
        {showConfirmModal && selectedPoll && (
          <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
              <div className="flex items-center mb-4">
                {actionType === 'end' ? (
                  <XCircle className="h-6 w-6 text-red-600 mr-2" />
                ) : (
                  <CheckCircle className="h-6 w-6 text-green-600 mr-2" />
                )}
                <h3 className="text-lg font-medium text-gray-900">
                  {actionType === 'end' ? 'End Voting' : 'Declare Results'}
                </h3>
              </div>
              
              <p className="text-gray-600 mb-6">
                Are you sure you want to {actionType === 'end' ? 'end voting for' : 'declare results for'} Poll #{selectedPoll.account.pollId.toNumber()}? This action cannot be undone.
              </p>
              
              <div className="flex space-x-4">
                <button
                  onClick={() => setShowConfirmModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => 
                    actionType === 'end' 
                      ? handleEndVoting(selectedPoll.publicKey)
                      : handleDeclareResults(selectedPoll.publicKey)
                  }
                  disabled={isProcessing}
                  className={`flex-1 px-4 py-2 text-white rounded-md disabled:opacity-50 disabled:cursor-not-allowed ${
                    actionType === 'end' 
                      ? 'bg-red-600 hover:bg-red-700' 
                      : 'bg-green-600 hover:bg-green-700'
                  }`}
                >
                  {isProcessing ? 'Processing...' : 'Confirm'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PollManagementPage;