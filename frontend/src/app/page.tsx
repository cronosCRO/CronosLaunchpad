'use client'

import { useState } from 'react'
import { useReadContract, useChainId } from 'wagmi'
import { TokenFactoryABI, BondingCurveABI } from '@/abi'
import { CONTRACT_ADDRESSES } from '@/config/wagmi'
import { TokenCard } from '@/components/TokenCard'
import Link from 'next/link'
import { cronos } from 'wagmi/chains'

type FilterType = 'trending' | 'new' | 'graduating'

export default function Home() {
  const [filter, setFilter] = useState<FilterType>('trending')
  const chainId = useChainId()
  const addresses = CONTRACT_ADDRESSES[chainId as keyof typeof CONTRACT_ADDRESSES] || CONTRACT_ADDRESSES[cronos.id]

  const { data: tokenCount } = useReadContract({
    address: addresses.tokenFactory as `0x${string}`,
    abi: TokenFactoryABI,
    functionName: 'getTokenCount',
  })

  const { data: allTokens } = useReadContract({
    address: addresses.tokenFactory as `0x${string}`,
    abi: TokenFactoryABI,
    functionName: 'getAllTokens',
  })

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="text-center py-20 mb-8">
        <div className="inline-block px-4 py-1 bg-green-500/10 border border-green-500/30 rounded-full text-green-400 text-sm mb-6">
          Powered by Cronos Chain
        </div>
        <h1 className="text-6xl font-bold mb-6">
          <span className="bg-gradient-to-r from-green-400 via-blue-400 to-purple-500 bg-clip-text text-transparent">
            Launch Your Memecoin
          </span>
        </h1>
        <p className="text-xl text-gray-400 mb-10 max-w-2xl mx-auto">
          Create tokens instantly. Trade on bonding curve.
          Graduate to VVS Finance at 500 CRO.
        </p>
        <div className="flex justify-center gap-4">
          <Link
            href="/create"
            className="px-8 py-4 bg-green-500 hover:bg-green-400 text-black rounded-xl font-bold text-lg transition transform hover:scale-105"
          >
            Create Token
          </Link>
          <a
            href="#tokens"
            className="px-8 py-4 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-xl font-bold text-lg transition"
          >
            Explore
          </a>
        </div>
      </section>

      {/* Stats Bar */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12 bg-gray-800/50 rounded-2xl p-6 border border-gray-700">
        <div className="text-center">
          <p className="text-3xl font-bold text-green-400">{tokenCount?.toString() || '0'}</p>
          <p className="text-gray-500 text-sm">Tokens Launched</p>
        </div>
        <div className="text-center">
          <p className="text-3xl font-bold text-blue-400">1 CRO</p>
          <p className="text-gray-500 text-sm">Creation Fee</p>
        </div>
        <div className="text-center">
          <p className="text-3xl font-bold text-purple-400">1%</p>
          <p className="text-gray-500 text-sm">Trading Fee</p>
        </div>
        <div className="text-center">
          <p className="text-3xl font-bold text-yellow-400">500 CRO</p>
          <p className="text-gray-500 text-sm">Graduation</p>
        </div>
      </section>

      {/* Token List */}
      <section id="tokens">
        <div className="flex justify-between items-center mb-6">
          <div className="flex gap-2">
            <button
              onClick={() => setFilter('trending')}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                filter === 'trending'
                  ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
            >
              Trending
            </button>
            <button
              onClick={() => setFilter('new')}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                filter === 'new'
                  ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
            >
              New
            </button>
            <button
              onClick={() => setFilter('graduating')}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                filter === 'graduating'
                  ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
            >
              Graduating
            </button>
          </div>
          <Link
            href="/create"
            className="text-green-400 hover:text-green-300 text-sm font-medium"
          >
            + Create Token
          </Link>
        </div>

        {!allTokens || allTokens.length === 0 ? (
          <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-16 text-center">
            <div className="text-6xl mb-4">🚀</div>
            <h3 className="text-xl font-bold mb-2">No tokens yet</h3>
            <p className="text-gray-400 mb-6">Be the first to launch a memecoin!</p>
            <Link
              href="/create"
              className="inline-block px-6 py-3 bg-green-500 hover:bg-green-400 text-black rounded-xl font-bold transition"
            >
              Create Token
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {allTokens.map((tokenAddress) => (
              <TokenCardWrapper key={tokenAddress} tokenAddress={tokenAddress} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function TokenCardWrapper({ tokenAddress }: { tokenAddress: string }) {
  const chainId = useChainId()
  const addresses = CONTRACT_ADDRESSES[chainId as keyof typeof CONTRACT_ADDRESSES] || CONTRACT_ADDRESSES[cronos.id]

  const { data: tokenInfo } = useReadContract({
    address: addresses.tokenFactory as `0x${string}`,
    abi: TokenFactoryABI,
    functionName: 'tokenInfo',
    args: [tokenAddress as `0x${string}`],
  })

  const { data: curveState } = useReadContract({
    address: addresses.bondingCurve as `0x${string}`,
    abi: BondingCurveABI,
    functionName: 'getCurveState',
    args: [tokenAddress as `0x${string}`],
  })

  if (!tokenInfo || !curveState) {
    return (
      <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4 animate-pulse">
        <div className="h-12 w-12 bg-gray-700 rounded-full mb-3"></div>
        <div className="h-5 bg-gray-700 rounded w-3/4 mb-2"></div>
        <div className="h-4 bg-gray-700 rounded w-1/2"></div>
      </div>
    )
  }

  return (
    <TokenCard
      address={tokenAddress}
      name={tokenInfo[1]}
      symbol={tokenInfo[2]}
      creator={tokenInfo[0]}
      currentPrice={curveState[4]}
      progressBps={curveState[5]}
      realCroReserve={curveState[2]}
    />
  )
}
