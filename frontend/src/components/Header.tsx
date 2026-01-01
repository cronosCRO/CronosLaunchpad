'use client'

import Link from 'next/link'
import { ConnectButton } from './ConnectButton'

export function Header() {
  return (
    <header className="border-b border-gray-800 bg-gray-900/50 backdrop-blur-sm sticky top-0 z-50">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
            CronosMeme
          </span>
          <span className="text-xs bg-blue-600 px-2 py-0.5 rounded-full">.fun</span>
        </Link>

        <nav className="hidden md:flex items-center gap-6">
          <Link href="/" className="text-gray-300 hover:text-white transition">
            Home
          </Link>
          <Link href="/create" className="text-gray-300 hover:text-white transition">
            Create Token
          </Link>
          <Link href="/profile" className="text-gray-300 hover:text-white transition">
            Profile
          </Link>
        </nav>

        <ConnectButton />
      </div>
    </header>
  )
}
