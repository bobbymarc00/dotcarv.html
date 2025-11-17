import { Connection } from '@solana/web3.js';

export interface DetectedWallet {
  provider: any;
  name: string;
  isConnected: boolean;
}

export interface WalletInfo {
  detectedWallet: DetectedWallet | null;
  connection: Connection | null;
  address: string | null;
}

/**
 * Detects available wallet - detects the ACTUALLY connected wallet first
 */
export function detectWallet(): DetectedWallet | null {
  // Only run on client side to avoid hydration errors
  if (typeof window === 'undefined') {
    return null;
  }
  
  const solana = (window as any).solana;
  const backpack = (window as any).backpack;
  const solflare = (window as any).solflare;

  // Check each wallet to see if it's actually connected
  const connectedWallets: Array<{provider: any, name: string, isConnected: boolean}> = [];
  
  if (backpack?.isConnected) {
    console.log('🔍 Backpack is connected');
    connectedWallets.push({ provider: backpack, name: 'Backpack', isConnected: true });
  }
  
  if (solflare?.isConnected) {
    console.log('🔍 Solflare is connected');
    connectedWallets.push({ provider: solflare, name: 'Solflare', isConnected: true });
  }
  
  if (solana?.isConnected) {
    console.log('🔍 Solana wallet is connected:', solana.isPhantom ? 'Phantom' : 'Other');
    const walletName = solana.isPhantom ? 'Phantom' : 'Solana Wallet';
    connectedWallets.push({ provider: solana, name: walletName, isConnected: true });
  }
  
  // If we have connected wallets, return the first one found
  if (connectedWallets.length > 0) {
    const detectedWallet = connectedWallets[0];
    console.log('✅ Using detected wallet:', detectedWallet.name);
    return detectedWallet;
  }
  
  console.log('❌ No connected wallet detected');
  return null;
}

/**
 * Creates a connection using the exact RPC endpoint from working HTML
 */
export function createConnection(): Connection | null {
  // Only run on client side to avoid hydration errors
  if (typeof window === 'undefined') {
    return null;
  }
  
  // Use the exact RPC endpoint from working HTML
  const rpcEndpoint = "https://rpc.testnet.carv.io/rpc";
  return new Connection(rpcEndpoint, "confirmed");
}

/**
 * Gets wallet info including connection - matches working HTML exactly
 */
export function getWalletInfo(): WalletInfo {
  const detectedWallet = detectWallet();
  
  if (!detectedWallet) {
    return {
      detectedWallet: null,
      connection: null,
      address: null
    };
  }

  const connection = createConnection();
  const address = detectedWallet.provider.publicKey?.toString() || null;

  return {
    detectedWallet,
    connection,
    address
  };
}

/**
 * Checks if any wallet is available (even if not connected)
 */
export function isWalletAvailable(): boolean {
  // Only run on client side to avoid hydration errors
  if (typeof window === 'undefined') {
    return false;
  }
  
  const solana = (window as any).solana;
  const backpack = (window as any).backpack;
  const solflare = (window as any).solflare;
  
  return !!(solana || backpack || solflare);
}

/**
 * Gets wallet display name for UI
 */
export function getWalletDisplayName(wallet: any): string {
  // Only run on client side to avoid hydration errors
  if (typeof window === 'undefined' || !wallet) {
    return 'Unknown';
  }
  
  if (wallet === (window as any).backpack) return 'Backpack';
  if (wallet === (window as any).solflare) return 'Solflare';
  
  // For solana wallet, check if it's Phantom
  const solana = (window as any).solana;
  if (wallet === solana) {
    if (solana?.isPhantom) return 'Phantom';
    return 'Solana Wallet';
  }
  
  return 'Wallet';
}

/**
 * Formats address for display - matches working HTML approach
 */
export function formatAddress(address: string): string {
  if (!address) return '';
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}