'use client';

import { useEffect, useState } from 'react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import Link from 'next/link';
import { LogoIcon } from '@/components/icons/logo';
import { ThemeToggle } from '@/components/theme-toggle';

export function Header() {
  const [mounted, setMounted] = useState(false);

  // Prevent hydration mismatch by only rendering on client
  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <header className="px-4 lg:px-6 h-20 flex items-center sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex items-center">
        <Link href="/" className="flex items-center justify-center gap-2" prefetch={false}>
          <LogoIcon className="h-8 w-8 text-primary" />
          <span className="text-xl font-bold text-foreground font-headline">dotCARV</span>
        </Link>
        <nav className="ml-auto flex items-center gap-4 sm:gap-6">
          <ThemeToggle />
          {mounted && <WalletMultiButton />}
        </nav>
      </div>
    </header>
  );
}
