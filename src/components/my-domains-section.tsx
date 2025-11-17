'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { EditBioModal } from '@/components/edit-bio-modal';
import { TransferDomainModal } from '@/components/transfer-domain-modal';
import { TransferSolNftModal } from '@/components/transfer-sol-nft-modal';
import { RenewDomainModal } from '@/components/renew-domain-modal';
import { Edit, Repeat, ArrowRightLeft, Send, LoaderCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { DomainService } from '@/lib/domain-service';
import { useWallet } from '@solana/wallet-adapter-react';

type OnChainDomain = {
  address: string;
  owner: any;
  name: string;
  registered: number;
  expires: number;
  active: boolean;
  data: string;
};

export function MyDomainsSection() {
  const [myDomains, setMyDomains] = useState<OnChainDomain[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedDomain, setSelectedDomain] = useState<OnChainDomain | null>(null);
  const [isEditBioOpen, setIsEditBioOpen] = useState(false);
  const [isTransferDomainOpen, setIsTransferDomainOpen] = useState(false);
  const [isSendAssetsOpen, setIsSendAssetsOpen] = useState(false);
  const [isRenewOpen, setIsRenewOpen] = useState(false);

  const { toast } = useToast();
  const { publicKey, connected } = useWallet();

  // Load real domain data from blockchain
  useEffect(() => {
    const loadDomainData = async () => {
      if (!publicKey || !connected) {
        setMyDomains([]);
        return;
      }

      setIsLoading(true);
      try {
        const domainService = new DomainService();
        console.log('🔍 Loading domains for wallet:', publicKey.toString());
        
        const domains = await domainService.getDomainsByOwner(publicKey);
        console.log('✅ Loaded domains:', domains.length);
        
        setMyDomains(domains);
      } catch (error) {
        console.error('❌ Error loading domains:', error);
        toast({
          variant: 'destructive',
          title: 'Error Loading Domains',
          description: 'Failed to load your domains from the blockchain.',
        });
        setMyDomains([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadDomainData();
  }, [publicKey, connected, toast]);

  const handleUpdateBio = (domainName: string, newBio: string) => {
    setMyDomains(prevDomains => 
      prevDomains.map(d => d.name === domainName ? { ...d, data: newBio } : d)
    );
  };
  
  const handleRenewDomain = (domainName: string) => {
    setMyDomains(prevDomains =>
      prevDomains.map(d => {
        if (d.name === domainName) {
          const newExpiryDate = new Date(d.expires * 1000);
          newExpiryDate.setFullYear(newExpiryDate.getFullYear() + 1);
          return { 
            ...d, 
            expires: Math.floor(newExpiryDate.getTime() / 1000)
          };
        }
        return d;
      })
    );
    toast({
      title: 'Domain Renewed!',
      description: `The registration for ${domainName}.carv has been extended by one year.`,
    });
  };

  if (!connected || !publicKey) {
    return (
      <section className="w-full py-20 md:py-28 lg:py-32 bg-primary/5">
        <div className="container px-4 md:px-6">
          <div className="flex flex-col items-center space-y-4 text-center mb-12">
            <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl font-headline">My Domains</h2>
            <p className="mx-auto max-w-[700px] text-muted-foreground md:text-xl">
              Connect your wallet to view and manage your .carv domains.
            </p>
          </div>
          <div className="text-center py-12">
            <p className="text-muted-foreground">Please connect your wallet to see your domains</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="w-full py-20 md:py-28 lg:py-32 bg-primary/5">
      <div className="container px-4 md:px-6">
        <div className="flex flex-col items-center space-y-4 text-center mb-12">
          <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl font-headline">My Domains</h2>
          <p className="mx-auto max-w-[700px] text-muted-foreground md:text-xl">
            Manage your digital identities. Renew, update, and transfer your .carv domains.
          </p>
        </div>

        {isLoading ? (
          <div className="text-center py-12">
            <LoaderCircle className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
            <p className="text-muted-foreground">Loading your domains...</p>
          </div>
        ) : myDomains.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground mb-4">No domains found</p>
            <p className="text-sm text-muted-foreground">You don't have any registered domains yet.</p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {myDomains.map((domain) => (
              <Card key={domain.address} className="flex flex-col">
                <CardHeader>
                  <CardTitle className="font-headline">{domain.name}.carv</CardTitle>
                  <CardDescription>
                    Expires on: {new Date(domain.expires * 1000).toLocaleDateString()}
                    {domain.active ? (
                      <span className="ml-2 text-green-500 text-xs">• Active</span>
                    ) : (
                      <span className="ml-2 text-red-500 text-xs">• Inactive</span>
                    )}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex-grow">
                  {domain.data ? (
                    <p className="text-sm text-muted-foreground line-clamp-3">{domain.data}</p>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">No bio set</p>
                  )}
                  <div className="mt-2 text-xs text-muted-foreground">
                    <p>Registered: {new Date(domain.registered * 1000).toLocaleDateString()}</p>
                  </div>
                </CardContent>
                <CardFooter className="grid grid-cols-2 gap-2">
                  <Button variant="outline" onClick={() => { setSelectedDomain(domain); setIsRenewOpen(true); }}>
                    <Repeat className="mr-1 h-3 w-3" />Renew
                  </Button>
                  <Button variant="outline" onClick={() => { setSelectedDomain(domain); setIsEditBioOpen(true); }}>
                    <Edit className="mr-1 h-3 w-3" />Edit Bio
                  </Button>
                  <Button variant="outline" onClick={() => { setSelectedDomain(domain); setIsTransferDomainOpen(true); }}>
                    <ArrowRightLeft className="mr-1 h-3 w-3" />Transfer
                  </Button>
                  <Button onClick={() => { setSelectedDomain(domain); setIsSendAssetsOpen(true); }}>
                    <Send className="mr-1 h-3 w-3" />Send Assets
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </div>
      
      {selectedDomain && (
        <>
          <EditBioModal
            isOpen={isEditBioOpen}
            onClose={() => setIsEditBioOpen(false)}
            domain={{ name: selectedDomain.name, bio: selectedDomain.data }}
            onUpdateBio={handleUpdateBio}
          />
          <TransferDomainModal
            isOpen={isTransferDomainOpen}
            onClose={() => setIsTransferDomainOpen(false)}
            domainName={selectedDomain.name}
          />
          <TransferSolNftModal
            isOpen={isSendAssetsOpen}
            onClose={() => setIsSendAssetsOpen(false)}
            domainName={selectedDomain.name}
          />
          <RenewDomainModal
            isOpen={isRenewOpen}
            onClose={() => setIsRenewOpen(false)}
            domainName={selectedDomain.name}
            onRenew={handleRenewDomain}
          />
        </>
      )}
    </section>
  );
}
