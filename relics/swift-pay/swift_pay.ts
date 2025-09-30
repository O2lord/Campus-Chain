/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/swift_pay.json`.
 */
export type SwiftPay = {
  "address": "gC5RCa5qR38FqfKKZBuKFVioerJqFANHnS5Uu66oDMP",
  "metadata": {
    "name": "swiftPay",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Created with Anchor"
  },
  "instructions": [
    {
      "name": "cancelOrReduceBuyOrder",
      "discriminator": [
        212,
        68,
        226,
        170,
        186,
        51,
        83,
        18
      ],
      "accounts": [
        {
          "name": "buyer",
          "writable": true,
          "signer": true
        },
        {
          "name": "swiftPay",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  119,
                  105,
                  102,
                  116,
                  45,
                  112,
                  97,
                  121
                ]
              },
              {
                "kind": "account",
                "path": "swift_pay.maker",
                "account": "swiftPay"
              },
              {
                "kind": "account",
                "path": "swift_pay.seed",
                "account": "swiftPay"
              }
            ]
          }
        },
        {
          "name": "tokenProgram"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "newAmount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "confirmPayout",
      "discriminator": [
        148,
        97,
        145,
        2,
        85,
        139,
        4,
        140
      ],
      "accounts": [
        {
          "name": "swiftPay",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  119,
                  105,
                  102,
                  116,
                  45,
                  112,
                  97,
                  121
                ]
              },
              {
                "kind": "account",
                "path": "swift_pay.maker",
                "account": "swiftPay"
              },
              {
                "kind": "account",
                "path": "swift_pay.seed",
                "account": "swiftPay"
              }
            ]
          }
        },
        {
          "name": "botAuthority",
          "signer": true
        },
        {
          "name": "maker"
        },
        {
          "name": "mint"
        },
        {
          "name": "swiftPayAta",
          "writable": true
        },
        {
          "name": "feeDestinationAta"
        },
        {
          "name": "takerAta"
        },
        {
          "name": "makerAta"
        },
        {
          "name": "tokenProgram"
        }
      ],
      "args": [
        {
          "name": "taker",
          "type": "pubkey"
        },
        {
          "name": "amount",
          "type": "u64"
        },
        {
          "name": "fiatAmount",
          "type": "u64"
        },
        {
          "name": "currency",
          "type": "string"
        },
        {
          "name": "payoutReference",
          "type": "string"
        },
        {
          "name": "success",
          "type": "bool"
        },
        {
          "name": "message",
          "type": "string"
        }
      ]
    },
    {
      "name": "createBuyOrder",
      "discriminator": [
        182,
        87,
        0,
        160,
        192,
        66,
        151,
        130
      ],
      "accounts": [
        {
          "name": "buyer",
          "writable": true,
          "signer": true
        },
        {
          "name": "mint"
        },
        {
          "name": "swiftPay",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  119,
                  105,
                  102,
                  116,
                  45,
                  112,
                  97,
                  121
                ]
              },
              {
                "kind": "account",
                "path": "buyer"
              },
              {
                "kind": "arg",
                "path": "seed"
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
          "name": "pricePerToken",
          "type": "u64"
        },
        {
          "name": "currency",
          "type": "string"
        },
        {
          "name": "paymentInstructions",
          "type": "string"
        }
      ]
    },
    {
      "name": "initializeGlobalState",
      "discriminator": [
        232,
        254,
        209,
        244,
        123,
        89,
        154,
        207
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true
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
          "name": "mint"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "instantReserve",
      "discriminator": [
        49,
        131,
        230,
        138,
        27,
        60,
        108,
        209
      ],
      "accounts": [
        {
          "name": "swiftPay",
          "writable": true
        },
        {
          "name": "maker",
          "relations": [
            "swiftPay"
          ]
        },
        {
          "name": "taker",
          "writable": true,
          "signer": true
        },
        {
          "name": "mint"
        },
        {
          "name": "takerAta",
          "writable": true
        },
        {
          "name": "swiftPayAta",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "swiftPay"
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
          "name": "tokenProgram"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        },
        {
          "name": "fiatAmount",
          "type": "u64"
        },
        {
          "name": "currency",
          "type": "string"
        },
        {
          "name": "payoutDetails",
          "type": {
            "option": "string"
          }
        }
      ]
    },
    {
      "name": "updatePrice",
      "discriminator": [
        61,
        34,
        117,
        155,
        75,
        34,
        123,
        208
      ],
      "accounts": [
        {
          "name": "maker",
          "writable": true,
          "signer": true,
          "relations": [
            "swiftPay"
          ]
        },
        {
          "name": "swiftPay",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  119,
                  105,
                  102,
                  116,
                  45,
                  112,
                  97,
                  121
                ]
              },
              {
                "kind": "account",
                "path": "maker"
              },
              {
                "kind": "account",
                "path": "swift_pay.seed",
                "account": "swiftPay"
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "newPricePerToken",
          "type": "u64"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "globalState",
      "discriminator": [
        163,
        46,
        74,
        168,
        216,
        123,
        133,
        98
      ]
    },
    {
      "name": "swiftPay",
      "discriminator": [
        81,
        251,
        203,
        243,
        129,
        60,
        135,
        244
      ]
    }
  ],
  "events": [
    {
      "name": "buyOrderCancelledEvent",
      "discriminator": [
        118,
        145,
        69,
        220,
        68,
        112,
        48,
        144
      ]
    },
    {
      "name": "buyOrderCreatedEvent",
      "discriminator": [
        158,
        4,
        42,
        74,
        250,
        125,
        66,
        173
      ]
    },
    {
      "name": "buyOrderReducedEvent",
      "discriminator": [
        250,
        72,
        155,
        121,
        173,
        162,
        112,
        178
      ]
    },
    {
      "name": "expressCloseFailedEvent",
      "discriminator": [
        28,
        91,
        60,
        34,
        32,
        87,
        79,
        77
      ]
    },
    {
      "name": "instantPaymentPayoutQueuedEvent",
      "discriminator": [
        126,
        74,
        232,
        24,
        151,
        193,
        25,
        55
      ]
    },
    {
      "name": "instantPaymentPayoutResultEvent",
      "discriminator": [
        114,
        61,
        126,
        78,
        83,
        230,
        103,
        231
      ]
    },
    {
      "name": "instantPaymentReservedEvent",
      "discriminator": [
        1,
        110,
        251,
        231,
        168,
        10,
        216,
        190
      ]
    },
    {
      "name": "priceUpdatedEvent",
      "discriminator": [
        217,
        171,
        222,
        24,
        64,
        152,
        217,
        36
      ]
    },
    {
      "name": "swiftPayNearlyEmptyEvent",
      "discriminator": [
        19,
        84,
        63,
        37,
        189,
        10,
        204,
        78
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "customError",
      "msg": "Custom error message"
    },
    {
      "code": 6001,
      "name": "insufficientFunds",
      "msg": "The requested withdrawal amount exceeds the swift pay balance."
    },
    {
      "code": 6002,
      "name": "invalidWithdrawAmount",
      "msg": "The withdrawal amount is invalid."
    },
    {
      "code": 6003,
      "name": "invalidAmount",
      "msg": "Invalid amount specified."
    },
    {
      "code": 6004,
      "name": "invalidPrice",
      "msg": "Invalid price specified."
    },
    {
      "code": 6005,
      "name": "invalidCurrency",
      "msg": "Currency code must be exactly 3 characters."
    },
    {
      "code": 6006,
      "name": "paymentInstructionsTooLong",
      "msg": "Payment instructions must be 100 characters or less."
    },
    {
      "code": 6007,
      "name": "activeReservationsExist",
      "msg": "There is an active reservation."
    },
    {
      "code": 6008,
      "name": "missingMakerAta",
      "msg": "Maker's associated token account is missing."
    },
    {
      "code": 6009,
      "name": "cannotReduceBelowReserved",
      "msg": "The reservation amount is invalid."
    },
    {
      "code": 6010,
      "name": "insufficientTokens",
      "msg": "Insufficient tokens available in the swift pay."
    },
    {
      "code": 6011,
      "name": "calculationError",
      "msg": "Calculation error occurred."
    },
    {
      "code": 6012,
      "name": "invalidReservationIndex",
      "msg": "Invalid reservation index."
    },
    {
      "code": 6013,
      "name": "invalidMaker",
      "msg": "Invalid maker."
    },
    {
      "code": 6014,
      "name": "unauthorized",
      "msg": "You are not authorized to perform this action."
    },
    {
      "code": 6015,
      "name": "reservationNotPending",
      "msg": "Reservation is not in pending status."
    },
    {
      "code": 6016,
      "name": "invalidMint",
      "msg": "Mint is not invalid."
    },
    {
      "code": 6017,
      "name": "arithmeticOverflow",
      "msg": "Arithemetic overflow."
    },
    {
      "code": 6018,
      "name": "invalidTaker",
      "msg": "Invalid taker for this reservation."
    },
    {
      "code": 6019,
      "name": "invalidFeeDestination",
      "msg": "Invalid fee destination for this reservation."
    },
    {
      "code": 6020,
      "name": "invalidProgramId",
      "msg": "Invalid program ID ."
    },
    {
      "code": 6021,
      "name": "invalidComment",
      "msg": "Invalid comment."
    },
    {
      "code": 6022,
      "name": "invalidResolution",
      "msg": "Invalid resolution status."
    },
    {
      "code": 6023,
      "name": "pendingReservationsExist",
      "msg": "Cannot withdraw funds with pending reservations."
    },
    {
      "code": 6024,
      "name": "cannotDisputeCompletedTransaction",
      "msg": "Cannot dispute a completed or cancelled transaction"
    },
    {
      "code": 6025,
      "name": "unauthorizedDisputer",
      "msg": "Only the maker or taker can dispute a transaction"
    },
    {
      "code": 6026,
      "name": "unauthorizedResolver",
      "msg": "Only an authorized resolver can resolve a dispute"
    },
    {
      "code": 6027,
      "name": "notDisputed",
      "msg": "Transaction is not in disputed status"
    },
    {
      "code": 6028,
      "name": "invalidPaymentInstructions",
      "msg": "No payment instructions provided"
    },
    {
      "code": 6029,
      "name": "tooManyReservations",
      "msg": "Too many active reservations for this swift pay."
    },
    {
      "code": 6030,
      "name": "invalidSwiftPayType",
      "msg": "Invalid swift pay type"
    },
    {
      "code": 6031,
      "name": "paymentNotSent",
      "msg": "Payment not sent"
    },
    {
      "code": 6032,
      "name": "activeTokenDepositsExist",
      "msg": "There is an active token deposit"
    },
    {
      "code": 6033,
      "name": "noUnreservedTokens",
      "msg": "All buyer orders are filled"
    },
    {
      "code": 6034,
      "name": "reservationNotFound",
      "msg": "Reservation not found for the given taker and payout reference"
    },
    {
      "code": 6035,
      "name": "reservationAlreadyProcessed",
      "msg": "Reservation has already been processed and cannot be modified"
    },
    {
      "code": 6036,
      "name": "missingFeeDestinationAta",
      "msg": "Fee destination ATA is required when fee amount is greater than zero"
    },
    {
      "code": 6037,
      "name": "missingTakerAtaForRefund",
      "msg": "Taker ATA is required for refunds when payout fails"
    },
    {
      "code": 6038,
      "name": "invalidMakerAtaAuthority",
      "msg": "The provided maker ATA does not belong to the maker"
    }
  ],
  "types": [
    {
      "name": "buyOrderCancelledEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "swiftPay",
            "type": "pubkey"
          },
          {
            "name": "buyer",
            "type": "pubkey"
          },
          {
            "name": "originalAmount",
            "type": "u64"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "buyOrderCreatedEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "swiftPay",
            "type": "pubkey"
          },
          {
            "name": "buyer",
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
            "name": "pricePerToken",
            "type": "u64"
          },
          {
            "name": "currency",
            "type": "string"
          },
          {
            "name": "paymentInstructions",
            "type": "string"
          }
        ]
      }
    },
    {
      "name": "buyOrderReducedEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "swiftPay",
            "type": "pubkey"
          },
          {
            "name": "buyer",
            "type": "pubkey"
          },
          {
            "name": "originalAmount",
            "type": "u64"
          },
          {
            "name": "newAmount",
            "type": "u64"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "expressCloseFailedEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "swiftPay",
            "type": "pubkey"
          },
          {
            "name": "maker",
            "type": "pubkey"
          },
          {
            "name": "remainingAmount",
            "type": "u64"
          },
          {
            "name": "errorCode",
            "type": "u32"
          },
          {
            "name": "timestamp",
            "type": "i64"
          },
          {
            "name": "reason",
            "type": "string"
          }
        ]
      }
    },
    {
      "name": "globalState",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "totalSwiftPayCreated",
            "type": "u64"
          },
          {
            "name": "totalSwiftPayClosed",
            "type": "u64"
          },
          {
            "name": "totalConfirmations",
            "type": "u64"
          },
          {
            "name": "feePercentage",
            "type": "u16"
          },
          {
            "name": "feeDestination",
            "type": "pubkey"
          },
          {
            "name": "totalFeesCollected",
            "type": "u64"
          },
          {
            "name": "totalDisputes",
            "type": "u64"
          },
          {
            "name": "totalVolume",
            "type": "u64"
          },
          {
            "name": "tokenDecimals",
            "type": "u8"
          },
          {
            "name": "highWatermarkVolume",
            "type": "u64"
          },
          {
            "name": "lastVolumeUpdate",
            "type": "i64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "instantPaymentPayoutQueuedEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "swiftPay",
            "type": "pubkey"
          },
          {
            "name": "taker",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "fiatAmount",
            "type": "u64"
          },
          {
            "name": "currency",
            "type": "string"
          },
          {
            "name": "payoutReference",
            "type": "string"
          }
        ]
      }
    },
    {
      "name": "instantPaymentPayoutResultEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "swiftPay",
            "type": "pubkey"
          },
          {
            "name": "taker",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "fiatAmount",
            "type": "u64"
          },
          {
            "name": "currency",
            "type": "string"
          },
          {
            "name": "payoutReference",
            "type": "string"
          },
          {
            "name": "success",
            "type": "bool"
          },
          {
            "name": "message",
            "type": "string"
          }
        ]
      }
    },
    {
      "name": "instantPaymentReservedEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "swiftPay",
            "type": "pubkey"
          },
          {
            "name": "taker",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "fiatAmount",
            "type": "u64"
          },
          {
            "name": "currency",
            "type": "string"
          },
          {
            "name": "payoutDetails",
            "type": {
              "option": "string"
            }
          },
          {
            "name": "payoutReference",
            "type": "string"
          }
        ]
      }
    },
    {
      "name": "priceUpdatedEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "swiftPay",
            "type": "pubkey"
          },
          {
            "name": "maker",
            "type": "pubkey"
          },
          {
            "name": "oldPrice",
            "type": "u64"
          },
          {
            "name": "newPrice",
            "type": "u64"
          },
          {
            "name": "currency",
            "type": "string"
          }
        ]
      }
    },
    {
      "name": "reservedAmount",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "taker",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "fiatAmount",
            "type": "u64"
          },
          {
            "name": "timestamp",
            "type": "i64"
          },
          {
            "name": "sellerInstructions",
            "type": {
              "option": "string"
            }
          },
          {
            "name": "status",
            "type": "u8"
          },
          {
            "name": "disputeReason",
            "type": {
              "option": "string"
            }
          },
          {
            "name": "disputeId",
            "type": {
              "option": "string"
            }
          },
          {
            "name": "payoutDetails",
            "type": {
              "option": "string"
            }
          },
          {
            "name": "payoutReference",
            "type": {
              "option": "string"
            }
          }
        ]
      }
    },
    {
      "name": "swiftPay",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "seed",
            "type": "u64"
          },
          {
            "name": "maker",
            "type": "pubkey"
          },
          {
            "name": "mint",
            "type": "pubkey"
          },
          {
            "name": "currency",
            "type": {
              "array": [
                "u8",
                3
              ]
            }
          },
          {
            "name": "escrowType",
            "type": "u8"
          },
          {
            "name": "feePercentage",
            "type": "u16"
          },
          {
            "name": "feeDestination",
            "type": "pubkey"
          },
          {
            "name": "reservedFee",
            "type": "u64"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "pricePerToken",
            "type": "u64"
          },
          {
            "name": "paymentInstructions",
            "type": "string"
          },
          {
            "name": "reservedAmounts",
            "type": {
              "vec": {
                "defined": {
                  "name": "reservedAmount"
                }
              }
            }
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "swiftPayNearlyEmptyEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "swiftPay",
            "type": "pubkey"
          },
          {
            "name": "maker",
            "type": "pubkey"
          },
          {
            "name": "remainingAmount",
            "type": "u64"
          },
          {
            "name": "activeReservations",
            "type": "u32"
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
