'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SolanaIcon } from '@/components/icons/solana';
import { useState, useEffect } from 'react';
import { DomainService } from '@/lib/domain-service';
import { useToast } from '@/hooks/use-toast';
import { Connection } from '@solana/web3.js';

type RenewDomainModalProps = {
  isOpen: boolean;
  onClose: () => void;
  domainName: string;
  onRenew: (domainName: string) => void;
};

export function RenewDomainModal({ isOpen, onClose, domainName, onRenew }: RenewDomainModalProps) {
  const [isRenewing, setIsRenewing] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    // Set client flag to prevent hydration errors
    setIsClient(true);
  }, []);

  const handleConfirm = async () => {
    // Use direct wallet access - support Phantom, Backpack, and OKX
    const phantomProvider = (window as any).solana;
    const backpackProvider = (window as any).backpack;
    const okxProvider = (window as any).okxwallet?.solana;
    
    // Detect which wallet is connected
    let walletProvider = null;
    let walletName = '';
    
    if (backpackProvider?.isConnected) {
      walletProvider = backpackProvider;
      walletName = 'Backpack';
    } else if (okxProvider?.isConnected) {
      walletProvider = okxProvider;
      walletName = 'OKX';
    } else if (phantomProvider?.isConnected) {
      walletProvider = phantomProvider;
      walletName = 'Phantom';
    }
    
    if (!walletProvider) {
      toast({
        variant: 'destructive',
        title: 'Wallet not connected',
        description: 'Please connect your wallet to renew the domain.',
      });
      return;
    }

    if (!walletProvider.isConnected) {
      toast({
        variant: 'destructive',
        title: 'Wallet not connected',
        description: 'Please connect your wallet first.',
      });
      return;
    }
    
    console.log('🔍 Using wallet:', walletName);

    setIsRenewing(true);
    try {
      const domainService = new DomainService();
      const walletAddress = walletProvider.publicKey;
      
      console.log('🚀 Renewing domain (exact HTML approach):', {
        domainName,
        owner: walletAddress.toString(),
        provider: 'Phantom'
      });

      // Use the exact working approach from your HTML
      const transaction = await domainService.createRenewTransaction(domainName, walletAddress);
      transaction.feePayer = walletAddress;
      
      console.log('🔍 Transaction prepared for renewal:', {
        feePayer: transaction.feePayer?.toString(),
        blockhash: transaction.recentBlockhash,
        instructions: transaction.instructions.length
      });

      console.log('🚀 Requesting signature from wallet...');
      const signed = await walletProvider.signTransaction(transaction);

      // Create connection (matching HTML)
      const connection = new Connection("https://rpc.testnet.carv.io/rpc", "confirmed");

      console.log('🚀 Sending raw transaction...');
      const signature = await connection.sendRawTransaction(signed.serialize(), {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
        maxRetries: 3
      });

      console.log('🔍 Confirming transaction...');
      const confirmation = await connection.confirmTransaction({
        signature,
        blockhash: transaction.recentBlockhash!,
        lastValidBlockHeight: Date.now() + 60000 // 1 minute timeout
      }, 'confirmed');

      if (confirmation.value.err) {
        throw new Error('Transaction failed');
      }
      
      console.log('✅ Domain renewal confirmed:', signature);
      
      toast({
        title: 'Domain Renewed! ✅',
        description: `Successfully renewed ${domainName}.carv. Tx: ${signature.slice(0, 8)}...`,
      });

      onRenew(domainName);
      onClose();
    } catch (error: any) {
      console.error('Renewal failed:', error);
      
      // Provide user-friendly error messages matching working HTML
      let errorMessage = 'Failed to renew domain. Please try again.';
      let errorTitle = 'Renewal Failed';

      if (error?.message?.includes('Plugin Closed') || error?.message?.includes('Plugin closed')) {
        errorTitle = 'Wallet Connection Issue';
        errorMessage = 'Wallet extension connection lost. Please refresh the page and reconnect your wallet, then try again.';
      } else if (error?.message?.includes('User rejected') || error?.message?.includes('User rejected the request')) {
        errorTitle = 'Transaction Cancelled';
        errorMessage = 'Transaction was cancelled by user.';
      } else if (error?.message?.includes('insufficient') || error?.message?.includes('Insufficient balance')) {
        errorTitle = 'Insufficient Balance';
        errorMessage = 'Insufficient SOL balance for renewal. Please add funds to your wallet and try again.';
      } else if (error?.message?.includes('Transaction failed')) {
        errorTitle = 'Transaction Failed';
        errorMessage = 'The transaction failed. Please check your wallet balance and try again.';
      }

      toast({
        variant: 'destructive',
        title: errorTitle,
        description: errorMessage,
      });
    } finally {
      setIsRenewing(false);
    }
  };

  // Don't render wallet-dependent UI during SSR to prevent hydration errors
  if (!isClient) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Renew {domainName}.carv</DialogTitle>
            <DialogDescription>
              Loading wallet connection...
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <p className="text-sm text-muted-foreground text-center">Please wait while we check your wallet connection.</p>
          </div>
          <DialogFooter className="sm:justify-between gap-2">
            <DialogClose asChild>
              <Button type="button" variant="secondary" className='w-full sm:w-auto'>
                Cancel
              </Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Renew {domainName}.carv</DialogTitle>
          <DialogDescription>
            Extend your domain registration for another year.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-4">
            <div className="flex items-center justify-between rounded-lg border p-4">
                <div>
                    <p className="font-medium">1 Year Renewal</p>
                    <p className="text-sm text-muted-foreground">Extend registration until next year.</p>
                </div>
                <Badge variant="secondary" className="flex items-center gap-2">
                    <SolanaIcon className="h-4 w-4 fill-current" />
                    0.02 SOL
                </Badge>
            </div>
            <p className="text-xs text-muted-foreground text-center">
                This transaction will be processed on the Solana blockchain.
            </p>
        </div>
        <DialogFooter className="sm:justify-between gap-2">
            <DialogClose asChild>
                <Button type="button" variant="secondary" className='w-full sm:w-auto'>
                    Cancel
                </Button>
            </DialogClose>
          <Button type="button" onClick={handleConfirm} disabled={isRenewing} className='w-full sm:w-auto'>
            {isRenewing ? 'Renewing...' : 'Confirm & Pay'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
