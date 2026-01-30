import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { WalletWrapper } from '@/components/wallet/WalletWrapper';
import { Footer } from '@/components/Footer';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Aleo Oracle - Privacy-Preserving Price Oracle',
  description: 'Decentralized price oracle for Aleo DeFi applications',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <WalletWrapper>
          <div className="flex flex-col min-h-screen">
            <main className="flex-grow">
              {children}
            </main>
            <Footer />
          </div>
        </WalletWrapper>
      </body>
    </html>
  );
}
