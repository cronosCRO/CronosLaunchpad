'use client'

import { useState } from 'react'
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useChainId } from 'wagmi'
import { parseEther } from 'viem'
import { TokenFactoryABI } from '@/abi'
import { CONTRACT_ADDRESSES, CREATION_FEE } from '@/config/wagmi'
import { cronos, cronosTestnet } from 'wagmi/chains'

export function CreateTokenForm() {
  const { isConnected } = useAccount()
  const chainId = useChainId()
  const [name, setName] = useState('')
  const [symbol, setSymbol] = useState('')
  const [description, setDescription] = useState('')

  const addresses = CONTRACT_ADDRESSES[chainId as keyof typeof CONTRACT_ADDRESSES] || CONTRACT_ADDRESSES[cronos.id]

  const { writeContract, data: hash, isPending, error } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name || !symbol) return

    // For now, use description as metadata URI
    const metadataURI = description || `ipfs://placeholder/${symbol}`

    writeContract({
      address: addresses.tokenFactory as `0x${string}`,
      abi: TokenFactoryABI,
      functionName: 'createToken',
      args: [name, symbol.toUpperCase(), metadataURI],
      value: CREATION_FEE,
    })
  }

  if (!isConnected) {
    return (
      <div className="bg-gray-800 rounded-xl p-8 text-center">
        <p className="text-gray-400">Connect your wallet to create a token</p>
      </div>
    )
  }

  if (isSuccess) {
    return (
      <div className="bg-gray-800 rounded-xl p-8 text-center">
        <div className="text-green-400 text-6xl mb-4">✓</div>
        <h3 className="text-xl font-bold mb-2">Token Created!</h3>
        <p className="text-gray-400 mb-4">Your memecoin is now live on the bonding curve.</p>
        <a
          href={`https://${chainId === cronosTestnet.id ? 'testnet.' : ''}cronoscan.com/tx/${hash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-400 hover:underline"
        >
          View on CronosScan
        </a>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="bg-gray-800 rounded-xl p-6 space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">Token Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Doge Cronos"
          maxLength={32}
          className="w-full bg-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">Token Symbol</label>
        <input
          type="text"
          value={symbol}
          onChange={(e) => setSymbol(e.target.value.toUpperCase())}
          placeholder="e.g., DCRO"
          maxLength={10}
          className="w-full bg-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">Description (Optional)</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Tell us about your memecoin..."
          rows={3}
          className="w-full bg-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        />
      </div>

      <div className="bg-gray-700/50 rounded-lg p-4">
        <h4 className="font-medium mb-2">Token Details</h4>
        <ul className="text-sm text-gray-400 space-y-1">
          <li>• Total Supply: 1,000,000,000 tokens</li>
          <li>• Creation Fee: 1 CRO</li>
          <li>• Trading Fee: 1% (split between you and platform)</li>
          <li>• Graduation: At 500 CRO market cap</li>
        </ul>
      </div>

      {error && (
        <div className="bg-red-900/50 border border-red-500 rounded-lg p-4 text-red-400 text-sm">
          {error.message}
        </div>
      )}

      <button
        type="submit"
        disabled={isPending || isConfirming || !name || !symbol}
        className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 py-3 rounded-lg font-bold transition disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isPending ? 'Confirm in Wallet...' : isConfirming ? 'Creating...' : 'Create Token (1 CRO)'}
      </button>
    </form>
  )
}
