'use client'

import { useAccount, useReadContract, useChainId } from 'wagmi'
import { TokenFactoryABI, BondingCurveABI } from '@/abi'
import { CONTRACT_ADDRESSES } from '@/config/wagmi'
import { TokenCard } from '@/components/TokenCard'
import { cronos } from 'wagmi/chains'

export default function ProfilePage() {
  const { address, isConnected } = useAccount()
  const chainId = useChainId()
  const addresses = CONTRACT_ADDRESSES[chainId as keyof typeof CONTRACT_ADDRESSES] || CONTRACT_ADDRESSES[cronos.id]

  const { data: creatorTokens } = useReadContract({
    address: addresses.tokenFactory as `0x${string}`,
    abi: TokenFactoryABI,
    functionName: 'getCreatorTokens',
    args: [address!],
    query: { enabled: !!address },
  })

  if (!isConnected) {
    return (
      <div className="text-center py-16">
        <h1 className="text-3xl font-bold mb-4">Your Profile</h1>
        <p className="text-gray-400">Connect your wallet to view your created tokens.</p>
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-2">Your Profile</h1>
      <p className="text-gray-400 mb-8">
        {address?.slice(0, 6)}...{address?.slice(-4)}
      </p>

      <section>
        <h2 className="text-2xl font-bold mb-6">Your Tokens</h2>
        {!creatorTokens || creatorTokens.length === 0 ? (
          <div className="bg-gray-800 rounded-xl p-12 text-center">
            <p className="text-gray-400">You haven&apos;t created any tokens yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {creatorTokens.map((tokenAddress) => (
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
      <div className="bg-gray-800 rounded-xl p-4 animate-pulse">
        <div className="h-6 bg-gray-700 rounded w-3/4 mb-2"></div>
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
