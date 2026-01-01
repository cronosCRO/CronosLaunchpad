import { http, createConfig } from 'wagmi'
import { cronos, cronosTestnet } from 'wagmi/chains'
import { injected, metaMask } from 'wagmi/connectors'

export const config = createConfig({
  chains: [cronos, cronosTestnet],
  connectors: [
    injected(),
    metaMask(),
  ],
  transports: {
    [cronos.id]: http('https://evm.cronos.org'),
    [cronosTestnet.id]: http('https://evm-t3.cronos.org'),
  },
})

// Contract addresses - update after deployment
export const CONTRACT_ADDRESSES = {
  [cronos.id]: {
    tokenFactory: '0x0000000000000000000000000000000000000000',
    bondingCurve: '0x0000000000000000000000000000000000000000',
    liquidityMigrator: '0x0000000000000000000000000000000000000000',
  },
  [cronosTestnet.id]: {
    tokenFactory: '0x0000000000000000000000000000000000000000',
    bondingCurve: '0x0000000000000000000000000000000000000000',
    liquidityMigrator: '0x0000000000000000000000000000000000000000',
  },
} as const

export const GRADUATION_THRESHOLD = 500n * 10n ** 18n // 500 CRO
export const CREATION_FEE = 1n * 10n ** 18n // 1 CRO
export const TOTAL_SUPPLY = 1_000_000_000n * 10n ** 18n // 1 billion tokens
