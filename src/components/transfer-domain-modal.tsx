'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { DomainService } from '@/lib/domain-service';
import { PublicKey } from '@solana/web3.js';
import { Connection } from '@solana/web3.js';

type TransferDomainModalProps = {
  isOpen: boolean;
  onClose: () => void;
  domainName: string;
  onTransfer?: (domainName: string) => void;
};

export function TransferDomainModal({ isOpen, onClose, domainName, onTransfer }: TransferDomainModalProps) {
  const [recipient, setRecipient] = useState('');
  const [isTransferring, setIsTransferring] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    // Set client flag to prevent hydration errors
    setIsClient(true);
  }, []);

  const handleTransfer = async () => {
    if (!recipient) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Please enter a recipient address or domain.',
      });
      return;
    }

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
        description: 'Please connect your wallet to transfer the domain.',
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

    setIsTransferring(true);
    try {
      let recipientPubkey: PublicKey;

      // Check if recipient is a .carv domain or Solana address
      if (recipient.endsWith('.carv')) {
        // For now, assume it's a Solana address. In a real app, you'd resolve .carv domains
        toast({
          variant: 'destructive',
          title: 'Not implemented',
          description: '.carv domain resolution not yet implemented. Please use a Solana address.',
        });
        return;
      } else {
        try {
          recipientPubkey = new PublicKey(recipient);
        } catch (error) {
          toast({
            variant: 'destructive',
            title: 'Invalid Address',
            description: 'Please enter a valid Solana address.',
          });
          return;
        }
      }

      const domainService = new DomainService();
      const walletAddress = walletProvider.publicKey;
      
      console.log('🚀 Transferring domain (exact HTML approach):', {
        domainName,
        owner: walletAddress.toString(),
        newOwner: recipientPubkey.toString(),
        provider: 'Phantom'
      });

      // Create transaction with fresh blockhash
      const transaction = await domainService.createTransferTransaction(domainName, walletAddress, recipientPubkey);
      transaction.feePayer = walletAddress;
      
      console.log('🔍 Transaction prepared for transfer:', {
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
      
      console.log('✅ Domain transfer confirmed:', signature);
      
      toast({
        title: 'Domain Transferred! ✅',
        description: `Successfully transferred ${domainName}.carv to ${recipient}. Tx: ${signature.slice(0, 8)}...`,
      });

      onTransfer?.(domainName);
      onClose();
      setRecipient('');
    } catch (error: any) {
      console.error('Transfer failed:', error);
      
      // Enhanced error handling matching working HTML
      let errorTitle = 'Transfer Failed';
      let errorDescription = 'Failed to transfer domain. Please try again.';
      const errorMsg = error?.message || error?.toString() || '';

      // Check for specific wallet errors and provide helpful messages
      if (errorMsg.includes('Plugin Closed') ||
          errorMsg.includes('Plugin closed')) {
        errorTitle = 'Wallet Extension Issue';
        errorDescription = 'Wallet extension connection lost. Please refresh the page and reconnect your wallet, then try again.';
      } else if (errorMsg.includes('WalletSendTransactionError') ||
                 errorMsg.includes('Unexpected error')) {
        errorTitle = 'Transaction Error';
        errorDescription = 'Transaction failed to send. Please check your wallet balance and try again.';
      } else if (errorMsg.includes('User rejected') ||
                 errorMsg.includes('User rejected the request')) {
        errorTitle = 'Transaction Cancelled';
        errorDescription = 'Transaction was cancelled by user.';
      } else if (errorMsg.includes('insufficient') ||
                 errorMsg.includes('Insufficient balance')) {
        errorTitle = 'Insufficient Balance';
        errorDescription = 'Insufficient SOL balance. Please add funds to your wallet and try again.';
      } else if (errorMsg.includes('Invalid') ||
                 errorMsg.includes('Invalid public key')) {
        errorTitle = 'Invalid Address';
        errorDescription = 'Please enter a valid Solana address.';
      } else if (errorMsg.includes('Transaction failed')) {
        errorTitle = 'Transaction Failed';
        errorDescription = 'The transaction failed. Please check your wallet balance and try again.';
      }
      
      toast({
        variant: 'destructive',
        title: errorTitle,
        description: errorDescription,
      });
    } finally {
      setIsTransferring(false);
    }
  };

  // Don't render wallet-dependent UI during SSR to prevent hydration errors
  if (!isClient) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Transfer {domainName}.carv</DialogTitle>
            <DialogDescription>
              Loading wallet connection...
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <p className="text-sm text-muted-foreground text-center">Please wait while we check your wallet connection.</p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Transfer {domainName}.carv</DialogTitle>
          <DialogDescription>
            Enter the recipient's Solana address or .carv domain. This action is irreversible.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid w-full gap-1.5">
            <Label htmlFor="recipient">Recipient Address or Domain</Label>
            <Input
              id="recipient"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              placeholder="e.g., friend.carv or 5c5...zG9"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isTransferring}>Cancel</Button>
          <Button variant="destructive" onClick={handleTransfer} disabled={isTransferring}>
            {isTransferring ? 'Transferring...' : 'Confirm Transfer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
