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

  return (
    <Link href={`/token/${address}`}>
      <div className="bg-gray-800 rounded-xl p-4 hover:bg-gray-750 transition cursor-pointer border border-gray-700 hover:border-blue-500">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="font-bold text-lg">{name}</h3>
            <span className="text-gray-400 text-sm">${symbol}</span>
          </div>
          <div className="bg-blue-600/20 text-blue-400 px-2 py-1 rounded text-xs">
            {progress.toFixed(1)}%
          </div>
        </div>

        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-400">Price</span>
            <span>{Number(formatEther(currentPrice)).toExponential(4)} CRO</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Market Cap</span>
            <span>{Number(formatEther(realCroReserve)).toFixed(2)} CRO</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Creator</span>
            <span className="text-gray-300">
              {creator.slice(0, 6)}...{creator.slice(-4)}
            </span>
          </div>
        </div>

        <div className="mt-4">
          <div className="bg-gray-700 rounded-full h-2 overflow-hidden">
            <div
              className="bg-gradient-to-r from-blue-500 to-purple-500 h-full transition-all"
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>
          <p className="text-xs text-gray-400 mt-1">
            {progress >= 100 ? 'Ready to graduate!' : `${(100 - progress).toFixed(1)}% to graduation`}
          </p>
        </div>
      </div>
    </Link>
  )
}
