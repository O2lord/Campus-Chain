/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/examinator.json`.
 */
export type Examinator = {
  "address": "AiLZhuUBYgr2ZkRZHDBscg15ifok5vEa1aeUyA6aJmoe",
  "metadata": {
    "name": "examinator",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Created with Anchor"
  },
  "instructions": [
    {
      "name": "createExamMetadata",
      "discriminator": [
        162,
        38,
        142,
        195,
        98,
        194,
        98,
        75
      ],
      "accounts": [
        {
          "name": "signer",
          "writable": true,
          "signer": true
        },
        {
          "name": "examMetadata",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  101,
                  120,
                  97,
                  109
                ]
              },
              {
                "kind": "account",
                "path": "lecturerProfile"
              },
              {
                "kind": "arg",
                "path": "supabaseExamIdHash"
              }
            ]
          }
        },
        {
          "name": "lecturerProfile",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  108,
                  101,
                  99,
                  116,
                  117,
                  114,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "signer"
              },
              {
                "kind": "account",
                "path": "lecturer_profile.supabase_id_hash",
                "account": "lecturerProfile"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "supabaseExamIdHash",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "configHash",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "startTs",
          "type": "i64"
        },
        {
          "name": "endTs",
          "type": "i64"
        },
        {
          "name": "published",
          "type": "bool"
        }
      ]
    },
    {
      "name": "createLecturerProfile",
      "discriminator": [
        54,
        75,
        57,
        168,
        193,
        10,
        134,
        124
      ],
      "accounts": [
        {
          "name": "lecturerProfile",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  108,
                  101,
                  99,
                  116,
                  117,
                  114,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "signer"
              },
              {
                "kind": "arg",
                "path": "supabaseIdHash"
              }
            ]
          }
        },
        {
          "name": "signer",
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
          "name": "supabaseIdHash",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        }
      ]
    },
    {
      "name": "createQuestionBatch",
      "discriminator": [
        160,
        118,
        39,
        122,
        168,
        232,
        36,
        26
      ],
      "accounts": [
        {
          "name": "questionBatch",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  97,
                  116,
                  99,
                  104
                ]
              },
              {
                "kind": "account",
                "path": "lecturerProfile"
              },
              {
                "kind": "arg",
                "path": "batchId"
              }
            ]
          }
        },
        {
          "name": "lecturerProfile",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  108,
                  101,
                  99,
                  116,
                  117,
                  114,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "signer"
              },
              {
                "kind": "account",
                "path": "lecturer_profile.supabase_id_hash",
                "account": "lecturerProfile"
              }
            ]
          }
        },
        {
          "name": "signer",
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
          "name": "batchId",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "questions",
          "type": {
            "vec": {
              "defined": {
                "name": "questionBatchItem"
              }
            }
          }
        }
      ]
    },
    {
      "name": "createQuestionMetadata",
      "discriminator": [
        118,
        223,
        254,
        99,
        158,
        156,
        254,
        211
      ],
      "accounts": [
        {
          "name": "questionMetadata",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  113,
                  117,
                  101,
                  115,
                  116,
                  105,
                  111,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "lecturerProfile"
              },
              {
                "kind": "arg",
                "path": "supabaseQuestionIdHash"
              }
            ]
          }
        },
        {
          "name": "lecturerProfile",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  108,
                  101,
                  99,
                  116,
                  117,
                  114,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "signer"
              },
              {
                "kind": "account",
                "path": "lecturer_profile.supabase_id_hash",
                "account": "lecturerProfile"
              }
            ]
          }
        },
        {
          "name": "signer",
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
          "name": "supabaseQuestionIdHash",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "contentHash",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "courseCodeHash",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        }
      ]
    },
    {
      "name": "createStudentProfile",
      "discriminator": [
        170,
        78,
        23,
        229,
        123,
        10,
        212,
        46
      ],
      "accounts": [
        {
          "name": "studentProfile",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  116,
                  117,
                  100,
                  101,
                  110,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "signer"
              },
              {
                "kind": "arg",
                "path": "supabaseIdHash"
              }
            ]
          }
        },
        {
          "name": "signer",
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
          "name": "supabaseIdHash",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        }
      ]
    },
    {
      "name": "finalizeStudentScore",
      "discriminator": [
        72,
        218,
        50,
        47,
        162,
        228,
        226,
        207
      ],
      "accounts": [
        {
          "name": "studentAttempt",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  116,
                  116,
                  101,
                  109,
                  112,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "student"
              },
              {
                "kind": "account",
                "path": "exam"
              },
              {
                "kind": "arg",
                "path": "supabaseAttemptIdHash"
              }
            ]
          }
        },
        {
          "name": "student",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  116,
                  117,
                  100,
                  101,
                  110,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "student.authority",
                "account": "studentProfile"
              },
              {
                "kind": "account",
                "path": "student.supabase_id_hash",
                "account": "studentProfile"
              }
            ]
          },
          "relations": [
            "studentAttempt"
          ]
        },
        {
          "name": "exam",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  101,
                  120,
                  97,
                  109
                ]
              },
              {
                "kind": "account",
                "path": "lecturer"
              },
              {
                "kind": "account",
                "path": "exam.supabase_exam_id_hash",
                "account": "examMetadata"
              }
            ]
          },
          "relations": [
            "studentAttempt"
          ]
        },
        {
          "name": "lecturer",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  108,
                  101,
                  99,
                  116,
                  117,
                  114,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "signer"
              },
              {
                "kind": "account",
                "path": "lecturer.supabase_id_hash",
                "account": "lecturerProfile"
              }
            ]
          },
          "relations": [
            "exam"
          ]
        },
        {
          "name": "signer",
          "writable": true,
          "signer": true
        }
      ],
      "args": [
        {
          "name": "supabaseAttemptIdHash",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "finalScore",
          "type": "u64"
        },
        {
          "name": "maxPossibleScore",
          "type": "u64"
        }
      ]
    },
    {
      "name": "publishExam",
      "discriminator": [
        242,
        213,
        19,
        188,
        204,
        149,
        129,
        238
      ],
      "accounts": [
        {
          "name": "examMetadata",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  101,
                  120,
                  97,
                  109
                ]
              },
              {
                "kind": "account",
                "path": "lecturer"
              },
              {
                "kind": "arg",
                "path": "supabaseExamIdHash"
              }
            ]
          }
        },
        {
          "name": "lecturer",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  108,
                  101,
                  99,
                  116,
                  117,
                  114,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "signer"
              },
              {
                "kind": "account",
                "path": "lecturer.supabase_id_hash",
                "account": "lecturerProfile"
              }
            ]
          },
          "relations": [
            "examMetadata"
          ]
        },
        {
          "name": "signer",
          "writable": true,
          "signer": true
        }
      ],
      "args": [
        {
          "name": "supabaseExamIdHash",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        }
      ]
    },
    {
      "name": "requestRemark",
      "discriminator": [
        4,
        242,
        6,
        137,
        113,
        89,
        75,
        21
      ],
      "accounts": [
        {
          "name": "studentAttempt",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  116,
                  116,
                  101,
                  109,
                  112,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "student"
              },
              {
                "kind": "account",
                "path": "exam"
              },
              {
                "kind": "arg",
                "path": "supabaseAttemptIdHash"
              }
            ]
          }
        },
        {
          "name": "student",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  116,
                  117,
                  100,
                  101,
                  110,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "signer"
              },
              {
                "kind": "account",
                "path": "student.supabase_id_hash",
                "account": "studentProfile"
              }
            ]
          },
          "relations": [
            "studentAttempt"
          ]
        },
        {
          "name": "exam",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  101,
                  120,
                  97,
                  109
                ]
              },
              {
                "kind": "account",
                "path": "exam.lecturer",
                "account": "examMetadata"
              },
              {
                "kind": "account",
                "path": "exam.supabase_exam_id_hash",
                "account": "examMetadata"
              }
            ]
          },
          "relations": [
            "studentAttempt"
          ]
        },
        {
          "name": "signer",
          "writable": true,
          "signer": true
        }
      ],
      "args": [
        {
          "name": "supabaseAttemptIdHash",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "reasonHash",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        }
      ]
    },
    {
      "name": "startStudentAttempt",
      "discriminator": [
        151,
        0,
        181,
        56,
        122,
        248,
        24,
        156
      ],
      "accounts": [
        {
          "name": "studentAttempt",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  116,
                  116,
                  101,
                  109,
                  112,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "studentProfile"
              },
              {
                "kind": "account",
                "path": "examMetadata"
              },
              {
                "kind": "arg",
                "path": "supabaseAttemptIdHash"
              }
            ]
          }
        },
        {
          "name": "studentProfile",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  116,
                  117,
                  100,
                  101,
                  110,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "signer"
              },
              {
                "kind": "account",
                "path": "student_profile.supabase_id_hash",
                "account": "studentProfile"
              }
            ]
          }
        },
        {
          "name": "examMetadata",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  101,
                  120,
                  97,
                  109
                ]
              },
              {
                "kind": "account",
                "path": "exam_metadata.lecturer",
                "account": "examMetadata"
              },
              {
                "kind": "account",
                "path": "exam_metadata.supabase_exam_id_hash",
                "account": "examMetadata"
              }
            ]
          }
        },
        {
          "name": "signer",
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
          "name": "supabaseAttemptIdHash",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        }
      ]
    },
    {
      "name": "submitStudentAnswers",
      "discriminator": [
        184,
        60,
        27,
        72,
        54,
        227,
        246,
        191
      ],
      "accounts": [
        {
          "name": "studentAttempt",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  116,
                  116,
                  101,
                  109,
                  112,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "student"
              },
              {
                "kind": "account",
                "path": "exam"
              },
              {
                "kind": "arg",
                "path": "supabaseAttemptIdHash"
              }
            ]
          }
        },
        {
          "name": "student",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  116,
                  117,
                  100,
                  101,
                  110,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "signer"
              },
              {
                "kind": "account",
                "path": "student.supabase_id_hash",
                "account": "studentProfile"
              }
            ]
          },
          "relations": [
            "studentAttempt"
          ]
        },
        {
          "name": "exam",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  101,
                  120,
                  97,
                  109
                ]
              },
              {
                "kind": "account",
                "path": "exam.lecturer",
                "account": "examMetadata"
              },
              {
                "kind": "account",
                "path": "exam.supabase_exam_id_hash",
                "account": "examMetadata"
              }
            ]
          },
          "relations": [
            "studentAttempt"
          ]
        },
        {
          "name": "signer",
          "writable": true,
          "signer": true
        }
      ],
      "args": [
        {
          "name": "supabaseAttemptIdHash",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "answersHash",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        }
      ]
    },
    {
      "name": "unpublishExam",
      "discriminator": [
        255,
        248,
        224,
        120,
        11,
        47,
        67,
        127
      ],
      "accounts": [
        {
          "name": "examMetadata",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  101,
                  120,
                  97,
                  109
                ]
              },
              {
                "kind": "account",
                "path": "lecturer"
              },
              {
                "kind": "arg",
                "path": "supabaseExamIdHash"
              }
            ]
          }
        },
        {
          "name": "lecturer",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  108,
                  101,
                  99,
                  116,
                  117,
                  114,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "signer"
              },
              {
                "kind": "account",
                "path": "lecturer.supabase_id_hash",
                "account": "lecturerProfile"
              }
            ]
          },
          "relations": [
            "examMetadata"
          ]
        },
        {
          "name": "signer",
          "writable": true,
          "signer": true
        }
      ],
      "args": [
        {
          "name": "supabaseExamIdHash",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        }
      ]
    },
    {
      "name": "updateExamMetadata",
      "discriminator": [
        214,
        112,
        147,
        78,
        67,
        92,
        183,
        184
      ],
      "accounts": [
        {
          "name": "examMetadata",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  101,
                  120,
                  97,
                  109
                ]
              },
              {
                "kind": "account",
                "path": "lecturer"
              },
              {
                "kind": "arg",
                "path": "supabaseExamIdHash"
              }
            ]
          }
        },
        {
          "name": "lecturer",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  108,
                  101,
                  99,
                  116,
                  117,
                  114,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "signer"
              },
              {
                "kind": "account",
                "path": "lecturer.supabase_id_hash",
                "account": "lecturerProfile"
              }
            ]
          },
          "relations": [
            "examMetadata"
          ]
        },
        {
          "name": "signer",
          "writable": true,
          "signer": true
        }
      ],
      "args": [
        {
          "name": "supabaseExamIdHash",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "newConfigHash",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "newStartTs",
          "type": "i64"
        },
        {
          "name": "newEndTs",
          "type": "i64"
        },
        {
          "name": "newPublished",
          "type": "bool"
        }
      ]
    },
    {
      "name": "updateLecturerProfile",
      "discriminator": [
        187,
        242,
        74,
        104,
        114,
        249,
        236,
        251
      ],
      "accounts": [
        {
          "name": "lecturerProfile",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  108,
                  101,
                  99,
                  116,
                  117,
                  114,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "signer"
              },
              {
                "kind": "arg",
                "path": "supabaseIdHash"
              }
            ]
          }
        },
        {
          "name": "signer",
          "writable": true,
          "signer": true
        }
      ],
      "args": [
        {
          "name": "supabaseIdHash",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "newSupabaseIdHash",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        }
      ]
    },
    {
      "name": "updateQuestionMetadata",
      "discriminator": [
        61,
        67,
        200,
        189,
        29,
        173,
        63,
        72
      ],
      "accounts": [
        {
          "name": "questionMetadata",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  113,
                  117,
                  101,
                  115,
                  116,
                  105,
                  111,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "lecturer"
              },
              {
                "kind": "arg",
                "path": "supabaseQuestionIdHash"
              }
            ]
          }
        },
        {
          "name": "lecturer",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  108,
                  101,
                  99,
                  116,
                  117,
                  114,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "signer"
              },
              {
                "kind": "account",
                "path": "lecturer.supabase_id_hash",
                "account": "lecturerProfile"
              }
            ]
          },
          "relations": [
            "questionMetadata"
          ]
        },
        {
          "name": "signer",
          "writable": true,
          "signer": true
        }
      ],
      "args": [
        {
          "name": "supabaseQuestionIdHash",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "newContentHash",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "newCourseCodeHash",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        }
      ]
    },
    {
      "name": "updateStudentProfile",
      "discriminator": [
        85,
        45,
        63,
        201,
        102,
        244,
        150,
        166
      ],
      "accounts": [
        {
          "name": "studentProfile",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  116,
                  117,
                  100,
                  101,
                  110,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "signer"
              },
              {
                "kind": "arg",
                "path": "supabaseIdHash"
              }
            ]
          }
        },
        {
          "name": "signer",
          "writable": true,
          "signer": true
        }
      ],
      "args": [
        {
          "name": "supabaseIdHash",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "newSupabaseIdHash",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "examMetadata",
      "discriminator": [
        239,
        172,
        196,
        21,
        183,
        235,
        161,
        100
      ]
    },
    {
      "name": "lecturerProfile",
      "discriminator": [
        56,
        7,
        222,
        91,
        159,
        75,
        22,
        196
      ]
    },
    {
      "name": "questionBatch",
      "discriminator": [
        214,
        207,
        190,
        2,
        47,
        25,
        76,
        134
      ]
    },
    {
      "name": "questionMetadata",
      "discriminator": [
        184,
        63,
        60,
        43,
        99,
        148,
        243,
        179
      ]
    },
    {
      "name": "studentAttempt",
      "discriminator": [
        136,
        200,
        102,
        178,
        39,
        138,
        119,
        108
      ]
    },
    {
      "name": "studentProfile",
      "discriminator": [
        185,
        172,
        160,
        26,
        178,
        113,
        216,
        235
      ]
    }
  ],
  "events": [
    {
      "name": "examPublishedEvent",
      "discriminator": [
        131,
        251,
        213,
        3,
        179,
        7,
        55,
        71
      ]
    },
    {
      "name": "examUnpublishedEvent",
      "discriminator": [
        139,
        252,
        120,
        163,
        157,
        43,
        234,
        107
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "unauthorized",
      "msg": "unauthorized"
    }
  ],
  "types": [
    {
      "name": "attemptStatus",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "inProgress"
          },
          {
            "name": "submitted"
          },
          {
            "name": "graded"
          },
          {
            "name": "remarkRequested"
          },
          {
            "name": "remarkApproved"
          }
        ]
      }
    },
    {
      "name": "examMetadata",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "lecturer",
            "type": "pubkey"
          },
          {
            "name": "supabaseExamIdHash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "configHash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "startTs",
            "type": "i64"
          },
          {
            "name": "endTs",
            "type": "i64"
          },
          {
            "name": "published",
            "type": "bool"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "examPublishedEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "exam",
            "type": "pubkey"
          },
          {
            "name": "lecturer",
            "type": "pubkey"
          },
          {
            "name": "supabaseExamIdHash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "publishedAt",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "examUnpublishedEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "exam",
            "type": "pubkey"
          },
          {
            "name": "lecturer",
            "type": "pubkey"
          },
          {
            "name": "supabaseExamIdHash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "unpublishedAt",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "lecturerProfile",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "supabaseIdHash",
            "type": {
              "array": [
                "u8",
                32
              ]
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
      "name": "questionBatch",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "lecturer",
            "type": "pubkey"
          },
          {
            "name": "batchId",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "questions",
            "type": {
              "vec": {
                "defined": {
                  "name": "questionBatchItem"
                }
              }
            }
          },
          {
            "name": "createdAt",
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
      "name": "questionBatchItem",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "supabaseQuestionIdHash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "contentHash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "courseCodeHash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          }
        ]
      }
    },
    {
      "name": "questionMetadata",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "lecturer",
            "type": "pubkey"
          },
          {
            "name": "supabaseQuestionIdHash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "contentHash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "courseCodeHash",
            "type": {
              "array": [
                "u8",
                32
              ]
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
      "name": "studentAttempt",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "student",
            "type": "pubkey"
          },
          {
            "name": "exam",
            "type": "pubkey"
          },
          {
            "name": "supabaseAttemptIdHash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "startTs",
            "type": "i64"
          },
          {
            "name": "submitTs",
            "type": {
              "option": "i64"
            }
          },
          {
            "name": "answersHash",
            "type": {
              "option": {
                "array": [
                  "u8",
                  32
                ]
              }
            }
          },
          {
            "name": "finalScore",
            "type": {
              "option": "u64"
            }
          },
          {
            "name": "maxPossibleScore",
            "type": {
              "option": "u64"
            }
          },
          {
            "name": "status",
            "type": {
              "defined": {
                "name": "attemptStatus"
              }
            }
          },
          {
            "name": "remarkReasonHash",
            "type": {
              "option": {
                "array": [
                  "u8",
                  32
                ]
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
      "name": "studentProfile",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "supabaseIdHash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    }
  ]
};
