/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/electorate.json`.
 */
export type Electorate = {
  "address": "AQf2TBGA4qb8SVAKYUvamqsLCgU5Q65jyhWmgQudTVgo",
  "metadata": {
    "name": "electorate",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Created with Anchor"
  },
  "instructions": [
    {
      "name": "castVote",
      "discriminator": [
        20,
        212,
        15,
        189,
        69,
        180,
        69,
        151
      ],
      "accounts": [
        {
          "name": "poll",
          "writable": true
        },
        {
          "name": "voter",
          "signer": true
        }
      ],
      "args": [
        {
          "name": "votes",
          "type": {
            "vec": {
              "defined": {
                "name": "voteChoice"
              }
            }
          }
        }
      ]
    },
    {
      "name": "declareResults",
      "discriminator": [
        144,
        1,
        27,
        248,
        166,
        4,
        11,
        229
      ],
      "accounts": [
        {
          "name": "poll",
          "writable": true
        },
        {
          "name": "authority",
          "signer": true,
          "relations": [
            "poll"
          ]
        }
      ],
      "args": []
    },
    {
      "name": "endVoting",
      "discriminator": [
        161,
        71,
        151,
        11,
        247,
        132,
        219,
        142
      ],
      "accounts": [
        {
          "name": "poll",
          "writable": true
        },
        {
          "name": "authority",
          "signer": true
        }
      ],
      "args": []
    },
    {
      "name": "initializePoll",
      "discriminator": [
        193,
        22,
        99,
        197,
        18,
        33,
        115,
        117
      ],
      "accounts": [
        {
          "name": "poll",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  111,
                  108,
                  108
                ]
              },
              {
                "kind": "account",
                "path": "authority"
              },
              {
                "kind": "arg",
                "path": "pollId"
              }
            ]
          }
        },
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "pollId",
          "type": "u64"
        },
        {
          "name": "pollType",
          "type": {
            "defined": {
              "name": "pollType"
            }
          }
        },
        {
          "name": "className",
          "type": {
            "option": "string"
          }
        },
        {
          "name": "departmentName",
          "type": {
            "option": "string"
          }
        },
        {
          "name": "startTime",
          "type": "i64"
        },
        {
          "name": "endTime",
          "type": "i64"
        },
        {
          "name": "positions",
          "type": {
            "vec": {
              "defined": {
                "name": "electionPosition"
              }
            }
          }
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "poll",
      "discriminator": [
        110,
        234,
        167,
        188,
        231,
        136,
        153,
        111
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "tooManyCandidates",
      "msg": "Too many candidates provided. Maximum is 5."
    },
    {
      "code": 6001,
      "name": "noCandidates",
      "msg": "No candidates provided."
    },
    {
      "code": 6002,
      "name": "invalidTimeRange",
      "msg": "Invalid time range. Start time must be before end time."
    },
    {
      "code": 6003,
      "name": "endTimeInPast",
      "msg": "End time cannot be in the past."
    },
    {
      "code": 6004,
      "name": "votingNotStarted",
      "msg": "Voting has not started yet."
    },
    {
      "code": 6005,
      "name": "votingEnded",
      "msg": "Voting has already ended."
    },
    {
      "code": 6006,
      "name": "alreadyVoted",
      "msg": "You have already voted in this poll."
    },
    {
      "code": 6007,
      "name": "invalidCandidateIndex",
      "msg": "Invalid candidate index."
    },
    {
      "code": 6008,
      "name": "votingStillActive",
      "msg": "Voting is still active."
    },
    {
      "code": 6009,
      "name": "votingNotEnded",
      "msg": "Voting has not ended yet."
    },
    {
      "code": 6010,
      "name": "tooManyPositions",
      "msg": "Too many positions (max 10)"
    },
    {
      "code": 6011,
      "name": "noPositions",
      "msg": "No positions provided"
    },
    {
      "code": 6012,
      "name": "invalidPositionIndex",
      "msg": "Invalid position index"
    },
    {
      "code": 6013,
      "name": "emptyPositionName",
      "msg": "Position name cannot be empty"
    },
    {
      "code": 6014,
      "name": "duplicatePositionName",
      "msg": "Duplicate position name"
    },
    {
      "code": 6015,
      "name": "invalidMaxSelections",
      "msg": "Invalid max selections for position"
    },
    {
      "code": 6016,
      "name": "noVotesProvided",
      "msg": "No votes provided"
    },
    {
      "code": 6017,
      "name": "tooManyVoteChoices",
      "msg": "Too many vote choices"
    },
    {
      "code": 6018,
      "name": "duplicatePositionVote",
      "msg": "Cannot vote for the same position twice"
    },
    {
      "code": 6019,
      "name": "noCandidatesSelected",
      "msg": "No candidates selected for position"
    },
    {
      "code": 6020,
      "name": "tooManyCandidatesSelected",
      "msg": "Too many candidates selected for this position"
    },
    {
      "code": 6021,
      "name": "duplicateCandidateSelection",
      "msg": "Cannot select the same candidate twice"
    },
    {
      "code": 6022,
      "name": "tooManyCandidatesPerPosition",
      "msg": "Too many candidates (max 5 per position)"
    },
    {
      "code": 6023,
      "name": "noCandidatesInPosition",
      "msg": "No candidates provided for position"
    },
    {
      "code": 6024,
      "name": "invalidPollTypeParameters",
      "msg": "Invalid Poll type param"
    },
    {
      "code": 6025,
      "name": "emptyClassName",
      "msg": "Class name is Empty"
    },
    {
      "code": 6026,
      "name": "emptyDepartmentName",
      "msg": "Department name is Empty"
    }
  ],
  "types": [
    {
      "name": "candidate",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "name",
            "type": "string"
          },
          {
            "name": "department",
            "type": "string"
          },
          {
            "name": "motto",
            "type": "string"
          },
          {
            "name": "voteCount",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "electionPosition",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "name",
            "type": "string"
          },
          {
            "name": "candidates",
            "type": {
              "vec": {
                "defined": {
                  "name": "candidate"
                }
              }
            }
          },
          {
            "name": "maxSelections",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "poll",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "pollId",
            "type": "u64"
          },
          {
            "name": "pollType",
            "type": {
              "defined": {
                "name": "pollType"
              }
            }
          },
          {
            "name": "startTime",
            "type": "i64"
          },
          {
            "name": "endTime",
            "type": "i64"
          },
          {
            "name": "status",
            "type": {
              "defined": {
                "name": "pollStatus"
              }
            }
          },
          {
            "name": "positions",
            "type": {
              "vec": {
                "defined": {
                  "name": "electionPosition"
                }
              }
            }
          },
          {
            "name": "totalVotes",
            "type": "u64"
          },
          {
            "name": "voters",
            "type": {
              "vec": "pubkey"
            }
          },
          {
            "name": "winners",
            "type": {
              "vec": {
                "defined": {
                  "name": "winner"
                }
              }
            }
          },
          {
            "name": "className",
            "type": {
              "option": "string"
            }
          },
          {
            "name": "departmentName",
            "type": {
              "option": "string"
            }
          }
        ]
      }
    },
    {
      "name": "pollStatus",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "upcoming"
          },
          {
            "name": "active"
          },
          {
            "name": "ended"
          },
          {
            "name": "resultsDeclared"
          }
        ]
      }
    },
    {
      "name": "pollType",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "class"
          },
          {
            "name": "departmental"
          },
          {
            "name": "sug"
          }
        ]
      }
    },
    {
      "name": "voteChoice",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "positionIndex",
            "type": "u32"
          },
          {
            "name": "candidateIndices",
            "type": {
              "vec": "u32"
            }
          }
        ]
      }
    },
    {
      "name": "winner",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "position",
            "type": "string"
          },
          {
            "name": "candidateIndices",
            "type": {
              "vec": "u32"
            }
          },
          {
            "name": "voteCount",
            "type": "u64"
          },
          {
            "name": "isTie",
            "type": "bool"
          }
        ]
      }
    }
  ]
};
