'use client';

import { useState } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { Button } from '@/components/ui/button';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';
import { ChevronDown, Wallet, Copy, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { PhantomWalletAdapter } from '@solana/wallet-adapter-phantom';
import { BackpackWalletAdapter } from '@solana/wallet-adapter-backpack';
import { WalletReadyState } from '@solana/wallet-adapter-base';

export function CustomWalletButton() {
  const { publicKey, connected, disconnect, connect, wallets } = useWallet();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const formatAddress = (address: string) => {
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  const handleCopyAddress = async () => {
    if (publicKey) {
      try {
        await navigator.clipboard.writeText(publicKey.toString());
        setCopied(true);
        toast({
          title: 'Address Copied',
          description: 'Wallet address copied to clipboard.',
        });
        setTimeout(() => setCopied(false), 2000);
      } catch (error) {
        toast({
          variant: 'destructive',
          title: 'Copy Failed',
          description: 'Failed to copy address to clipboard.',
        });
      }
    }
  };

  const handleDisconnect = () => {
    disconnect();
    toast({
      title: 'Wallet Disconnected',
      description: 'Your wallet has been disconnected.',
    });
  };

  // Filter wallets to only show Solana wallets and exclude MetaMask
  const solanaWallets = wallets.filter(wallet => {
    const name = wallet.adapter.name.toLowerCase();
    // Only show Phantom and Backpack, exclude MetaMask and other Ethereum wallets
    return (
      name.includes('phantom') || 
      name.includes('backpack') ||
      (wallet.adapter instanceof PhantomWalletAdapter) ||
      (wallet.adapter instanceof BackpackWalletAdapter)
    );
  });

  const availableWallets = solanaWallets.filter(
    wallet => wallet.readyState === WalletReadyState.Installed
  );

  const handleConnect = async (wallet: any) => {
    try {
      await connect(wallet.adapter.name);
      toast({
        title: 'Wallet Connected',
        description: `Connected to ${wallet.adapter.name}`,
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Connection Failed',
        description: `Failed to connect to ${wallet.adapter.name}`,
      });
    }
  };

  if (!connected || !publicKey) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="flex items-center gap-2">
            <Wallet className="h-4 w-4" />
            Connect Wallet
            <ChevronDown className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          {availableWallets.length === 0 ? (
            <DropdownMenuItem disabled>
              No Solana wallets found
            </DropdownMenuItem>
          ) : (
            availableWallets.map((wallet) => (
              <DropdownMenuItem
                key={wallet.adapter.name}
                onClick={() => handleConnect(wallet)}
                className="cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <img
                    src={wallet.adapter.icon}
                    alt={wallet.adapter.name}
                    className="w-5 h-5"
                  />
                  Connect {wallet.adapter.name}
                </div>
              </DropdownMenuItem>
            ))
          )}
          {availableWallets.length === 0 && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={() => window.open('https://phantom.app/download', '_blank')}
                className="cursor-pointer"
              >
                Download Phantom
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => window.open('https://backpack.app/download', '_blank')}
                className="cursor-pointer"
              >
                Download Backpack
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="flex items-center gap-2 min-w-[120px]">
          <Wallet className="h-4 w-4" />
          {formatAddress(publicKey.toString())}
          <ChevronDown className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem onClick={handleCopyAddress} className="cursor-pointer">
          {copied ? (
            <>
              <CheckCircle className="h-4 w-4 mr-2" />
              Copied!
            </>
          ) : (
            <>
              <Copy className="h-4 w-4 mr-2" />
              Copy Address
            </>
          )}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleDisconnect} className="cursor-pointer text-red-600">
          Disconnect
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}