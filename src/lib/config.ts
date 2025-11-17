import { PublicKey } from "@solana/web3.js";

export const rpcEndpoint = process.env.NEXT_PUBLIC_SOLANA_RPC_ENDPOINT || '';
export const programId = process.env.NEXT_PUBLIC_SOLANA_PROGRAM_ID || '';
export const treasuryWallet = process.env.NEXT_PUBLIC_SOLANA_TREASURY_WALLET || '';
