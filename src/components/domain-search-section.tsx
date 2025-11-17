'use client';

import { useState, useTransition, type FormEvent, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Search, LoaderCircle, CheckCircle, XCircle, RefreshCw, Send, Image } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { DomainService } from '@/lib/domain-service';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { Transaction, SystemProgram, LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';

type SearchResult = {
  domain: string;
  available: boolean;
  owner?: string;
  metadata?: string;
};

type SendAssetsModal = {
  isOpen: boolean;
  domain: string;
  owner: string;
  type: 'SOL' | 'NFT';
};

export function DomainSearchSection() {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResult, setSearchResult] = useState<SearchResult | null>(null);
  const [isSearching, startSearchTransition] = useTransition();
  const [isRegistering, setIsRegistering] = useState(false);
  const [sendModal, setSendModal] = useState<SendAssetsModal | null>(null);
  const [sendAmount, setSendAmount] = useState('');
  const [nftMintAddress, setNftMintAddress] = useState('');
  const [isSending, setIsSending] = useState(false);

  const { toast } = useToast();
  const { publicKey, sendTransaction, connected, wallet, signTransaction } = useWallet();
  const { connection } = useConnection();

  const handleSearch = async (event: FormEvent) => {
    event.preventDefault();
    if (!searchTerm) return;

    setSearchResult(null);

    startSearchTransition(async () => {
      try {
        const domainService = new DomainService();
        const domainInfo = await domainService.getDomainInfo(searchTerm);
        
        if (domainInfo && domainInfo.exists) {
          setSearchResult({
            domain: searchTerm,
            available: false,
            owner: domainInfo.owner?.toString(),
            metadata: domainInfo.data
          });
        } else {
          setSearchResult({
            domain: searchTerm,
            available: true
          });
        }
      } catch (error) {
        console.error('Search failed:', error);
        setSearchResult({
          domain: searchTerm,
          available: false
        });
      }
    });
  };

  // Handle Plugin Closed error with automatic recovery
  const handlePluginClosedError = useCallback((error: any) => {
    console.log('🔧 Handling Plugin Closed error:', error.message);
    
    toast({
      variant: 'destructive',
      title: 'Wallet Connection Issue',
      description: 'Wallet extension connection was lost. Please reconnect your wallet.',
    });
  }, [toast]);

  // Simple transaction attempt using manual signing (most reliable)
  const attemptTransaction = useCallback(async (transaction: Transaction) => {
    try {
      console.log('🔐 Attempting transaction with manual signing...');
      console.log('🔍 Wallet adapter:', wallet?.adapter?.name);
      console.log('🔍 signTransaction available:', !!signTransaction);
      console.log('🔍 sendTransaction available:', !!sendTransaction);
      
      // For Backpack and OKX wallets, use sendTransaction instead of signTransaction
      // These wallets don't always expose signTransaction properly
      const walletName = wallet?.adapter?.name;
      if (walletName === 'Backpack' || walletName === 'OKX Wallet' || !signTransaction) {
        console.log(`🎒 Using sendTransaction for ${walletName || 'wallet'}...`);
        if (!sendTransaction) {
          throw new Error('Wallet connection not available. Please reconnect your wallet.');
        }
        const signature = await sendTransaction(transaction, connection);
        console.log('✅ Transaction sent via sendTransaction:', signature);
        return signature;
      }
      
      // For Phantom and other wallets, use signTransaction
      console.log('👻 Using signTransaction for standard wallet...');
      const signedTransaction = await signTransaction(transaction);
      const signature = await connection.sendRawTransaction(signedTransaction.serialize());
      console.log('✅ Transaction sent via signTransaction:', signature);
      return signature;
      
    } catch (error: any) {
      console.error('❌ Transaction failed:', error.message);
      
      // Handle Plugin Closed error specifically
      if (error.message?.includes('Plugin Closed') || error.message?.includes('Plugin closed')) {
        handlePluginClosedError(error);
        throw new Error('Wallet extension connection lost. Please reconnect and try again.');
      }
      
      // Handle user rejection
      if (error.message?.includes('User rejected') || error.message?.includes('User denied')) {
        throw new Error('Transaction cancelled by user.');
      }
      
      // Handle insufficient funds
      if (error.message?.includes('insufficient') || error.message?.includes('balance')) {
        throw new Error('Insufficient balance for transaction.');
      }
      
      // Re-throw original error for other cases
      throw error;
    }
  }, [signTransaction, connection, handlePluginClosedError]);

  const handleClaim = async (domain: string) => {
    try {
      console.log('🎯 Starting domain registration for:', domain);

      // Validate domain name
      const cleanDomain = domain.replace(/\.carv$/, '').trim();
      if (!cleanDomain || cleanDomain.length === 0) {
        throw new Error('Invalid domain name');
      }

      // Verify wallet is ready
      if (!wallet || !publicKey || !connected) {
        throw new Error('Please connect your wallet first.');
      }
      
      console.log('✅ Wallet verified:', publicKey.toString());

      const domainService = new DomainService();
      
      // Check wallet balance
      console.log('💰 Checking wallet balance...');
      const balance = await domainService.checkWalletBalance(publicKey);
      const requiredAmount = 50000000; // 0.05 SOL estimated total
      
      if (balance < requiredAmount) {
        throw new Error(`Insufficient balance. You have ${(balance / LAMPORTS_PER_SOL).toFixed(4)} SOL, but need at least ${(requiredAmount / LAMPORTS_PER_SOL).toFixed(4)} SOL`);
      }
      
      // Check domain availability
      console.log('🔍 Re-checking domain availability...');
      const isAvailable = await domainService.checkDomainAvailability(cleanDomain);
      if (!isAvailable) {
        throw new Error(`Domain "${cleanDomain}" is no longer available`);
      }

      console.log('✅ Domain is available, creating transaction...');
      
      // Create complete register transaction with proper rent exemption
      const transaction = await domainService.createRegisterTransaction(cleanDomain, publicKey);
      console.log('✅ Transaction created successfully');

      // Get recent blockhash
      console.log('🔄 Getting latest blockhash...');
      const { blockhash } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = publicKey;

      console.log('🚀 Transaction prepared, sending...');

      setIsRegistering(true);

      try {
        // Single transaction attempt with manual signing
        const signature = await attemptTransaction(transaction);
        console.log('✅ Transaction successful:', signature);
        await processSuccessfulTransaction(signature, cleanDomain);
        
      } catch (transactionError: any) {
        console.error('❌ Transaction failed:', transactionError?.message || transactionError);
        
        // Provide specific error handling
        if (transactionError.message?.includes('Plugin Closed') || transactionError.message?.includes('Plugin closed')) {
          toast({
            variant: 'destructive',
            title: 'Wallet Extension Issue',
            description: 'Wallet extension connection failed. Please refresh the page and reconnect your wallet.',
          });
        } else if (transactionError.message?.includes('cancelled by user')) {
          toast({
            variant: 'destructive',
            title: 'Transaction Cancelled',
            description: 'Transaction was cancelled. Please try again if you want to proceed.',
          });
        } else {
          throw transactionError; // Re-throw to outer catch block
        }
      } finally {
        setIsRegistering(false);
      }
      
    } catch (error: any) {
      console.error('❌ Registration failed:', error);
      
      // Provide user-friendly error messages
      let errorMessage = 'Failed to register domain. Please try again.';
      
      if (error.message?.includes('Please connect your wallet')) {
        errorMessage = 'Please connect your wallet to register a domain.';
      } else if (error.message?.includes('insufficient funds') || error.message?.includes('Insufficient balance')) {
        errorMessage = 'Insufficient SOL balance. You need at least 0.05 SOL for registration.';
      } else if (error.message?.includes('Plugin Closed') || error.message?.includes('Plugin closed')) {
        errorMessage = 'Wallet extension issue. Please refresh the page and reconnect your wallet.';
      } else if (error.message?.includes('WalletSendTransactionError')) {
        errorMessage = 'Transaction failed. Please check your wallet and try again.';
      } else if (error.message?.includes('No public key available')) {
        errorMessage = 'Wallet not properly connected. Please reconnect.';
      } else if (error.message) {
        errorMessage = `Error: ${error.message}`;
      }
      
      toast({
        variant: 'destructive',
        title: 'Registration Failed',
        description: errorMessage,
      });
    } finally {
      setIsRegistering(false);
    }
  };

  // Send SOL functionality (from working HTML)
  const handleSendSOL = async () => {
    try {
      const amount = parseFloat(sendAmount);
      if (!amount || amount <= 0) {
        toast({
          variant: 'destructive',
          title: 'Invalid Amount',
          description: 'Please enter a valid SOL amount.',
        });
        return;
      }
      
      const ownerAddress = sendModal?.owner;
      if (!ownerAddress) {
        toast({
          variant: 'destructive',
          title: 'Owner Address Missing',
          description: 'Owner address not found.',
        });
        return;
      }
      
      if (!publicKey) {
        toast({
          variant: 'destructive',
          title: 'Wallet Not Connected',
          description: 'Please connect your wallet first.',
        });
        return;
      }

      console.log('Sending SOL:', { amount, to: ownerAddress });
      
      setIsSending(true);
      
      const recipient = new PublicKey(ownerAddress);
      const lamports = amount * 1_000_000_000; // Convert SOL to lamports
      
      // Create transfer instruction
      const transferIx = SystemProgram.transfer({
        fromPubkey: publicKey,
        toPubkey: recipient,
        lamports: lamports
      });
      
      const transaction = new Transaction();
      transaction.add(transferIx);
      transaction.feePayer = publicKey;
      
      const { blockhash } = await connection.getLatestBlockhash('confirmed');
      transaction.recentBlockhash = blockhash;
      
      // Sign and send transaction
      const signature = await sendTransaction(transaction, connection);
      
      console.log('TX sent:', signature);
      
      toast({
        title: 'SOL Sent Successfully! ✅',
        description: `${amount} SOL sent to ${sendModal?.domain}.carv`,
      });
      
      setSendModal(null);
      setSendAmount('');
      
    } catch (error: any) {
      console.error('Failed to send SOL:', error);
      
      let errorMsg = error.message;
      if (errorMsg.includes('User rejected')) {
        errorMsg = 'Transaction cancelled';
      } else if (errorMsg.includes('insufficient')) {
        errorMsg = 'Insufficient balance';
      }
      
      toast({
        variant: 'destructive',
        title: 'Send Failed',
        description: `Failed to send SOL: ${errorMsg}`,
      });
    } finally {
      setIsSending(false);
    }
  };

  // Send NFT functionality (from working HTML)
  const handleSendNFT = async () => {
    try {
      const mintAddress = nftMintAddress.trim();
      if (!mintAddress) {
        toast({
          variant: 'destructive',
          title: 'NFT Mint Address Missing',
          description: 'Please enter the NFT mint address.',
        });
        return;
      }
      
      const recipientAddress = sendModal?.owner;
      if (!recipientAddress) {
        toast({
          variant: 'destructive',
          title: 'Recipient Missing',
          description: 'Recipient address not found.',
        });
        return;
      }
      
      if (!publicKey) {
        toast({
          variant: 'destructive',
          title: 'Wallet Not Connected',
          description: 'Please connect your wallet first.',
        });
        return;
      }

      console.log('Sending NFT:', { mint: mintAddress, to: recipientAddress });
      
      setIsSending(true);
      
      // Basic NFT transfer logic (simplified for now)
      toast({
        title: 'NFT Transfer Feature',
        description: 'NFT transfer functionality is being implemented.',
      });
      
      setSendModal(null);
      setNftMintAddress('');
      
    } catch (error: any) {
      console.error('Failed to send NFT:', error);
      
      toast({
        variant: 'destructive',
        title: 'Send Failed',
        description: `Failed to send NFT: ${error.message}`,
      });
    } finally {
      setIsSending(false);
    }
  };

  const showSendModal = (domain: string, owner: string, type: 'SOL' | 'NFT') => {
    setSendModal({ isOpen: true, domain, owner, type });
    setSendAmount('');
    setNftMintAddress('');
  };

  const closeSendModal = () => {
    setSendModal(null);
    setSendAmount('');
    setNftMintAddress('');
  };

  // Process successful transaction
  const processSuccessfulTransaction = async (signature: string, domainName: string) => {
    console.log('✅ Processing successful transaction...');
    
    // Wait for confirmation (optional)
    try {
      const confirmation = await Promise.race([
        connection.confirmTransaction(signature, 'confirmed'),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 30000))
      ]);
      console.log('✅ Transaction confirmed');
    } catch (confirmationError) {
      console.log('⏰ Transaction confirmation timeout, but sent:', signature);
    }

    toast({
      title: 'Domain Registered Successfully! 🎉',
      description: `Domain "${domainName}" has been registered. Signature: ${signature.substring(0, 8)}...`,
    });

    // Refresh search result
    setSearchResult(prev => prev ? { ...prev, available: false } : null);
  };

  return (
    <section className="w-full py-20 md:py-28 lg:py-32">
      <div className="container px-4 md:px-6">
        <div className="flex flex-col items-center space-y-4 text-center">
          <h1 className="text-4xl font-bold tracking-tighter sm:text-5xl md:text-6xl lg:text-7xl/none font-headline bg-clip-text text-transparent bg-gradient-to-r from-primary to-accent">
            Find Your Perfect CARV Domain
          </h1>
          <p className="mx-auto max-w-[700px] text-gray-500 md:text-xl dark:text-gray-400">
            Search and register your unique .carv domain name. Express your identity on the CARV network.
          </p>
        </div>

        <form onSubmit={handleSearch} className="mx-auto mt-8 max-w-md space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            <Input
              type="text"
              placeholder="Enter domain name (without .carv)"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button type="submit" className="w-full" disabled={isSearching}>
            {isSearching ? (
              <>
                <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                Searching...
              </>
            ) : (
              'Search Domain'
            )}
          </Button>
        </form>

        {searchResult && (
          <Card className="mx-auto mt-8 max-w-2xl">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>{searchResult.domain}.carv</span>
                <div className="flex items-center space-x-2">
                  {searchResult.available ? (
                    <Badge variant="default" className="bg-green-500">
                      <CheckCircle className="mr-1 h-3 w-3" />
                      Available
                    </Badge>
                  ) : (
                    <Badge variant="destructive">
                      <XCircle className="mr-1 h-3 w-3" />
                      Taken
                    </Badge>
                  )}
                </div>
              </CardTitle>
              <CardDescription>.carv domain</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!searchResult.available && searchResult.owner && (
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm font-semibold mb-1">Owner Address:</p>
                  <p className="text-xs font-mono break-all text-muted-foreground">
                    {searchResult.owner}
                  </p>
                  {searchResult.metadata && (
                    <div className="mt-2">
                      <p className="text-xs font-semibold mb-1">Metadata:</p>
                      <pre className="text-xs font-mono text-muted-foreground overflow-x-auto whitespace-pre-wrap">
                        {searchResult.metadata}
                      </pre>
                    </div>
                  )}
                  {publicKey && searchResult.owner !== publicKey.toString() && (
                    <div className="flex gap-2 mt-4">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => showSendModal(searchResult.domain, searchResult.owner!, 'SOL')}
                        className="flex-1"
                      >
                        <Send className="mr-1 h-3 w-3" />
                        Send SOL
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => showSendModal(searchResult.domain, searchResult.owner!, 'NFT')}
                        className="flex-1"
                      >
                        <Image className="mr-1 h-3 w-3" />
                        Send NFT
                      </Button>
                    </div>
                  )}
                </div>
              )}
              
              {searchResult.available && (
                <div className="space-y-2">
                  <Button
                    onClick={() => handleClaim(searchResult.domain)}
                    className="w-full"
                    disabled={isRegistering || !publicKey || !connected}
                  >
                    {isRegistering ? (
                      <>
                        <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                        Registering...
                      </>
                    ) : !publicKey || !connected ? (
                      'Connect Wallet to Register'
                    ) : (
                      `Register ${searchResult.domain}.carv`
                    )}
                  </Button>
                  {(!publicKey || !connected) && (
                    <p className="text-sm text-gray-500">
                      Connect your wallet to register this domain
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Send SOL/NFT Modal */}
      <Dialog open={!!sendModal} onOpenChange={closeSendModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {sendModal?.type === 'SOL' ? '💸 Send SOL' : '🎨 Send NFT'}
            </DialogTitle>
            <DialogDescription>
              {sendModal && `Send ${sendModal.type} to owner of ${sendModal.domain}.carv`}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {sendModal?.owner && (
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-xs text-muted-foreground mb-1">Owner Address:</p>
                <p className="text-sm font-mono break-all">{sendModal.owner}</p>
              </div>
            )}
            
            {sendModal?.type === 'SOL' ? (
              <div className="space-y-2">
                <label className="text-sm font-semibold">Amount in SOL</label>
                <Input
                  type="number"
                  value={sendAmount}
                  onChange={(e) => setSendAmount(e.target.value)}
                  placeholder="0.00"
                  step="0.01"
                  min="0"
                />
              </div>
            ) : (
              <div className="space-y-2">
                <label className="text-sm font-semibold">NFT Mint Address</label>
                <Input
                  type="text"
                  value={nftMintAddress}
                  onChange={(e) => setNftMintAddress(e.target.value)}
                  placeholder="Enter NFT mint address"
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  Enter the mint address of the NFT you want to send
                </p>
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={closeSendModal} disabled={isSending}>
              Cancel
            </Button>
            <Button 
              onClick={sendModal?.type === 'SOL' ? handleSendSOL : handleSendNFT}
              disabled={isSending}
            >
              {isSending ? (
                <>
                  <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                `Send ${sendModal?.type}`
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
