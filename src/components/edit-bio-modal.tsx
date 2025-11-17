'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { DomainService } from '@/lib/domain-service';
import { Connection } from '@solana/web3.js';

type EditBioModalProps = {
  isOpen: boolean;
  onClose: () => void;
  domain: { name: string; bio: string };
  onUpdateBio: (domainName: string, newBio: string) => void;
};

export function EditBioModal({ isOpen, onClose, domain, onUpdateBio }: EditBioModalProps) {
  const [bio, setBio] = useState(domain.bio);
  const [isSaving, setIsSaving] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    // Set client flag to prevent hydration errors
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (isOpen && isClient) {
      setBio(domain.bio);
    }
  }, [isOpen, domain.bio, isClient]);

  const handleSave = async () => {
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
        description: 'Please connect your wallet to update the bio.',
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

    setIsSaving(true);
    try {
      const domainService = new DomainService();
      const walletAddress = walletProvider.publicKey;
      
      console.log('🚀 Updating bio (exact HTML approach):', {
        domainName: domain.name,
        owner: walletAddress.toString(),
        bioLength: bio.length,
        provider: 'Phantom'
      });

      // Create transaction with fresh blockhash
      const transaction = await domainService.createSetDataTransaction(domain.name, walletAddress, bio);
      transaction.feePayer = walletAddress;
      
      console.log('🔍 Transaction prepared for bio update:', {
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
      
      console.log('✅ Bio update confirmed:', signature);
      
      toast({
        title: 'Bio Updated! ✅',
        description: `Successfully updated bio for ${domain.name}.carv. Tx: ${signature.slice(0, 8)}...`,
      });

      onUpdateBio(domain.name, bio);
      onClose();
    } catch (error: any) {
      console.error('Bio update failed:', error);
      
      // Provide user-friendly error messages matching working HTML
      let errorMessage = 'Failed to update bio. Please try again.';
      let errorTitle = 'Update Failed';

      if (error?.message?.includes('Plugin Closed') || error?.message?.includes('Plugin closed')) {
        errorTitle = 'Wallet Connection Issue';
        errorMessage = 'Wallet extension connection lost. Please refresh the page and reconnect your wallet, then try again.';
      } else if (error?.message?.includes('WalletSendTransactionError') || error?.message?.includes('Unexpected error')) {
        errorTitle = 'Transaction Error';
        errorMessage = 'Transaction failed to send. Please check your wallet and try again.';
      } else if (error?.message?.includes('User rejected') || error?.message?.includes('User rejected the request')) {
        errorTitle = 'Transaction Cancelled';
        errorMessage = 'Transaction was cancelled by user.';
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
      setIsSaving(false);
    }
  };

  // Don't render wallet-dependent UI during SSR to prevent hydration errors
  if (!isClient) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit Bio for {domain.name}.carv</DialogTitle>
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
          <DialogTitle>Edit Bio for {domain.name}.carv</DialogTitle>
          <DialogDescription>
            Update the public profile information for your domain. This will be visible to others.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid w-full gap-1.5">
            <Label htmlFor="bio">Your Bio</Label>
            <Textarea
              id="bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell everyone a little about yourself."
              rows={4}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSaving}>Cancel</Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
