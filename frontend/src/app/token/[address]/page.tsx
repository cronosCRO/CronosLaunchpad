'use client'

import { useParams } from 'next/navigation'
import { useReadContract, useChainId } from 'wagmi'
import { formatEther } from 'viem'
import { TokenFactoryABI, BondingCurveABI, MemeTokenABI } from '@/abi'
import { CONTRACT_ADDRESSES, GRADUATION_THRESHOLD } from '@/config/wagmi'
import { TradingPanel } from '@/components/TradingPanel'
import { cronos, cronosTestnet } from 'wagmi/chains'
import Link from 'next/link'

export default function TokenPage() {
  const params = useParams()
  const tokenAddress = params.address as string
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

  const { data: totalSupply } = useReadContract({
    address: tokenAddress as `0x${string}`,
    abi: MemeTokenABI,
    functionName: 'totalSupply',
  })

  if (!tokenInfo || !curveState) {
    return (
      <div className="animate-pulse">
        <div className="h-10 bg-gray-800 rounded w-1/3 mb-4"></div>
        <div className="h-6 bg-gray-800 rounded w-1/4 mb-8"></div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 h-96 bg-gray-800 rounded-xl"></div>
          <div className="h-96 bg-gray-800 rounded-xl"></div>
        </div>
      </div>
    )
  }

  const [creator, name, symbol, metadataURI, createdAt, graduated] = tokenInfo
  const [virtualCroReserve, virtualTokenReserve, realCroReserve, tokensSold, currentPrice, progressBps, canGraduate] = curveState

  const progress = Number(progressBps) / 100
  const croToGraduation = (GRADUATION_THRESHOLD - realCroReserve) / 10n ** 18n

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-2">
          <h1 className="text-4xl font-bold">{name}</h1>
          <span className="text-xl text-gray-400">${symbol}</span>
          {graduated && (
            <span className="bg-green-600 text-white px-3 py-1 rounded-full text-sm">
              Graduated
            </span>
          )}
        </div>
        <div className="flex items-center gap-4 text-sm text-gray-400">
          <span>
            Created by{' '}
            <Link href={`/profile/${creator}`} className="text-blue-400 hover:underline">
              {creator.slice(0, 6)}...{creator.slice(-4)}
            </Link>
          </span>
          <span>•</span>
          <a
            href={`https://${chainId === cronosTestnet.id ? 'testnet.' : ''}cronoscan.com/token/${tokenAddress}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 hover:underline"
          >
            View on CronosScan
          </a>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column - Token Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Progress */}
          <div className="bg-gray-800 rounded-xl p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold">Bonding Curve Progress</h3>
              <span className="text-blue-400">{progress.toFixed(2)}%</span>
            </div>
            <div className="bg-gray-700 rounded-full h-4 overflow-hidden mb-2">
              <div
                className="bg-gradient-to-r from-blue-500 to-purple-500 h-full transition-all"
                style={{ width: `${Math.min(progress, 100)}%` }}
              />
            </div>
            <div className="flex justify-between text-sm text-gray-400">
              <span>{Number(formatEther(realCroReserve)).toFixed(2)} CRO raised</span>
              <span>{Number(formatEther(GRADUATION_THRESHOLD)).toFixed(0)} CRO target</span>
            </div>
            {canGraduate && (
              <div className="mt-4 p-4 bg-green-900/50 border border-green-500 rounded-lg">
                <p className="text-green-400 font-medium">
                  This token is ready to graduate to VVS Finance!
                </p>
              </div>
            )}
            {!graduated && !canGraduate && (
              <p className="mt-4 text-sm text-gray-400">
                {Number(croToGraduation)} more CRO needed to graduate to VVS Finance
              </p>
            )}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gray-800 rounded-xl p-4">
              <p className="text-sm text-gray-400 mb-1">Price</p>
              <p className="font-bold">{Number(formatEther(currentPrice)).toExponential(4)} CRO</p>
            </div>
            <div className="bg-gray-800 rounded-xl p-4">
              <p className="text-sm text-gray-400 mb-1">Market Cap</p>
              <p className="font-bold">{Number(formatEther(realCroReserve)).toFixed(2)} CRO</p>
            </div>
            <div className="bg-gray-800 rounded-xl p-4">
              <p className="text-sm text-gray-400 mb-1">Tokens Sold</p>
              <p className="font-bold">{(Number(formatEther(tokensSold)) / 1e6).toFixed(2)}M</p>
            </div>
            <div className="bg-gray-800 rounded-xl p-4">
              <p className="text-sm text-gray-400 mb-1">Total Supply</p>
              <p className="font-bold">{totalSupply ? (Number(formatEther(totalSupply)) / 1e9).toFixed(0) + 'B' : '-'}</p>
            </div>
          </div>

          {/* Token Details */}
          <div className="bg-gray-800 rounded-xl p-6">
            <h3 className="font-bold mb-4">Token Details</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Contract Address</span>
                <span className="font-mono">{tokenAddress.slice(0, 10)}...{tokenAddress.slice(-8)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Virtual CRO Reserve</span>
                <span>{Number(formatEther(virtualCroReserve)).toFixed(2)} CRO</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Virtual Token Reserve</span>
                <span>{(Number(formatEther(virtualTokenReserve)) / 1e6).toFixed(2)}M</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Trading Fee</span>
                <span>1% (0.5% to creator, 0.5% to platform)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column - Trading Panel */}
        <div>
          {graduated ? (
            <div className="bg-gray-800 rounded-xl p-6 text-center">
              <div className="text-4xl mb-4">🎓</div>
              <h3 className="font-bold text-xl mb-2">Token Graduated!</h3>
              <p className="text-gray-400 mb-4">
                This token has migrated to VVS Finance. Trade it there!
              </p>
              <a
                href={`https://vvs.finance/swap?outputCurrency=${tokenAddress}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-lg font-medium transition"
              >
                Trade on VVS Finance
              </a>
            </div>
          ) : (
            <TradingPanel tokenAddress={tokenAddress} />
          )}
        </div>
      </div>
    </div>
  )
}
