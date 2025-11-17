'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { SolanaIcon } from '@/components/icons/solana';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { NFTService, NFTData } from '@/lib/nft-service';
import { DomainService } from '@/lib/domain-service';
import { Transaction, SystemProgram, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';

type TransferSolNftModalProps = {
  isOpen: boolean;
  onClose: () => void;
  domainName: string;
};

export function TransferSolNftModal({ isOpen, onClose, domainName }: TransferSolNftModalProps) {
  const [recipient, setRecipient] = useState('');
  const [solAmount, setSolAmount] = useState('');
  const [selectedNft, setSelectedNft] = useState<NFTData | null>(null);
  const [verifiedNFTs, setVerifiedNFTs] = useState<NFTData[]>([]);
  const [unverifiedNFTs, setUnverifiedNFTs] = useState<NFTData[]>([]);
  const [allNFTs, setAllNFTs] = useState<NFTData[]>([]);
  const [isLoadingNFTs, setIsLoadingNFTs] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [walletConnected, setWalletConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string>('');
  const [activeTab, setActiveTab] = useState('sol');
  const [nftTab, setNftTab] = useState('verified');
  const [lastLoadedAt, setLastLoadedAt] = useState<Date | null>(null);
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const { toast } = useToast();

  const nftService = new NFTService();
  const domainService = new DomainService();

  useEffect(() => {
    // Set client flag to prevent hydration errors
    setIsClient(true);
  }, []);

  // Monitor wallet connection status in real-time
  useEffect(() => {
    if (!isClient) return;

    const checkWalletStatus = () => {
      // Support Phantom, Backpack, and OKX wallets
      const phantomProvider = (window as any).solana;
      const backpackProvider = (window as any).backpack;
      const okxProvider = (window as any).okxwallet?.solana;
      
      let walletProvider = null;
      if (backpackProvider?.isConnected) {
        walletProvider = backpackProvider;
      } else if (okxProvider?.isConnected) {
        walletProvider = okxProvider;
      } else if (phantomProvider?.isConnected) {
        walletProvider = phantomProvider;
      }
      
      const isConnected = walletProvider?.isConnected;
      const publicKey = walletProvider?.publicKey?.toString();
      
      setWalletConnected(isConnected || false);
      setWalletAddress(publicKey || '');
      
      // Load wallet balance if connected
      if (isConnected && walletProvider?.publicKey) {
        loadWalletBalance(walletProvider.publicKey);
      }
    };

    // Check immediately
    checkWalletStatus();

    // Set up interval for real-time monitoring
    const interval = setInterval(checkWalletStatus, 1000);

    // Listen for wallet events from all providers
    const phantomProvider = (window as any).solana;
    const backpackProvider = (window as any).backpack;
    const okxProvider = (window as any).okxwallet?.solana;
    
    if (phantomProvider) {
      phantomProvider.on?.('connect', checkWalletStatus);
      phantomProvider.on?.('disconnect', checkWalletStatus);
    }
    if (backpackProvider) {
      backpackProvider.on?.('connect', checkWalletStatus);
      backpackProvider.on?.('disconnect', checkWalletStatus);
    }
    if (okxProvider) {
      okxProvider.on?.('connect', checkWalletStatus);
      okxProvider.on?.('disconnect', checkWalletStatus);
    }

    return () => {
      clearInterval(interval);
      if (phantomProvider) {
        phantomProvider.off?.('connect', checkWalletStatus);
        phantomProvider.off?.('disconnect', checkWalletStatus);
      }
      if (backpackProvider) {
        backpackProvider.off?.('connect', checkWalletStatus);
        backpackProvider.off?.('disconnect', checkWalletStatus);
      }
      if (okxProvider) {
        okxProvider.off?.('connect', checkWalletStatus);
        okxProvider.off?.('disconnect', checkWalletStatus);
      }
    };
  }, [isClient]);

  // Load wallet balance
  const loadWalletBalance = async (publicKey: any) => {
    try {
      const balance = await nftService.getWalletBalance(publicKey);
      setWalletBalance(balance);
    } catch (error) {
      console.error('Error loading wallet balance:', error);
      setWalletBalance(0);
    }
  };

  // Load user's NFTs with enhanced error handling
  const loadUserNFTs = async (showToast = true) => {
    if (!isClient) return;
    
    const walletProvider = (window as any).solana;
    
    if (!walletConnected || !walletProvider?.isConnected) {
      if (showToast) {
        toast({
          variant: 'destructive',
          title: 'Wallet not connected',
          description: 'Please connect your Phantom wallet to view your NFTs.',
        });
      }
      setVerifiedNFTs([]);
      setUnverifiedNFTs([]);
      setAllNFTs([]);
      return;
    }

    setIsLoadingNFTs(true);
    try {
      console.log('🔍 Loading user NFTs for:', walletAddress);
      
      // Load verified NFTs and all NFTs in parallel
      const [verifiedNfts, allNfts] = await Promise.all([
        nftService.getUserNFTs(walletProvider.publicKey, false),
        nftService.getAllUserNFTs(walletProvider.publicKey)
      ]);
      
      // Filter unverified NFTs
      const unverifiedNfts = allNfts.filter(nft => !nft.verified);
      
      setVerifiedNFTs(verifiedNfts);
      setUnverifiedNFTs(unverifiedNfts);
      setAllNFTs(allNfts);
      setLastLoadedAt(new Date());
      
      if (showToast) {
        if (allNfts.length === 0) {
          toast({
            title: 'No NFTs Found',
            description: 'You don\'t have any NFTs in your wallet.',
          });
        } else {
          console.log(`✅ Loaded ${allNfts.length} total NFTs (${verifiedNfts.length} verified, ${unverifiedNfts.length} unverified)`);
          toast({
            title: 'NFTs Loaded Successfully',
            description: `Found ${allNfts.length} NFTs (${verifiedNfts.length} verified, ${unverifiedNfts.length} unverified).`,
          });
        }
      }
    } catch (error) {
      console.error('Error loading NFTs:', error);
      if (showToast) {
        toast({
          variant: 'destructive',
          title: 'Failed to Load NFTs',
          description: error instanceof Error ? error.message : 'Could not fetch your NFTs. Please try again.',
        });
      }
      setVerifiedNFTs([]);
      setUnverifiedNFTs([]);
      setAllNFTs([]);
    } finally {
      setIsLoadingNFTs(false);
    }
  };

  // Auto-load NFTs when NFT tab is selected
  const handleTabChange = (value: string) => {
    setActiveTab(value);
    if (value === 'nft') {
      loadUserNFTs(false); // Don't show toast for automatic loads
    }
  };

  // Manual refresh functionality
  const handleRefreshNFTs = () => {
    loadUserNFTs(true);
  };

  // Reset form and load NFTs when modal opens
  useEffect(() => {
    if (isOpen) {
      setRecipient('');
      setSolAmount('');
      setSelectedNft(null);
      
      // Load wallet balance if connected
      const walletProvider = (window as any).solana;
      if (walletProvider?.publicKey) {
        loadWalletBalance(walletProvider.publicKey);
      }
      
      // Auto-load NFTs if on NFT tab
      if (activeTab === 'nft') {
        loadUserNFTs(false);
      }
    }
  }, [isOpen, activeTab]);

  // Auto-refresh NFTs every 30 seconds when modal is open and on NFT tab
  useEffect(() => {
    if (!isOpen || activeTab !== 'nft' || !walletConnected) return;

    const interval = setInterval(() => {
      loadUserNFTs(false); // Silent refresh
    }, 30000);

    return () => clearInterval(interval);
  }, [isOpen, activeTab, walletConnected, isClient]);

  const handleSendSOL = async () => {
    if (!recipient) {
      toast({ variant: 'destructive', title: 'Error', description: 'Recipient is required.' });
      return;
    }
    if (!solAmount || parseFloat(solAmount) <= 0) {
      toast({ variant: 'destructive', title: 'Error', description: 'Please enter a valid SOL amount.' });
      return;
    }

    const amount = parseFloat(solAmount);
    
    // Check balance
    if (amount + 0.01 > walletBalance) { // Adding estimated transaction fee
      toast({ 
        variant: 'destructive', 
        title: 'Insufficient Balance', 
        description: `Need ${(amount + 0.01).toFixed(4)} SOL (${amount} + ~0.01 fee), have ${walletBalance.toFixed(4)} SOL.` 
      });
      return;
    }

    setIsSending(true);
    try {
      let recipientPubkey: PublicKey;

      // Check if recipient is a .carv domain or Solana address
      if (recipient.endsWith('.carv')) {
        console.log('🔍 Resolving .carv domain:', recipient);
        const resolvedAddress = await domainService.resolveDomain(recipient);
        
        if (!resolvedAddress) {
          toast({
            variant: 'destructive',
            title: 'Domain Not Found',
            description: `The domain "${recipient}" does not exist, is expired, or is not active.`
          });
          return;
        }
        
        recipientPubkey = resolvedAddress;
        console.log('✅ Domain resolved to:', recipientPubkey.toString());
        
        toast({
          title: 'Domain Resolved',
          description: `${recipient} → ${recipientPubkey.toString().slice(0, 8)}...${recipientPubkey.toString().slice(-8)}`,
        });
      } else {
        try {
          recipientPubkey = new PublicKey(recipient);
        } catch (error) {
          toast({
            variant: 'destructive',
            title: 'Invalid Address',
            description: 'Please enter a valid Solana address or .carv domain.'
          });
          return;
        }
      }

      const lamports = amount * LAMPORTS_PER_SOL;

      console.log('🚀 Starting SOL transfer:', {
        to: recipientPubkey.toString(),
        amount: amount,
        lamports: lamports,
        balance: walletBalance
      });

      // Support Phantom, Backpack, and OKX wallets
      const phantomProvider = (window as any).solana;
      const backpackProvider = (window as any).backpack;
      const okxProvider = (window as any).okxwallet?.solana;
      
      let walletProvider = null;
      if (backpackProvider?.isConnected) {
        walletProvider = backpackProvider;
      } else if (okxProvider?.isConnected) {
        walletProvider = okxProvider;
      } else if (phantomProvider?.isConnected) {
        walletProvider = phantomProvider;
      }
      
      if (!walletProvider) {
        throw new Error('Wallet provider not available');
      }

      // Use the EXACT working approach from your HTML
      const transferIx = SystemProgram.transfer({
        fromPubkey: walletProvider.publicKey,
        toPubkey: recipientPubkey,
        lamports: lamports
      });

      const transaction = new Transaction();
      transaction.add(transferIx);
      transaction.feePayer = walletProvider.publicKey;

      // Get blockhash with 'confirmed' commitment (matching HTML exactly)
      const { blockhash, lastValidBlockHeight } = await nftService.connection.getLatestBlockhash('confirmed');
      transaction.recentBlockhash = blockhash;

      console.log('🔍 Transaction prepared:', {
        blockhash: blockhash,
        lastValidBlockHeight: lastValidBlockHeight,
        feePayer: transaction.feePayer?.toString(),
        instructions: transaction.instructions.length
      });

      console.log('🚀 Requesting signature from wallet...');
      const signed = await walletProvider.signTransaction(transaction);

      console.log('🚀 Sending raw transaction...');
      const signature = await nftService.connection.sendRawTransaction(signed.serialize(), {
        skipPreflight: false,
        preflightCommitment: 'confirmed'
      });

      console.log('🚀 Transaction sent, confirming...');
      const confirmation = await nftService.connection.confirmTransaction({
        signature: signature,
        blockhash: blockhash,
        lastValidBlockHeight: lastValidBlockHeight
      }, 'confirmed');

      if (confirmation.value.err) {
        throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
      }

      console.log('✅ Transaction confirmed successfully:', signature);

      toast({
        title: 'SOL Sent Successfully! ✅',
        description: `${amount} SOL sent to ${recipient}. Tx: ${signature.slice(0, 8)}...`,
      });

      // Refresh balance
      loadWalletBalance(walletProvider.publicKey);
      onClose();
    } catch (error: any) {
      console.error('Failed to send SOL:', error);
      
      let errorTitle = 'Send Failed';
      let errorMsg = error.message || error.toString();
      
      // Handle specific wallet errors
      if (errorMsg?.includes('Plugin Closed') || errorMsg?.includes('Plugin closed')) {
        errorTitle = 'Wallet Extension Issue';
        errorMsg = 'Wallet extension connection lost. Please refresh the page and reconnect your wallet.';
      } else if (errorMsg?.includes('WalletSendTransactionError') || errorMsg?.includes('Unexpected error')) {
        errorTitle = 'Transaction Error';
        errorMsg = 'Transaction failed to send. Please check your wallet balance and try again.';
      } else if (errorMsg.includes('User rejected') || errorMsg.includes('User rejected the request')) {
        errorTitle = 'Transaction Cancelled';
        errorMsg = 'Transaction was cancelled by user.';
      } else if (errorMsg.includes('insufficient') || errorMsg.includes('Insufficient balance')) {
        errorTitle = 'Insufficient Balance';
        errorMsg = `Insufficient SOL balance for this transaction. You have ${walletBalance.toFixed(4)} SOL.`;
      } else if (errorMsg.includes('Failed to get recent blockhash')) {
        errorTitle = 'Network Error';
        errorMsg = 'Unable to connect to Solana network. Please check your internet connection.';
      }
      
      toast({
        variant: 'destructive',
        title: errorTitle,
        description: errorMsg,
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleSendNFT = async () => {
    if (!recipient) {
      toast({ variant: 'destructive', title: 'Error', description: 'Recipient is required.' });
      return;
    }
    if (!selectedNft) {
      toast({ variant: 'destructive', title: 'Error', description: 'Please select an NFT to send.' });
      return;
    }

    // Check balance for NFT transfer (need SOL for transaction fees)
    const requiredBalance = 0.05; // Minimum estimated fee for NFT transfer on CARV SVM
    if (walletBalance < requiredBalance) {
      toast({
        variant: 'destructive',
        title: 'Insufficient Balance',
        description: `Need at least ${requiredBalance} SOL for transaction fees on CARV SVM. You have ${walletBalance.toFixed(4)} SOL.`
      });
      return;
    }

    setIsSending(true);
    try {
      let recipientPubkey: PublicKey;

      if (recipient.endsWith('.carv')) {
        console.log('🔍 Resolving .carv domain:', recipient);
        const resolvedAddress = await domainService.resolveDomain(recipient);
        
        if (!resolvedAddress) {
          toast({
            variant: 'destructive',
            title: 'Domain Not Found',
            description: `The domain "${recipient}" does not exist, is expired, or is not active.`
          });
          return;
        }
        
        recipientPubkey = resolvedAddress;
        console.log('✅ Domain resolved to:', recipientPubkey.toString());
        
        toast({
          title: 'Domain Resolved',
          description: `${recipient} → ${recipientPubkey.toString().slice(0, 8)}...${recipientPubkey.toString().slice(-8)}`,
        });
      } else {
        try {
          recipientPubkey = new PublicKey(recipient);
        } catch (error) {
          toast({
            variant: 'destructive',
            title: 'Invalid Address',
            description: 'Please enter a valid Solana address or .carv domain.'
          });
          return;
        }
      }

      // Support Phantom, Backpack, and OKX wallets
      const phantomProvider = (window as any).solana;
      const backpackProvider = (window as any).backpack;
      const okxProvider = (window as any).okxwallet?.solana;
      
      let walletProvider = null;
      if (backpackProvider?.isConnected) {
        walletProvider = backpackProvider;
      } else if (okxProvider?.isConnected) {
        walletProvider = okxProvider;
      } else if (phantomProvider?.isConnected) {
        walletProvider = phantomProvider;
      }
      
      if (!walletProvider || !walletProvider.isConnected) {
        toast({
          variant: 'destructive',
          title: 'Wallet not connected',
          description: 'Please connect your wallet first.',
        });
        return;
      }

      console.log('🚀 Starting NFT transfer:', {
        nft: selectedNft.name,
        mint: selectedNft.mint,
        verified: selectedNft.verified,
        balance: walletBalance,
        to: recipientPubkey.toString()
      });

      const signature = await nftService.transferNFT(
        selectedNft.mint,
        walletProvider.publicKey,
        recipientPubkey,
        walletProvider
      );

      toast({
        title: 'NFT Sent Successfully! ✅',
        description: `${selectedNft.name} sent to ${recipient}. Tx: ${signature.slice(0, 8)}...`,
      });
      
      // Refresh balance
      loadWalletBalance(walletProvider.publicKey);
      onClose();
    } catch (error: any) {
      console.error('Failed to send NFT:', error);
      
      let errorTitle = 'Send Failed';
      let errorMsg = error.message || error.toString();
      
      // Enhanced error handling for NFT transfers
      if (errorMsg?.includes('Insufficient SOL balance') || errorMsg?.includes('Need at least')) {
        errorTitle = 'Insufficient Balance';
        errorMsg = `Insufficient SOL balance for transaction fees. You have ${walletBalance.toFixed(4)} SOL, need at least 0.05 SOL.`;
      } else if (errorMsg?.includes('Plugin Closed') || errorMsg?.includes('Plugin closed')) {
        errorTitle = 'Wallet Extension Issue';
        errorMsg = 'Wallet extension connection lost. Please refresh the page and reconnect your wallet.';
      } else if (errorMsg.includes('User rejected') || errorMsg.includes('User rejected the request')) {
        errorTitle = 'Transaction Cancelled';
        errorMsg = 'Transaction was cancelled by user.';
      } else if (errorMsg.includes('AccountNotFound') || errorMsg.includes('Invalid account')) {
        errorTitle = 'Account Error';
        errorMsg = 'Could not find the required token account. Please try again.';
      }
      
      toast({
        variant: 'destructive',
        title: errorTitle,
        description: errorMsg,
      });
    } finally {
      setIsSending(false);
    }
  };

  // Get current NFTs based on the selected NFT tab
  const getCurrentNFTs = () => {
    switch (nftTab) {
      case 'verified':
        return verifiedNFTs;
      case 'unverified':
        return unverifiedNFTs;
      case 'all':
        return allNFTs;
      default:
        return verifiedNFTs;
    }
  };

  // Don't render wallet-dependent UI during SSR
  if (!isClient) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Send Assets</DialogTitle>
            <DialogDescription>Loading wallet connection...</DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle>Send Assets</DialogTitle>
              <DialogDescription>Send SOL or NFTs to another address or .carv domain.</DialogDescription>
            </div>
            <div className="flex items-center space-x-2">
              {/* Wallet Connection Status & Balance */}
              <div className="flex items-center space-x-1">
                <div className={`w-2 h-2 rounded-full ${walletConnected ? 'bg-green-400' : 'bg-red-400'}`} />
                <span className="text-xs text-muted-foreground">
                  {walletConnected ? `${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)} (${walletBalance.toFixed(4)} SOL)` : 'Not Connected'}
                </span>
              </div>
            </div>
          </div>
        </DialogHeader>
        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="sol">Send SOL</TabsTrigger>
            <TabsTrigger value="nft">
              Send NFT
              {walletConnected && activeTab === 'nft' && (
                <div className="ml-2 flex items-center">
                  {isLoadingNFTs ? (
                    <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
                  ) : lastLoadedAt ? (
                    <div className="w-2 h-2 bg-green-400 rounded-full" title={`Last updated: ${lastLoadedAt.toLocaleTimeString()}`} />
                  ) : (
                    <div className="w-2 h-2 bg-gray-400 rounded-full" />
                  )}
                </div>
              )}
            </TabsTrigger>
          </TabsList>
          <div className="py-4">
            <Label htmlFor="recipient">Recipient</Label>
            <Input 
              id="recipient" 
              value={recipient} 
              onChange={(e) => setRecipient(e.target.value)} 
              placeholder="friend.carv or 5c5...zG9" 
            />
          </div>
          <TabsContent value="sol">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="sol-amount">Amount</Label>
                <div className="relative">
                  <Input 
                    id="sol-amount" 
                    type="number" 
                    value={solAmount} 
                    onChange={(e) => setSolAmount(e.target.value)} 
                    placeholder="0.00"
                    step="0.01"
                    min="0"
                    max={Math.max(0, walletBalance - 0.01)}
                  />
                  <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                    <SolanaIcon className="h-5 w-5 fill-muted-foreground" />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Available: {walletBalance.toFixed(4)} SOL (Max: {Math.max(0, walletBalance - 0.01).toFixed(4)} SOL)
                </p>
              </div>
              <Button 
                className="w-full" 
                onClick={handleSendSOL}
                disabled={isSending || !solAmount || parseFloat(solAmount) <= 0 || walletBalance < parseFloat(solAmount) + 0.01}
              >
                {isSending ? 'Sending...' : 'Send SOL'}
              </Button>
            </div>
          </TabsContent>
          <TabsContent value="nft">
            <div className="space-y-4">
              {/* NFT Category Tabs */}
              <div className="space-y-2">
                <Label>NFT Categories</Label>
                <Tabs value={nftTab} onValueChange={setNftTab} className="w-full">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="verified" className="text-xs">
                      Verified ({verifiedNFTs.length})
                    </TabsTrigger>
                    <TabsTrigger value="unverified" className="text-xs">
                      Unverified ({unverifiedNFTs.length})
                    </TabsTrigger>
                    <TabsTrigger value="all" className="text-xs">
                      All ({allNFTs.length})
                    </TabsTrigger>
                  </TabsList>
                  
                  <div className="mt-4">
                    <Label>Select NFT</Label>
                    {isLoadingNFTs ? (
                      <div className="text-center py-8">
                        <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                        <p className="text-sm text-muted-foreground">Loading your NFTs...</p>
                      </div>
                    ) : getCurrentNFTs().length > 0 ? (
                      <div className="grid grid-cols-2 gap-3 max-h-64 overflow-y-auto p-1">
                        {getCurrentNFTs().map((nft) => (
                          <Card
                            key={nft.mint}
                            onClick={() => setSelectedNft(nft)}
                            className={cn("cursor-pointer transition-all overflow-hidden relative", selectedNft?.mint === nft.mint && 'ring-2 ring-primary ring-offset-2 ring-offset-background')}
                          >
                            <CardContent className="p-2">
                              {/* NFT Image */}
                              <div className="aspect-square bg-gray-100 rounded-lg flex items-center justify-center mb-2 overflow-hidden">
                                <Image
                                  src={nft.image || '/file.svg'}
                                  alt={nft.name || 'CARV SVM NFT'}
                                  width={120}
                                  height={120}
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    // If image fails to load, show fallback with metadata
                                    const target = e.target as HTMLImageElement;
                                    target.style.display = 'none';
                                    const parent = target.parentElement;
                                    if (parent && !parent.querySelector('.fallback-content')) {
                                      const fallback = document.createElement('div');
                                      fallback.className = 'fallback-content flex flex-col items-center justify-center text-center p-2 w-full h-full bg-gradient-to-br from-purple-500 to-blue-600';
                                      fallback.innerHTML = `
                                        <div class="text-white font-bold text-sm mb-1">${nft.name}</div>
                                        ${nft.symbol ? `<div class="text-white/80 text-xs mb-1">${nft.symbol}</div>` : ''}
                                        <div class="text-white/60 text-xs">${nft.collection || 'NFT'}</div>
                                      `;
                                      parent.appendChild(fallback);
                                    }
                                  }}
                                />
                              </div>
                              
                              {/* NFT Metadata */}
                              <div className="space-y-1">
                                <div className="font-semibold text-sm text-gray-900 truncate" title={nft.name}>
                                  {nft.name}
                                </div>
                                
                                {nft.symbol && (
                                  <div className="text-xs text-gray-600 truncate" title={nft.symbol}>
                                    Symbol: {nft.symbol}
                                  </div>
                                )}
                                
                                {nft.collection && (
                                  <div className="text-xs text-gray-600 truncate" title={nft.collection}>
                                    Collection: {nft.collection}
                                  </div>
                                )}
                                
                                {nft.description && (
                                  <div className="text-xs text-gray-500 line-clamp-2" title={nft.description}>
                                    {nft.description}
                                  </div>
                                )}
                                
                                <div className="text-xs text-gray-400 font-mono truncate" title={nft.mint}>
                                  {nft.mint.slice(0, 8)}...{nft.mint.slice(-6)}
                                </div>
                                
                                {/* Verification and Status Badges */}
                                <div className="flex items-center justify-between mt-1">
                                  <div className="flex items-center space-x-1">
                                    {nft.verified ? (
                                      <Badge variant="default" className="text-xs px-1 py-0 bg-green-100 text-green-800">
                                        ✓ Verified
                                      </Badge>
                                    ) : (
                                      <Badge variant="secondary" className="text-xs px-1 py-0">
                                        ? Unverified
                                      </Badge>
                                    )}
                                  </div>
                                  
                                  {nft.uri && (
                                    <div className="w-2 h-2 bg-blue-400 rounded-full" title="Has metadata URI" />
                                  )}
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 border-2 border-dashed border-gray-300 rounded-lg">
                        <p className="text-sm text-gray-500">
                          {nftTab === 'verified' ? 'No verified NFTs found' : 
                           nftTab === 'unverified' ? 'No unverified NFTs found' : 'No NFTs found in your wallet'}
                        </p>
                        {nftTab === 'verified' && unverifiedNFTs.length > 0 && (
                          <p className="text-xs text-blue-600 mt-1">
                            Switch to "Unverified" tab to see {unverifiedNFTs.length} additional NFTs
                          </p>
                        )}
                        <div className="mt-3 space-y-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleRefreshNFTs}
                            disabled={isLoadingNFTs}
                            className="w-full"
                          >
                            {isLoadingNFTs ? 'Loading...' : 'Refresh NFTs'}
                          </Button>
                          {!walletConnected && (
                            <p className="text-xs text-red-500">Connect your wallet to view NFTs</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </Tabs>
              </div>
              
              {/* Balance warning */}
              {walletBalance < 0.05 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                  <p className="text-sm text-yellow-800">
                    ⚠️ Low balance: You have {walletBalance.toFixed(4)} SOL. NFT transfers require at least 0.05 SOL for fees on CARV SVM.
                  </p>
                </div>
              )}
              
              <Button
                className="w-full"
                onClick={handleSendNFT}
                disabled={!selectedNft || isSending || walletBalance < 0.05}
              >
                {isSending ? 'Sending...' : `Send NFT${selectedNft ? (selectedNft.verified ? '' : ' (Unverified)') : ''}`}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
