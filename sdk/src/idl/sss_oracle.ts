/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/sss_oracle.json`.
 */
export type SssOracle = {
  "address": "ADuTfewteACQzaBpxB2ShicPZVgzW21XMA64Y84pg92k",
  "metadata": {
    "name": "sssOracle",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Solana Stablecoin Standard — oracle integration module for non-USD pegged stablecoins"
  },
  "instructions": [
    {
      "name": "cachePrice",
      "discriminator": [
        211,
        253,
        232,
        84,
        56,
        51,
        255,
        232
      ],
      "accounts": [
        {
          "name": "feedAccount"
        },
        {
          "name": "oracleFeed",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  111,
                  114,
                  97,
                  99,
                  108,
                  101,
                  45,
                  102,
                  101,
                  101,
                  100
                ]
              },
              {
                "kind": "account",
                "path": "oracle_feed.config",
                "account": "oracleFeedConfig"
              },
              {
                "kind": "account",
                "path": "oracle_feed.pair",
                "account": "oracleFeedConfig"
              }
            ]
          }
        }
      ],
      "args": []
    },
    {
      "name": "closeFeed",
      "discriminator": [
        153,
        14,
        92,
        89,
        19,
        78,
        211,
        46
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "oracleFeed",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  111,
                  114,
                  97,
                  99,
                  108,
                  101,
                  45,
                  102,
                  101,
                  101,
                  100
                ]
              },
              {
                "kind": "account",
                "path": "oracle_feed.config",
                "account": "oracleFeedConfig"
              },
              {
                "kind": "account",
                "path": "oracle_feed.pair",
                "account": "oracleFeedConfig"
              }
            ]
          }
        }
      ],
      "args": []
    },
    {
      "name": "initializeFeed",
      "discriminator": [
        167,
        251,
        140,
        58,
        66,
        138,
        187,
        95
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "config"
        },
        {
          "name": "oracleFeed",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  111,
                  114,
                  97,
                  99,
                  108,
                  101,
                  45,
                  102,
                  101,
                  101,
                  100
                ]
              },
              {
                "kind": "account",
                "path": "config"
              },
              {
                "kind": "arg",
                "path": "params.pair"
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
          "name": "params",
          "type": {
            "defined": {
              "name": "initFeedParams"
            }
          }
        }
      ]
    },
    {
      "name": "setManualPrice",
      "discriminator": [
        6,
        210,
        4,
        51,
        43,
        53,
        139,
        140
      ],
      "accounts": [
        {
          "name": "authority",
          "signer": true
        },
        {
          "name": "oracleFeed",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  111,
                  114,
                  97,
                  99,
                  108,
                  101,
                  45,
                  102,
                  101,
                  101,
                  100
                ]
              },
              {
                "kind": "account",
                "path": "oracle_feed.config",
                "account": "oracleFeedConfig"
              },
              {
                "kind": "account",
                "path": "oracle_feed.pair",
                "account": "oracleFeedConfig"
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "price",
          "type": "u64"
        }
      ]
    },
    {
      "name": "updateFeedConfig",
      "discriminator": [
        149,
        249,
        44,
        150,
        153,
        10,
        139,
        162
      ],
      "accounts": [
        {
          "name": "authority",
          "signer": true
        },
        {
          "name": "oracleFeed",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  111,
                  114,
                  97,
                  99,
                  108,
                  101,
                  45,
                  102,
                  101,
                  101,
                  100
                ]
              },
              {
                "kind": "account",
                "path": "oracle_feed.config",
                "account": "oracleFeedConfig"
              },
              {
                "kind": "account",
                "path": "oracle_feed.pair",
                "account": "oracleFeedConfig"
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "params",
          "type": {
            "defined": {
              "name": "updateFeedParams"
            }
          }
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "oracleFeedConfig",
      "discriminator": [
        60,
        31,
        58,
        170,
        26,
        196,
        118,
        8
      ]
    }
  ],
  "events": [
    {
      "name": "feedClosedEvent",
      "discriminator": [
        179,
        212,
        168,
        216,
        236,
        39,
        59,
        190
      ]
    },
    {
      "name": "feedConfigUpdatedEvent",
      "discriminator": [
        167,
        254,
        98,
        59,
        80,
        157,
        183,
        159
      ]
    },
    {
      "name": "feedInitializedEvent",
      "discriminator": [
        176,
        165,
        8,
        226,
        96,
        9,
        153,
        146
      ]
    },
    {
      "name": "manualPriceSetEvent",
      "discriminator": [
        251,
        233,
        187,
        222,
        155,
        61,
        121,
        219
      ]
    },
    {
      "name": "priceCachedEvent",
      "discriminator": [
        207,
        117,
        227,
        22,
        90,
        234,
        3,
        11
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "invalidAuthority",
      "msg": "Caller is not the stablecoin authority"
    },
    {
      "code": 6001,
      "name": "invalidConfigAccount",
      "msg": "Invalid StablecoinConfig account — wrong owner or discriminator"
    },
    {
      "code": 6002,
      "name": "invalidPair",
      "msg": "Currency pair must not be empty"
    },
    {
      "code": 6003,
      "name": "invalidFeedType",
      "msg": "Invalid feed type — must be 0 (Switchboard) or 1 (Manual)"
    },
    {
      "code": 6004,
      "name": "invalidDecimals",
      "msg": "Price decimals exceeds maximum (18)"
    },
    {
      "code": 6005,
      "name": "feedDisabled",
      "msg": "Feed is disabled"
    },
    {
      "code": 6006,
      "name": "feedAccountMismatch",
      "msg": "Feed account does not match stored feed_account"
    },
    {
      "code": 6007,
      "name": "invalidFeedOwner",
      "msg": "Feed account is not owned by Switchboard program"
    },
    {
      "code": 6008,
      "name": "invalidSwitchboardData",
      "msg": "Switchboard feed data is invalid or too short"
    },
    {
      "code": 6009,
      "name": "stalePrice",
      "msg": "Price is stale — exceeds max_staleness slots"
    },
    {
      "code": 6010,
      "name": "excessiveConfidence",
      "msg": "Price confidence interval exceeds max_confidence"
    },
    {
      "code": 6011,
      "name": "invalidPrice",
      "msg": "Invalid price — must be greater than zero"
    },
    {
      "code": 6012,
      "name": "overflow",
      "msg": "Arithmetic overflow during price conversion"
    }
  ],
  "types": [
    {
      "name": "feedClosedEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "feedPda",
            "type": "pubkey"
          },
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "pair",
            "type": "string"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "feedConfigUpdatedEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "feedPda",
            "type": "pubkey"
          },
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "fieldChanged",
            "type": "string"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "feedInitializedEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "config",
            "type": "pubkey"
          },
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "feedPda",
            "type": "pubkey"
          },
          {
            "name": "pair",
            "type": "string"
          },
          {
            "name": "feedType",
            "type": "u8"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "initFeedParams",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "pair",
            "type": {
              "array": [
                "u8",
                12
              ]
            }
          },
          {
            "name": "feedAccount",
            "type": "pubkey"
          },
          {
            "name": "feedType",
            "type": "u8"
          },
          {
            "name": "maxStaleness",
            "type": "u32"
          },
          {
            "name": "minSamples",
            "type": "u8"
          },
          {
            "name": "maxConfidence",
            "type": "u64"
          },
          {
            "name": "priceDecimals",
            "type": "u8"
          },
          {
            "name": "switchboardProgram",
            "docs": [
              "Switchboard program ID for this cluster (mainnet vs devnet).",
              "Stored in the feed config and validated in cache_price.",
              "Ignored for manual feeds (feed_type == 1)."
            ],
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "manualPriceSetEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "feedPda",
            "type": "pubkey"
          },
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "price",
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
      "name": "oracleFeedConfig",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "config",
            "docs": [
              "The StablecoinConfig PDA this feed is associated with"
            ],
            "type": "pubkey"
          },
          {
            "name": "authority",
            "docs": [
              "Authority that can manage this feed (copied from config at init time)"
            ],
            "type": "pubkey"
          },
          {
            "name": "feedAccount",
            "docs": [
              "Switchboard pull feed account (type 0) or Pubkey::default for manual (type 1)"
            ],
            "type": "pubkey"
          },
          {
            "name": "switchboardProgram",
            "docs": [
              "Switchboard program ID (stored at init, cluster-agnostic).",
              "Validated in cache_price to ensure feed_account is owned by this program."
            ],
            "type": "pubkey"
          },
          {
            "name": "pair",
            "docs": [
              "Currency pair identifier, e.g. \"EUR/USD\", \"BRL/USD\", \"CPI\" — zero-padded"
            ],
            "type": {
              "array": [
                "u8",
                12
              ]
            }
          },
          {
            "name": "maxStaleness",
            "docs": [
              "Maximum allowed staleness in slots for Switchboard feeds"
            ],
            "type": "u32"
          },
          {
            "name": "minSamples",
            "docs": [
              "Minimum number of oracle samples required"
            ],
            "type": "u8"
          },
          {
            "name": "maxConfidence",
            "docs": [
              "Maximum acceptable confidence interval (std dev) in price units"
            ],
            "type": "u64"
          },
          {
            "name": "priceDecimals",
            "docs": [
              "Number of decimal places for the cached price"
            ],
            "type": "u8"
          },
          {
            "name": "enabled",
            "docs": [
              "Whether this feed is active"
            ],
            "type": "bool"
          },
          {
            "name": "feedType",
            "docs": [
              "0 = Switchboard On-Demand, 1 = Manual/CPI-indexed"
            ],
            "type": "u8"
          },
          {
            "name": "lastCachedPrice",
            "docs": [
              "Last cached price (scaled by 10^price_decimals)"
            ],
            "type": "u64"
          },
          {
            "name": "lastCachedSlot",
            "docs": [
              "Slot at which the price was last cached"
            ],
            "type": "u64"
          },
          {
            "name": "lastCachedTs",
            "docs": [
              "Unix timestamp of last cache"
            ],
            "type": "i64"
          },
          {
            "name": "bump",
            "docs": [
              "PDA bump"
            ],
            "type": "u8"
          },
          {
            "name": "reserved",
            "docs": [
              "Reserved for future upgrades"
            ],
            "type": {
              "array": [
                "u8",
                64
              ]
            }
          }
        ]
      }
    },
    {
      "name": "priceCachedEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "feedPda",
            "type": "pubkey"
          },
          {
            "name": "pair",
            "type": "string"
          },
          {
            "name": "price",
            "type": "u64"
          },
          {
            "name": "slot",
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
      "name": "updateFeedParams",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "maxStaleness",
            "type": {
              "option": "u32"
            }
          },
          {
            "name": "minSamples",
            "type": {
              "option": "u8"
            }
          },
          {
            "name": "maxConfidence",
            "type": {
              "option": "u64"
            }
          },
          {
            "name": "priceDecimals",
            "type": {
              "option": "u8"
            }
          },
          {
            "name": "enabled",
            "type": {
              "option": "bool"
            }
          },
          {
            "name": "feedAccount",
            "type": {
              "option": "pubkey"
            }
          }
        ]
      }
    }
  ]
};
