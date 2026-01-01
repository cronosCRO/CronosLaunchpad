'use client'

import { useState } from 'react'
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract, useChainId } from 'wagmi'
import { parseEther, formatEther } from 'viem'
import { BondingCurveABI, MemeTokenABI } from '@/abi'
import { CONTRACT_ADDRESSES } from '@/config/wagmi'
import { cronos } from 'wagmi/chains'

interface TradingPanelProps {
  tokenAddress: string
}

export function TradingPanel({ tokenAddress }: TradingPanelProps) {
  const { address, isConnected } = useAccount()
  const chainId = useChainId()
  const [mode, setMode] = useState<'buy' | 'sell'>('buy')
  const [amount, setAmount] = useState('')
  const [slippage, setSlippage] = useState(5) // 5% default slippage

  const addresses = CONTRACT_ADDRESSES[chainId as keyof typeof CONTRACT_ADDRESSES] || CONTRACT_ADDRESSES[cronos.id]

  // Read token balance
  const { data: tokenBalance } = useReadContract({
    address: tokenAddress as `0x${string}`,
    abi: MemeTokenABI,
    functionName: 'balanceOf',
    args: [address!],
    query: { enabled: !!address },
  })

  // Read allowance
  const { data: allowance } = useReadContract({
    address: tokenAddress as `0x${string}`,
    abi: MemeTokenABI,
    functionName: 'allowance',
    args: [address!, addresses.bondingCurve as `0x${string}`],
    query: { enabled: !!address },
  })

  // Get tokens for CRO (buy preview)
  const { data: tokensForCro } = useReadContract({
    address: addresses.bondingCurve as `0x${string}`,
    abi: BondingCurveABI,
    functionName: 'getTokensForCro',
    args: [tokenAddress as `0x${string}`, amount ? parseEther(amount) : 0n],
    query: { enabled: mode === 'buy' && !!amount },
  })

  // Get CRO for tokens (sell preview)
  const { data: croForTokens } = useReadContract({
    address: addresses.bondingCurve as `0x${string}`,
    abi: BondingCurveABI,
    functionName: 'getCroForTokens',
    args: [tokenAddress as `0x${string}`, amount ? parseEther(amount) : 0n],
    query: { enabled: mode === 'sell' && !!amount },
  })

  // Write contracts
  const { writeContract: buy, data: buyHash, isPending: isBuying } = useWriteContract()
  const { writeContract: sell, data: sellHash, isPending: isSelling } = useWriteContract()
  const { writeContract: approve, data: approveHash, isPending: isApproving } = useWriteContract()

  const { isLoading: isBuyConfirming } = useWaitForTransactionReceipt({ hash: buyHash })
  const { isLoading: isSellConfirming } = useWaitForTransactionReceipt({ hash: sellHash })
  const { isLoading: isApproveConfirming } = useWaitForTransactionReceipt({ hash: approveHash })

  const handleBuy = () => {
    if (!amount) return
    const croAmount = parseEther(amount)
    const minTokensOut = tokensForCro ? (tokensForCro * BigInt(100 - slippage)) / 100n : 0n

    buy({
      address: addresses.bondingCurve as `0x${string}`,
      abi: BondingCurveABI,
      functionName: 'buy',
      args: [tokenAddress as `0x${string}`, minTokensOut],
      value: croAmount,
    })
  }

  const handleSell = () => {
    if (!amount) return
    const tokenAmount = parseEther(amount)
    const minCroOut = croForTokens ? (croForTokens * BigInt(100 - slippage)) / 100n : 0n

    sell({
      address: addresses.bondingCurve as `0x${string}`,
      abi: BondingCurveABI,
      functionName: 'sell',
      args: [tokenAddress as `0x${string}`, tokenAmount, minCroOut],
    })
  }

  const handleApprove = () => {
    approve({
      address: tokenAddress as `0x${string}`,
      abi: MemeTokenABI,
      functionName: 'approve',
      args: [addresses.bondingCurve as `0x${string}`, parseEther('1000000000')], // Max approval
    })
  }

  const needsApproval = mode === 'sell' && amount && allowance !== undefined && parseEther(amount) > allowance

  if (!isConnected) {
    return (
      <div className="bg-gray-800 rounded-xl p-6 text-center">
        <p className="text-gray-400">Connect your wallet to trade</p>
      </div>
    )
  }

  const isLoading = isBuying || isSelling || isApproving || isBuyConfirming || isSellConfirming || isApproveConfirming

  return (
    <div className="bg-gray-800 rounded-xl p-6">
      {/* Mode Toggle */}
      <div className="flex rounded-lg bg-gray-700 p-1 mb-6">
        <button
          onClick={() => setMode('buy')}
          className={`flex-1 py-2 rounded-md font-medium transition ${
            mode === 'buy' ? 'bg-green-600 text-white' : 'text-gray-400 hover:text-white'
          }`}
        >
          Buy
        </button>
        <button
          onClick={() => setMode('sell')}
          className={`flex-1 py-2 rounded-md font-medium transition ${
            mode === 'sell' ? 'bg-red-600 text-white' : 'text-gray-400 hover:text-white'
          }`}
        >
          Sell
        </button>
      </div>

      {/* Amount Input */}
      <div className="mb-4">
        <label className="block text-sm text-gray-400 mb-2">
          {mode === 'buy' ? 'Amount (CRO)' : 'Amount (Tokens)'}
        </label>
        <div className="relative">
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.0"
            className="w-full bg-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {mode === 'sell' && tokenBalance && (
            <button
              onClick={() => setAmount(formatEther(tokenBalance))}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-blue-400 hover:text-blue-300"
            >
              MAX
            </button>
          )}
        </div>
        {mode === 'sell' && tokenBalance && (
          <p className="text-xs text-gray-400 mt-1">
            Balance: {Number(formatEther(tokenBalance)).toLocaleString()} tokens
          </p>
        )}
      </div>

      {/* Preview */}
      {amount && (
        <div className="bg-gray-700/50 rounded-lg p-4 mb-4">
          <p className="text-sm text-gray-400">
            {mode === 'buy' ? 'You will receive:' : 'You will get:'}
          </p>
          <p className="text-lg font-bold">
            {mode === 'buy'
              ? tokensForCro
                ? `~${Number(formatEther(tokensForCro)).toLocaleString()} tokens`
                : 'Calculating...'
              : croForTokens
              ? `~${Number(formatEther(croForTokens)).toFixed(4)} CRO`
              : 'Calculating...'}
          </p>
        </div>
      )}

      {/* Slippage */}
      <div className="mb-6">
        <label className="block text-sm text-gray-400 mb-2">Slippage Tolerance</label>
        <div className="flex gap-2">
          {[1, 3, 5, 10].map((s) => (
            <button
              key={s}
              onClick={() => setSlippage(s)}
              className={`px-3 py-1 rounded ${
                slippage === s ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'
              }`}
            >
              {s}%
            </button>
          ))}
        </div>
      </div>

      {/* Action Button */}
      {needsApproval ? (
        <button
          onClick={handleApprove}
          disabled={isLoading}
          className="w-full bg-yellow-600 hover:bg-yellow-500 py-3 rounded-lg font-bold transition disabled:opacity-50"
        >
          {isApproving || isApproveConfirming ? 'Approving...' : 'Approve Token'}
        </button>
      ) : (
        <button
          onClick={mode === 'buy' ? handleBuy : handleSell}
          disabled={isLoading || !amount}
          className={`w-full py-3 rounded-lg font-bold transition disabled:opacity-50 ${
            mode === 'buy'
              ? 'bg-green-600 hover:bg-green-500'
              : 'bg-red-600 hover:bg-red-500'
          }`}
        >
          {isLoading
            ? 'Processing...'
            : mode === 'buy'
            ? `Buy Tokens`
            : `Sell Tokens`}
        </button>
      )}
    </div>
  )
}
