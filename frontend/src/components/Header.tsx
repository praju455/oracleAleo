'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { WalletConnect } from '@/components/wallet/WalletConnect';

interface HeaderProps {
  health?: { status: string } | null;
}

export function Header({ health }: HeaderProps) {
  const pathname = usePathname();

  const navItems = [
    { href: '/', label: 'Dashboard' },
    { href: '/borrow', label: 'Borrow' },
    { href: '/positions', label: 'Positions' },
    { href: '/stake', label: 'Stake', badge: 'APY' },
  ];

  return (
    <header className="glass border-b border-white/5 sticky top-0 z-50">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 via-purple-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-indigo-500/30 group-hover:shadow-indigo-500/50 transition-all group-hover:scale-105 neon-border">
              <span className="text-white font-bold text-lg">AO</span>
            </div>
            <div>
              <h1 className="text-xl font-bold gradient-text">Aleo Oracle</h1>
              <span className="text-[10px] text-gray-500 uppercase tracking-widest">Zero-Knowledge</span>
            </div>
          </Link>
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-4 py-2 rounded-lg text-sm transition-all flex items-center gap-1 ${
                    isActive
                      ? 'bg-white/10 text-white font-medium'
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {item.label}
                  {item.badge && (
                    <span className="px-1.5 py-0.5 text-[10px] bg-gradient-to-r from-emerald-500 to-cyan-500 rounded text-white">
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 text-sm">
            <div className={`w-2 h-2 rounded-full ${health?.status === 'healthy' ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
            <span className="text-gray-400">Testnet</span>
          </div>
          <WalletConnect />
        </div>
      </div>
    </header>
  );
}
