/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/transfer_hook.json`.
 */
export type TransferHook = {
  "address": "7z98ECJDGgRTZgnkX4iY8F6yqLBkiFKXJR2p51jrvUaj",
  "metadata": {
    "name": "transferHook",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Solana Stablecoin Standard — transfer hook program for SSS-2 compliance"
  },
  "instructions": [
    {
      "name": "initializeExtraAccountMetaList",
      "discriminator": [
        92,
        197,
        174,
        197,
        41,
        124,
        19,
        3
      ],
      "accounts": [
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "extraAccountMetaList",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  101,
                  120,
                  116,
                  114,
                  97,
                  45,
                  97,
                  99,
                  99,
                  111,
                  117,
                  110,
                  116,
                  45,
                  109,
                  101,
                  116,
                  97,
                  115
                ]
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ]
          }
        },
        {
          "name": "mint"
        },
        {
          "name": "config"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "sssTokenProgramId",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "transferHook",
      "discriminator": [
        220,
        57,
        220,
        152,
        126,
        125,
        97,
        168
      ],
      "accounts": [
        {
          "name": "sourceToken"
        },
        {
          "name": "mint"
        },
        {
          "name": "destinationToken"
        },
        {
          "name": "owner"
        },
        {
          "name": "extraAccountMetaList"
        },
        {
          "name": "sssTokenProgram"
        },
        {
          "name": "config"
        },
        {
          "name": "sourceBlacklistEntry"
        },
        {
          "name": "destBlacklistEntry"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "senderBlacklisted",
      "msg": "Sender is blacklisted"
    },
    {
      "code": 6001,
      "name": "recipientBlacklisted",
      "msg": "Recipient is blacklisted"
    },
    {
      "code": 6002,
      "name": "paused",
      "msg": "System is paused"
    },
    {
      "code": 6003,
      "name": "isNotCurrentlyTransferring",
      "msg": "Token is not currently transferring — direct hook invocation rejected"
    },
    {
      "code": 6004,
      "name": "invalidExtraAccountMetas",
      "msg": "Invalid extra account metas"
    }
  ]
};
