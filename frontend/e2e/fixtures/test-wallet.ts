import { Keypair, PublicKey } from "@solana/web3.js";

const TEST_SEED = new Uint8Array(32).fill(1);
export const TEST_KEYPAIR = Keypair.fromSeed(TEST_SEED);
export const TEST_PUBKEY = TEST_KEYPAIR.publicKey;

// Deterministic "mint" keypair for mock accounts
const MINT_SEED = new Uint8Array(32).fill(2);
export const MOCK_MINT = Keypair.fromSeed(MINT_SEED).publicKey;

// Deterministic "treasury" — just use test wallet
export const MOCK_TREASURY = TEST_PUBKEY;

// A second address for recipient/target
const OTHER_SEED = new Uint8Array(32).fill(3);
export const OTHER_PUBKEY = Keypair.fromSeed(OTHER_SEED).publicKey;

// Fake config PDA — deterministic from mint seed
const CONFIG_SEED = new Uint8Array(32).fill(4);
export const MOCK_CONFIG_PDA = Keypair.fromSeed(CONFIG_SEED).publicKey;

// Fake signature for sendTransaction mock
export const FAKE_SIGNATURE = "5".repeat(88);
export const FAKE_BLOCKHASH = "G".repeat(44);
