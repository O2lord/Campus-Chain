"use client"
import React, { useState, useMemo } from 'react';
import { Vote, Clock, Users, CheckCircle, XCircle, Calendar, Trophy, ChevronDown, ChevronUp } from 'lucide-react';
import useElectorateProgram, { PollStatus, PollData, Winner, Candidate } from '@/hooks/useElectorate';
import { useWallet } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { useRouter } from 'next/navigation';
import { getStudentById } from '@/services/studentIdentityService';
import { useSupabaseClient, useUser } from '@supabase/auth-helpers-react';
import { useQuery } from '@tanstack/react-query';

interface PollAccount {
  publicKey: PublicKey;
  account: PollData;
}

const getStatusString = (status: PollStatus): string => {
  switch (status) {
    case PollStatus.Upcoming:
      return "upcoming";
    case PollStatus.Active:
      return "active";
    case PollStatus.Ended:
      return "ended";
    case PollStatus.ResultsDeclared:
      return "results declared";
    default:
      return "unknown";
  }
};

const StudentVotingPage: React.FC = () => {
  const { 
    getPolls, 
    hasUserVoted, 
    getPollStatusString, 
    getPollTypeString, 
    isVotingActive,
    convertPollStatusFromProgram,
    getEffectivePollStatus,
    PollStatus,
  } = useElectorateProgram();
  
  const { publicKey } = useWallet();
  const router = useRouter();
  const [filter, setFilter] = useState<string>('all');
  const [expandedSections, setExpandedSections] = useState<{[key: string]: {positions: boolean, winners: boolean}}>({});
  const user = useUser();
  const supabaseClient = useSupabaseClient();

  // Fetch student data
  const { 
    data: studentData, 
    isLoading: isLoadingStudent 
  } = useQuery({
    queryKey: ['student-data', user?.id],
    queryFn: () => getStudentById(user!.id, supabaseClient),
    enabled: !!user?.id && !!supabaseClient
  });

  // Fetch all polls
  const {
    data: allPolls,
    isLoading: isLoadingPolls,
    error
  } = useQuery({
    queryKey: ['polls'],
    queryFn: async () => {
      const polls = await getPolls.refetch();
      return polls.data || [];
    },
    enabled: !!studentData 
  });

  // Filter polls based on student eligibility
  const relevantPolls = useMemo(() => {
    if (!allPolls || !studentData) return [];
    
    return allPolls.filter((pollAccount) => {
      const poll = pollAccount.account;
      
      // SUG polls are for everyone
      if (poll.pollType?.sug) {
        return true;
      }
      
      // Class polls - check if student's set matches
      if (poll.pollType?.class && poll.className === studentData.set) {
        return true;
      }

      // Departmental polls - check if student's department matches
    { /* TODO: Add department to students table*/}
       if (poll.pollType?.departmental && poll.departmentName === studentData.department) {
        return true;
      }

      return false;
    });
  }, [allPolls, studentData]);

  // Apply status filter to relevant polls
  const filteredPolls = useMemo(() => {
    if (filter === 'all') return relevantPolls;
    
    return relevantPolls.filter((poll: PollAccount) => {
      const effectiveStatus = getEffectivePollStatus(poll.account);
      const statusString = getStatusString(effectiveStatus);
      return statusString === filter;
    });
  }, [relevantPolls, filter, getEffectivePollStatus]);
  
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

  const formatDate = (timestamp: number): string => {
    return new Date(timestamp * 1000).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusColor = (pollData: PollData): string => {
    const status = convertPollStatusFromProgram(pollData.status);
    switch (status) {
      case PollStatus.Upcoming:
        return 'bg-blue-100 text-blue-800';
      case PollStatus.Active:
        return 'bg-green-100 text-green-800';
      case PollStatus.Ended:
        return 'bg-orange-100 text-orange-800';
      case PollStatus.ResultsDeclared:
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
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

  const handleNavigateToElection = (pollId: string) => {
    router.push(`/student/voting/${pollId}`);
  };

  interface PollCardProps {
    poll: PollAccount;
  }

  const PollCard: React.FC<PollCardProps> = ({ poll }) => {
    const pollData = poll.account;
    const userHasVoted = publicKey ? hasUserVoted(pollData, publicKey) : false;
    const votingActive = isVotingActive(pollData);
    const status = convertPollStatusFromProgram(pollData.status);
    const onChainStatus = convertPollStatusFromProgram(pollData.status);
    const showResults = status === PollStatus.ResultsDeclared;
    const pollId = poll.publicKey.toString();
    
    const totalCandidates = pollData.positions.reduce((sum, pos) => sum + pos.candidates.length, 0);

    return (
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden hover:shadow-xl transition-shadow">
        <div className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                {getPollTypeString(pollData)} Election
              </h3>
              <div className="flex items-center gap-4 text-sm text-gray-600">
                <div className="flex items-center gap-1">
                  <Users className="w-4 h-4" />
                  <span>{totalCandidates} candidates</span>
                </div>
                <div className="flex items-center gap-1">
                  <Vote className="w-4 h-4" />
                  <span>{pollData.voters.length} votes</span>
                </div>
              </div>
            </div>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(pollData)}`}>
              {getPollStatusString(pollData)}
            </span>
          </div>

          <div className="flex items-center justify-between text-sm text-gray-600 mb-4">
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

          {userHasVoted && (
            <div className="flex items-center gap-2 text-green-600 bg-green-50 p-3 rounded-lg mb-4">
              <CheckCircle className="w-5 h-5" />
              <span className="font-medium">You have already voted in this poll</span>
            </div>
          )}

          {/* Collapsible Positions & Candidates Section */}
          {showResults && (
            <div className="mb-6">
              <button
                onClick={() => toggleSection(pollId, 'positions')}
                className="flex items-center justify-between w-full text-sm font-medium text-gray-900 mb-2 hover:text-indigo-600 transition-colors"
              >
                <span>Positions & Vote Counts</span>
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
                        {position.candidates.map((candidate: Candidate, candidateIndex: number) => (
                          <div key={candidateIndex} className="flex items-center justify-between text-xs text-gray-700">
                            <span>{candidate.name} ({candidate.department})</span>
                            <span className="font-medium">{candidate.voteCount.toNumber()} votes</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Collapsible Declared Winners Section */}
          {onChainStatus === PollStatus.ResultsDeclared && pollData.winners && pollData.winners.length > 0 && (
            <div className="mb-6">
              <button
                onClick={() => toggleSection(pollId, 'winners')}
                className="flex items-center justify-between w-full text-sm font-medium text-gray-900 mb-2 hover:text-indigo-600 transition-colors"
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
                    const winningPosition = pollData.positions.find(p => p.name === winner.position);

                    return (
                      <div key={winnerIndex} className={isTie 
                        ? "p-3 bg-yellow-50 border border-yellow-200 rounded-lg"
                        : "p-3 bg-green-50 border border-green-200 rounded-lg"}>
                        <div className="flex items-center justify-between mb-2">
                          <span className={isTie ? "text-sm font-semibold text-yellow-800" : "text-sm font-semibold text-green-800"}>
                            {winner.position}
                          </span>
                          <div className="flex items-center space-x-2">
                            <span className={isTie ? "text-sm text-yellow-700" : "text-sm text-green-700"}>
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
                              <div key={idx} className={isTie ? "text-sm text-yellow-700" : "text-sm text-green-700"}>
                                <Trophy className={isTie ? "h-3 w-3 text-yellow-500 mr-1" : "h-3 w-3 text-green-500 mr-1"} />
                                <span className={isTie ? "font-medium text-yellow-700" : "font-medium text-green-700"}>{candidate.name}</span>
                                <span className={isTie ? "ml-2 text-yellow-600" : "ml-2 text-green-600"}>({candidate.department})</span>
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

          <div className="flex gap-3">
            {votingActive && !userHasVoted && publicKey && (
              <button
                onClick={() => handleNavigateToElection(poll.publicKey.toString())}
                className="flex-1 bg-indigo-600 text-white py-2 px-4 rounded-lg hover:bg-indigo-700 transition-colors font-medium"
              >
                Vote Now
              </button>
            )}
            
            {showResults ? (
              <button
                onClick={() => handleNavigateToElection(poll.publicKey.toString())}
                className="flex-1 bg-purple-600 text-white py-2 px-4 rounded-lg hover:bg-purple-700 transition-colors font-medium"
              >
                View Full Results
              </button>
            ) : (
              <button
                onClick={() => handleNavigateToElection(poll.publicKey.toString())}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                View Details
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Loading state
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

  if (isLoadingStudent || isLoadingPolls) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-blue-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your elections...</p>
        </div>
      </div>
    );
  }

  if (!studentData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-blue-100 flex items-center justify-center">
        <div className="text-center">
          <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Student Profile Not Found</h1>
          <p className="text-gray-600">Your student profile could not be found. Please contact an administrator.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-blue-100">
      <div className="max-w-6xl mx-auto p-6">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Student Elections</h1>
          <p className="text-gray-600">
            Participate in your campus elections and make your voice heard
            {studentData.set && <span className="ml-2 font-medium">• {studentData.set}</span>}
          </p>
        </div>

        {/* Filter Tabs */}
        <div className="mb-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-1">
            <div className="flex space-x-1">
              {[
                { key: 'all', label: 'All Elections' },
                { key: 'upcoming', label: 'Upcoming' },
                { key: 'active', label: 'Active' },
                { key: 'results declared', label: 'Results' }
              ].map((filterOption) => (
                <button
                  key={filterOption.key}
                  onClick={() => setFilter(filterOption.key)}
                  className={`flex-1 py-2 px-4 rounded-md font-medium text-sm transition-colors ${
                    filter === filterOption.key
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-gray-700 hover:text-indigo-600 hover:bg-indigo-50'
                  }`}
                >
                  {filterOption.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {error && (
          <div className="text-center py-12">
            <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <p className="text-red-600">Failed to load elections. Please try again.</p>
          </div>
        )}

        {!error && filteredPolls.length === 0 && (
          <div className="text-center py-12">
            <Vote className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {filter === 'all' ? 'No Elections Available' : `No ${filter.charAt(0).toUpperCase() + filter.slice(1)} Elections`}
            </h3>
            <p className="text-gray-600">
              {filter === 'all' 
                ? "No elections available for your class/department at the moment" 
                : `No ${filter} elections found. Check back later or try a different filter.`}
            </p>
          </div>
        )}

        {!error && filteredPolls.length > 0 && (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredPolls.map((poll: PollAccount) => (
              <PollCard key={poll.publicKey.toString()} poll={poll} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default StudentVotingPage;