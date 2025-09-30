/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/scholarship.json`.
 */
export type Scholarship = {
  "address": "4H4ofPc8YbCmYHUdaKWz6imFVYBpxPdbcqJHmWf9BvvS",
  "metadata": {
    "name": "scholarship",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Created with Anchor"
  },
  "instructions": [
    {
      "name": "approveScholarship",
      "discriminator": [
        202,
        220,
        35,
        215,
        127,
        216,
        193,
        107
      ],
      "accounts": [
        {
          "name": "lecturer",
          "writable": true,
          "signer": true,
          "relations": [
            "scholarship"
          ]
        },
        {
          "name": "student",
          "writable": true
        },
        {
          "name": "scholarship",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  99,
                  104,
                  111,
                  108,
                  97,
                  114,
                  115,
                  104,
                  105,
                  112
                ]
              },
              {
                "kind": "account",
                "path": "lecturer"
              },
              {
                "kind": "account",
                "path": "scholarship.seed",
                "account": "scholarship"
              }
            ]
          }
        },
        {
          "name": "mint",
          "relations": [
            "scholarship"
          ]
        },
        {
          "name": "scholarshipVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "scholarship"
              },
              {
                "kind": "account",
                "path": "tokenProgram"
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "studentTokenAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "student"
              },
              {
                "kind": "account",
                "path": "tokenProgram"
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "globalState",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  103,
                  108,
                  111,
                  98,
                  97,
                  108,
                  45,
                  115,
                  99,
                  104,
                  111,
                  108,
                  97,
                  114,
                  115,
                  104,
                  105,
                  112,
                  45,
                  115,
                  116,
                  97,
                  116,
                  101
                ]
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "tokenProgram"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        }
      ],
      "args": [
        {
          "name": "requestIndex",
          "type": "u8"
        },
        {
          "name": "approvedAmount",
          "type": "u64"
        },
        {
          "name": "lecturerResponse",
          "type": "string"
        }
      ]
    },
    {
      "name": "createScholarshipPool",
      "discriminator": [
        76,
        59,
        152,
        40,
        243,
        176,
        7,
        241
      ],
      "accounts": [
        {
          "name": "lecturer",
          "writable": true,
          "signer": true
        },
        {
          "name": "mint"
        },
        {
          "name": "lecturerTokenAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "lecturer"
              },
              {
                "kind": "account",
                "path": "tokenProgram"
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "scholarship",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  99,
                  104,
                  111,
                  108,
                  97,
                  114,
                  115,
                  104,
                  105,
                  112
                ]
              },
              {
                "kind": "account",
                "path": "lecturer"
              },
              {
                "kind": "arg",
                "path": "seed"
              }
            ]
          }
        },
        {
          "name": "scholarshipVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "scholarship"
              },
              {
                "kind": "account",
                "path": "tokenProgram"
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "globalState",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  103,
                  108,
                  111,
                  98,
                  97,
                  108,
                  45,
                  115,
                  99,
                  104,
                  111,
                  108,
                  97,
                  114,
                  115,
                  104,
                  105,
                  112,
                  45,
                  115,
                  116,
                  97,
                  116,
                  101
                ]
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "tokenProgram"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        }
      ],
      "args": [
        {
          "name": "seed",
          "type": "u64"
        },
        {
          "name": "amount",
          "type": "u64"
        },
        {
          "name": "scholarshipPurpose",
          "type": "string"
        },
        {
          "name": "maxRequestAmount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "rejectScholarship",
      "discriminator": [
        16,
        230,
        14,
        5,
        79,
        118,
        187,
        255
      ],
      "accounts": [
        {
          "name": "lecturer",
          "writable": true,
          "signer": true,
          "relations": [
            "scholarship"
          ]
        },
        {
          "name": "scholarship",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  99,
                  104,
                  111,
                  108,
                  97,
                  114,
                  115,
                  104,
                  105,
                  112
                ]
              },
              {
                "kind": "account",
                "path": "scholarship.lecturer",
                "account": "scholarship"
              },
              {
                "kind": "account",
                "path": "scholarship.seed",
                "account": "scholarship"
              }
            ]
          }
        },
        {
          "name": "globalState",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  103,
                  108,
                  111,
                  98,
                  97,
                  108,
                  45,
                  115,
                  99,
                  104,
                  111,
                  108,
                  97,
                  114,
                  115,
                  104,
                  105,
                  112,
                  45,
                  115,
                  116,
                  97,
                  116,
                  101
                ]
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "requestIndex",
          "type": "u8"
        },
        {
          "name": "lecturerResponse",
          "type": "string"
        }
      ]
    },
    {
      "name": "requestScholarship",
      "discriminator": [
        236,
        113,
        0,
        3,
        60,
        247,
        71,
        144
      ],
      "accounts": [
        {
          "name": "student",
          "writable": true,
          "signer": true
        },
        {
          "name": "lecturer",
          "writable": true,
          "relations": [
            "scholarship"
          ]
        },
        {
          "name": "scholarship",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  99,
                  104,
                  111,
                  108,
                  97,
                  114,
                  115,
                  104,
                  105,
                  112
                ]
              },
              {
                "kind": "account",
                "path": "scholarship.lecturer",
                "account": "scholarship"
              },
              {
                "kind": "account",
                "path": "scholarship.seed",
                "account": "scholarship"
              }
            ]
          }
        },
        {
          "name": "mint",
          "relations": [
            "scholarship"
          ]
        },
        {
          "name": "studentTokenAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "student"
              },
              {
                "kind": "account",
                "path": "tokenProgram"
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "scholarshipVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "scholarship"
              },
              {
                "kind": "account",
                "path": "tokenProgram"
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "tokenProgram"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        },
        {
          "name": "scholarshipPurpose",
          "type": "string"
        }
      ]
    },
    {
      "name": "withdrawFunds",
      "discriminator": [
        241,
        36,
        29,
        111,
        208,
        31,
        104,
        217
      ],
      "accounts": [
        {
          "name": "lecturer",
          "writable": true,
          "signer": true,
          "relations": [
            "scholarship"
          ]
        },
        {
          "name": "mint",
          "relations": [
            "scholarship"
          ]
        },
        {
          "name": "scholarship",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  99,
                  104,
                  111,
                  108,
                  97,
                  114,
                  115,
                  104,
                  105,
                  112
                ]
              },
              {
                "kind": "account",
                "path": "lecturer"
              },
              {
                "kind": "arg",
                "path": "seed"
              }
            ]
          }
        },
        {
          "name": "scholarshipVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "scholarship"
              },
              {
                "kind": "account",
                "path": "tokenProgram"
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "lecturerAta",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "lecturer"
              },
              {
                "kind": "account",
                "path": "tokenProgram"
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "globalState",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  103,
                  108,
                  111,
                  98,
                  97,
                  108,
                  45,
                  115,
                  99,
                  104,
                  111,
                  108,
                  97,
                  114,
                  115,
                  104,
                  105,
                  112,
                  45,
                  115,
                  116,
                  97,
                  116,
                  101
                ]
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "tokenProgram"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        }
      ],
      "args": [
        {
          "name": "seed",
          "type": "u64"
        },
        {
          "name": "withdrawAmount",
          "type": "u64"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "globalScholarshipState",
      "discriminator": [
        221,
        137,
        50,
        210,
        55,
        231,
        147,
        160
      ]
    },
    {
      "name": "scholarship",
      "discriminator": [
        196,
        226,
        125,
        113,
        80,
        96,
        210,
        129
      ]
    }
  ],
  "events": [
    {
      "name": "partialWithdrawalEvent",
      "discriminator": [
        145,
        236,
        133,
        111,
        56,
        164,
        255,
        176
      ]
    },
    {
      "name": "scholarshipApprovedEvent",
      "discriminator": [
        168,
        248,
        72,
        195,
        61,
        163,
        106,
        60
      ]
    },
    {
      "name": "scholarshipClosedEvent",
      "discriminator": [
        192,
        116,
        176,
        254,
        50,
        192,
        7,
        15
      ]
    },
    {
      "name": "scholarshipPoolCreatedEvent",
      "discriminator": [
        217,
        93,
        152,
        122,
        152,
        170,
        169,
        74
      ]
    },
    {
      "name": "scholarshipRejectedEvent",
      "discriminator": [
        116,
        129,
        78,
        18,
        216,
        8,
        67,
        224
      ]
    },
    {
      "name": "scholarshipRequestedEvent",
      "discriminator": [
        183,
        102,
        56,
        46,
        103,
        55,
        45,
        7
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "invalidAmount",
      "msg": "Invalid amount specified"
    },
    {
      "code": 6001,
      "name": "emptyPurpose",
      "msg": "Scholarship purpose cannot be empty"
    },
    {
      "code": 6002,
      "name": "purposeTooLong",
      "msg": "Scholarship purpose is too long (max 300 characters)"
    },
    {
      "code": 6003,
      "name": "emptyReason",
      "msg": "Scholarship reason cannot be empty"
    },
    {
      "code": 6004,
      "name": "reasonTooLong",
      "msg": "Scholarship reason is too long (max 300 characters)"
    },
    {
      "code": 6005,
      "name": "emptyResponse",
      "msg": "Lecturer response cannot be empty"
    },
    {
      "code": 6006,
      "name": "responseTooLong",
      "msg": "Lecturer response is too long (max 200 characters)"
    },
    {
      "code": 6007,
      "name": "tooManyRequests",
      "msg": "Too many scholarship requests (max 100)"
    },
    {
      "code": 6008,
      "name": "pendingRequestExists",
      "msg": "Student already has a pending request"
    },
    {
      "code": 6009,
      "name": "insufficientFunds",
      "msg": "Insufficient funds in scholarship pool"
    },
    {
      "code": 6010,
      "name": "invalidRequestIndex",
      "msg": "Invalid request index"
    },
    {
      "code": 6011,
      "name": "requestNotPending",
      "msg": "Request is not in pending status"
    },
    {
      "code": 6012,
      "name": "invalidStudent",
      "msg": "Invalid student for this request"
    },
    {
      "code": 6013,
      "name": "unauthorized",
      "msg": "Unauthorized access"
    },
    {
      "code": 6014,
      "name": "calculationError",
      "msg": "Calculation error occurred"
    },
    {
      "code": 6015,
      "name": "invalidMaxRequestAmount",
      "msg": "Invalid max request amount. Must be greater than 0."
    },
    {
      "code": 6016,
      "name": "maxRequestExceedsTotalAmount",
      "msg": "Max request amount cannot exceed total scholarship amount."
    },
    {
      "code": 6017,
      "name": "exceedsMaxRequestAmount",
      "msg": "Requested amount exceeds the maximum allowed per student."
    },
    {
      "code": 6018,
      "name": "invalidApprovedAmount",
      "msg": "Invalid approved amount. Must be greater than 0."
    },
    {
      "code": 6019,
      "name": "approvedExceedsRequested",
      "msg": "Approved amount cannot exceed the requested amount."
    }
  ],
  "types": [
    {
      "name": "globalScholarshipState",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "totalScholarshipsCreated",
            "type": "u64"
          },
          {
            "name": "totalScholarshipsClosed",
            "type": "u64"
          },
          {
            "name": "totalRequestsApproved",
            "type": "u64"
          },
          {
            "name": "totalRequestsRejected",
            "type": "u64"
          },
          {
            "name": "totalVolumeDisbursed",
            "type": "u64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "partialWithdrawalEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "scholarship",
            "type": "pubkey"
          },
          {
            "name": "lecturer",
            "type": "pubkey"
          },
          {
            "name": "withdrawAmount",
            "type": "u64"
          },
          {
            "name": "remainingAmount",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "scholarship",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "seed",
            "type": "u64"
          },
          {
            "name": "lecturer",
            "type": "pubkey"
          },
          {
            "name": "mint",
            "type": "pubkey"
          },
          {
            "name": "totalAmount",
            "type": "u64"
          },
          {
            "name": "availableAmount",
            "type": "u64"
          },
          {
            "name": "scholarshipPurpose",
            "type": "string"
          },
          {
            "name": "scholarshipRequests",
            "type": {
              "vec": {
                "defined": {
                  "name": "scholarshipRequest"
                }
              }
            }
          },
          {
            "name": "maxRequestAmount",
            "type": "u64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "scholarshipApprovedEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "scholarship",
            "type": "pubkey"
          },
          {
            "name": "lecturer",
            "type": "pubkey"
          },
          {
            "name": "student",
            "type": "pubkey"
          },
          {
            "name": "requestedAmount",
            "type": "u64"
          },
          {
            "name": "approvedAmount",
            "type": "u64"
          },
          {
            "name": "lecturerResponse",
            "type": "string"
          }
        ]
      }
    },
    {
      "name": "scholarshipClosedEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "scholarship",
            "type": "pubkey"
          },
          {
            "name": "lecturer",
            "type": "pubkey"
          },
          {
            "name": "remainingAmount",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "scholarshipPoolCreatedEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "scholarship",
            "type": "pubkey"
          },
          {
            "name": "lecturer",
            "type": "pubkey"
          },
          {
            "name": "mint",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "maxRequestAmount",
            "type": "u64"
          },
          {
            "name": "purpose",
            "type": "string"
          }
        ]
      }
    },
    {
      "name": "scholarshipRejectedEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "scholarship",
            "type": "pubkey"
          },
          {
            "name": "lecturer",
            "type": "pubkey"
          },
          {
            "name": "student",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "lecturerResponse",
            "type": "string"
          }
        ]
      }
    },
    {
      "name": "scholarshipRequest",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "student",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "approvedAmount",
            "type": "u64"
          },
          {
            "name": "timestamp",
            "type": "i64"
          },
          {
            "name": "scholarshipReason",
            "type": "string"
          },
          {
            "name": "status",
            "type": "u8"
          },
          {
            "name": "lecturerResponse",
            "type": "string"
          }
        ]
      }
    },
    {
      "name": "scholarshipRequestedEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "scholarship",
            "type": "pubkey"
          },
          {
            "name": "lecturer",
            "type": "pubkey"
          },
          {
            "name": "student",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "reason",
            "type": "string"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    }
  ],
  "constants": [
    {
      "name": "seed",
      "type": "string",
      "value": "\"anchor\""
    }
  ]
};
