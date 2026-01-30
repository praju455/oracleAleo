import Link from 'next/link';

export function Footer() {
  return (
    <footer className="relative mt-20 overflow-hidden">
      {/* Top gradient border */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-indigo-500/50 to-transparent" />

      {/* Background glow */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-gradient-to-t from-indigo-500/10 via-purple-500/5 to-transparent blur-3xl pointer-events-none" />

      <div className="glass border-t border-white/5">
        <div className="container mx-auto px-4 py-16">
          <div className="grid grid-cols-1 gap-12 md:grid-cols-5">
            {/* Brand */}
            <div className="md:col-span-2 space-y-4">
              <Link href="/" className="flex items-center gap-3 group w-fit">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 via-purple-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-indigo-500/30 group-hover:shadow-indigo-500/50 transition-all group-hover:scale-105">
                  <span className="text-white font-bold text-xl">AO</span>
                </div>
                <div>
                  <h3 className="text-xl font-bold gradient-text">Aleo Oracle</h3>
                  <span className="text-[10px] text-gray-500 uppercase tracking-widest">Zero-Knowledge Protocol</span>
                </div>
              </Link>
              <p className="text-sm text-gray-400 max-w-sm leading-relaxed">
                The privacy-preserving decentralized oracle powering DeFi on Aleo.
                Cryptographically secured, multi-source verified.
              </p>
              <div className="flex items-center gap-4 pt-2">
                <a href="#" className="w-10 h-10 rounded-xl glass-card flex items-center justify-center text-gray-400 hover:text-white hover:border-indigo-500/50 transition-all group">
                  <svg className="w-5 h-5 group-hover:scale-110 transition-transform" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                  </svg>
                </a>
                <a href="#" className="w-10 h-10 rounded-xl glass-card flex items-center justify-center text-gray-400 hover:text-white hover:border-indigo-500/50 transition-all group">
                  <svg className="w-5 h-5 group-hover:scale-110 transition-transform" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M20.317 4.37a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 00-.041-.106 13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
                  </svg>
                </a>
                <a href="#" className="w-10 h-10 rounded-xl glass-card flex items-center justify-center text-gray-400 hover:text-white hover:border-indigo-500/50 transition-all group">
                  <svg className="w-5 h-5 group-hover:scale-110 transition-transform" fill="currentColor" viewBox="0 0 24 24">
                    <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd"/>
                  </svg>
                </a>
                <a href="#" className="w-10 h-10 rounded-xl glass-card flex items-center justify-center text-gray-400 hover:text-white hover:border-indigo-500/50 transition-all group">
                  <svg className="w-5 h-5 group-hover:scale-110 transition-transform" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/>
                  </svg>
                </a>
              </div>
            </div>

            {/* Protocol Links */}
            <div className="space-y-4">
              <h4 className="font-semibold text-white text-sm uppercase tracking-wider">Protocol</h4>
              <ul className="space-y-3 text-sm">
                <li><Link href="/" className="text-gray-400 hover:text-white transition-colors link-hover">Dashboard</Link></li>
                <li><Link href="/borrow" className="text-gray-400 hover:text-white transition-colors link-hover">Borrow</Link></li>
                <li><Link href="/positions" className="text-gray-400 hover:text-white transition-colors link-hover">Positions</Link></li>
                <li><Link href="/stake" className="text-gray-400 hover:text-white transition-colors link-hover">Stake</Link></li>
              </ul>
            </div>

            {/* Resources */}
            <div className="space-y-4">
              <h4 className="font-semibold text-white text-sm uppercase tracking-wider">Resources</h4>
              <ul className="space-y-3 text-sm">
                <li><a href="#" className="text-gray-400 hover:text-white transition-colors link-hover">Documentation</a></li>
                <li><a href="#" className="text-gray-400 hover:text-white transition-colors link-hover">API Reference</a></li>
                <li><a href="#" className="text-gray-400 hover:text-white transition-colors link-hover">Security Audits</a></li>
                <li><a href="#" className="text-gray-400 hover:text-white transition-colors link-hover">Brand Assets</a></li>
              </ul>
            </div>

            {/* Developers */}
            <div className="space-y-4">
              <h4 className="font-semibold text-white text-sm uppercase tracking-wider">Developers</h4>
              <ul className="space-y-3 text-sm">
                <li><a href="#" className="text-gray-400 hover:text-white transition-colors link-hover">Integration Guide</a></li>
                <li><a href="#" className="text-gray-400 hover:text-white transition-colors link-hover">Smart Contracts</a></li>
                <li><a href="#" className="text-gray-400 hover:text-white transition-colors link-hover">Run a Node</a></li>
                <li><a href="#" className="text-gray-400 hover:text-white transition-colors link-hover">Bug Bounty</a></li>
              </ul>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="mt-12 pt-8 border-t border-white/5">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <span className="px-3 py-1.5 rounded-full glass-card text-xs text-gray-400">
                  <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 mr-2 animate-pulse" />
                  Testnet Live
                </span>
                <span className="px-3 py-1.5 rounded-full glass-card text-xs gradient-text font-medium">
                  v2.0.0
                </span>
              </div>
              <p className="text-xs text-gray-500 text-center">
                &copy; {new Date().getFullYear()} Aleo Oracle Protocol. Built with Zero-Knowledge Cryptography.
              </p>
              <div className="flex items-center gap-4 text-xs text-gray-500">
                <a href="#" className="hover:text-white transition-colors">Privacy</a>
                <span className="text-gray-700">|</span>
                <a href="#" className="hover:text-white transition-colors">Terms</a>
                <span className="text-gray-700">|</span>
                <a href="#" className="hover:text-white transition-colors">Status</a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
