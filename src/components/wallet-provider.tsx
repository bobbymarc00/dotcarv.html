'use client';

import { useMemo, type ReactNode, useEffect } from 'react';
import { ConnectionProvider, WalletProvider as SolanaWalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { PhantomWalletAdapter } from '@solana/wallet-adapter-phantom';
import { BackpackWalletAdapter } from '@solana/wallet-adapter-backpack';
import { rpcEndpoint } from '@/lib/config';
import { WalletError } from '@solana/wallet-adapter-base';

export function WalletProvider({ children }: { children: ReactNode }) {
  // Ensure we have a valid endpoint
  const endpoint = rpcEndpoint || 'https://rpc.testnet.carv.io/rpc';
  
  const wallets = useMemo(() => [
    new PhantomWalletAdapter({
      onError: (error: WalletError) => {
        console.error('Phantom wallet error:', error);
        if (error.message && error.message.toLowerCase().includes('metamask')) {
          return;
        }
      }
    }),
    new BackpackWalletAdapter({
      onError: (error: WalletError) => {
        console.error('Backpack wallet error:', error);
        if (error.message && error.message.toLowerCase().includes('metamask')) {
          return;
        }
      }
    }),
  ], []);

  // Filter out MetaMask from automatic wallet detection
  useEffect(() => {
    // Override wallet detection to exclude MetaMask
    if (typeof window !== 'undefined') {
      // Store original ethereum if it exists
      const originalEthereum = (window as any).ethereum;
      if (originalEthereum && originalEthereum.isMetaMask) {
        // Hide MetaMask from detection
        originalEthereum.isMetaMask = false;
        
        // Suppress MetaMask connection errors
        const originalError = console.error;
        console.error = (...args) => {
          const message = args.join(' ');
          if (message.includes('Failed to connect to MetaMask') ||
              message.includes('nkbihfbeogaeaoehlefnkodbefgpgknn')) {
            return;
          }
          originalError.apply(console, args);
        };

        return () => {
          console.error = originalError;
          // Restore MetaMask flag on cleanup
          if (originalEthereum) {
            originalEthereum.isMetaMask = true;
          }
        };
      }
    }
  }, []);

  // Fallback endpoint if config is not loaded
  const finalEndpoint = endpoint || 'https://rpc.testnet.carv.io/rpc';

  return (
    <ConnectionProvider endpoint={finalEndpoint}>
      <SolanaWalletProvider
        wallets={wallets}
        autoConnect={false}
        onError={(error: WalletError) => {
          // Suppress MetaMask errors at the provider level
          if (error.message &&
              (error.message.toLowerCase().includes('metamask') ||
               error.message.includes('nkbihfbeogaeaoehlefnkodbefgpgknn'))) {
            return;
          }
          
          // Only suppress MetaMask and plugin errors - don't suppress WalletSendTransactionError
          if (error.message &&
              (error.message.includes('Plugin Closed') ||
               error.message.includes('nkbihfbeogaeaoehlefnkodbefgpgknn'))) {
            return;
          }
          
          console.error('Wallet provider error:', error);
        }}
      >
        <WalletModalProvider>
          {children}
        </WalletModalProvider>
      </SolanaWalletProvider>
    </ConnectionProvider>
  );
}
