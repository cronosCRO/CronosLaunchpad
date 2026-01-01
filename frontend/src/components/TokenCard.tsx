'use client'

import Link from 'next/link'
import { formatEther } from 'viem'

interface TokenCardProps {
  address: string
  name: string
  symbol: string
  creator: string
  currentPrice: bigint
  progressBps: bigint
  realCroReserve: bigint
}

export function TokenCard({
  address,
  name,
  symbol,
  creator,
  currentPrice,
  progressBps,
  realCroReserve,
}: TokenCardProps) {
  const progress = Number(progressBps) / 100
  const marketCap = Number(formatEther(realCroReserve)).toFixed(2)

  return (
    <Link href={`/token/${address}`}>
      <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4 hover:border-green-500/50 hover:bg-gray-800 transition cursor-pointer group">
        <div className="flex items-start gap-3 mb-3">
          <div className="w-12 h-12 bg-gradient-to-br from-green-400 to-blue-500 rounded-full flex items-center justify-center text-xl font-bold text-black shrink-0">
            {symbol.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-white truncate group-hover:text-green-400 transition">{name}</h3>
            <span className="text-gray-500 text-sm">${symbol}</span>
          </div>
          <div className={`px-2 py-1 rounded text-xs font-medium shrink-0 ${
            progress >= 100
              ? 'bg-green-500/20 text-green-400'
              : 'bg-blue-500/20 text-blue-400'
          }`}>
            {progress >= 100 ? 'Ready' : `${progress.toFixed(1)}%`}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 text-sm mb-3">
          <div>
            <span className="text-gray-500">Market Cap</span>
            <p className="text-white font-medium">{marketCap} CRO</p>
          </div>
          <div>
            <span className="text-gray-500">Creator</span>
            <p className="text-white font-medium">{creator.slice(0, 6)}...{creator.slice(-4)}</p>
          </div>
        </div>

        <div className="bg-gray-700/50 rounded-full h-2 overflow-hidden">
          <div
            className="bg-gradient-to-r from-green-500 to-blue-500 h-full transition-all"
            style={{ width: `${Math.min(progress, 100)}%` }}
          />
        </div>
      </div>
    </Link>
  )
}
