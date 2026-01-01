'use client'

import Link from 'next/link'
import { ConnectButton } from './ConnectButton'

export function Header() {
  return (
    <header className="border-b border-gray-800 bg-black/50 backdrop-blur-xl sticky top-0 z-50">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-green-400 to-blue-500 rounded-lg flex items-center justify-center font-bold text-black">
            C
          </div>
          <span className="text-xl font-bold">CronosMeme</span>
        </Link>

        <nav className="hidden md:flex items-center gap-8">
          <Link href="/" className="text-gray-400 hover:text-white transition font-medium">
            Explore
          </Link>
          <Link href="/create" className="text-gray-400 hover:text-white transition font-medium">
            Create
          </Link>
          <Link href="/profile" className="text-gray-400 hover:text-white transition font-medium">
            Portfolio
          </Link>
        </nav>

        <ConnectButton />
      </div>
    </header>
  )
}
