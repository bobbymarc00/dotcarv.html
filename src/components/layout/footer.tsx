import Link from 'next/link';

export function Footer() {
  return (
    <footer className="w-full shrink-0 border-t border-border/40">
        <div className="container mx-auto flex flex-col gap-2 sm:flex-row py-6 items-center px-4 md:px-6">
            <p className="text-xs text-muted-foreground">&copy; 2024 dotCARV. All rights reserved.</p>
            <nav className="sm:ml-auto flex gap-4 sm:gap-6">
                <Link className="text-xs hover:underline underline-offset-4 text-muted-foreground" href="#" prefetch={false}>
                Terms of Service
                </Link>
                <Link className="text-xs hover:underline underline-offset-4 text-muted-foreground" href="#" prefetch={false}>
                Privacy
                </Link>
            </nav>
        </div>
    </footer>
  );
}
