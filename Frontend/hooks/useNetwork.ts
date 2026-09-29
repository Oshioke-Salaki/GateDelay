import { useEffect, useMemo, useState } from 'react'
import { useAccount, useSwitchChain } from 'wagmi'
import type { Chain } from 'viem'

type Token = {
  name: string
  symbol: string
  address: string
  decimals: number
}

type ContractsMap = Record<string, string>

type NetworkConfig = {
  id: number
  name: string
  rpc?: string
  nativeCurrency?: { name: string; symbol: string; decimals: number }
  contracts: ContractsMap
  tokens: Token[]
  features: string[]
}

const DEFAULT_NETWORKS: NetworkConfig[] = [
  {
    id: 1,
    name: 'Ethereum Mainnet',
    contracts: {
      MarketMinter: '0x0000000000000000000000000000000000000001'
    },
    tokens: [
      { name: 'Ether', symbol: 'ETH', address: '0x0000000000000000000000000000000000000000', decimals: 18 }
    ],
    features: ['minting', 'burnable']
  },
  {
    id: 137,
    name: 'Polygon',
    contracts: {
      MarketMinter: '0x00000000000000000000000000000000000000a1'
    },
    tokens: [
      { name: 'Matic', symbol: 'MATIC', address: '0x0000000000000000000000000000000000000000', decimals: 18 }
    ],
    features: ['minting']
  },
  {
    id: 42161,
    name: 'Arbitrum',
    contracts: {
      MarketMinter: '0x00000000000000000000000000000000000000b2'
    },
    tokens: [
      { name: 'Ether', symbol: 'ETH', address: '0x0000000000000000000000000000000000000000', decimals: 18 }
    ],
    features: ['minting', 'fast-withdraw']
  }
]

export function useNetwork(customNetworks?: NetworkConfig[]) {
  const networks = useMemo(() => customNetworks ?? DEFAULT_NETWORKS, [customNetworks])

  const { chain } = useAccount()
  const { switchChain, chains: wagmiChains } = useSwitchChain()

  const [activeNetwork, setActiveNetwork] = useState<NetworkConfig | undefined>(() => {
    const id = chain?.id
    return networks.find((n) => n.id === id) ?? networks[0]
  })

  useEffect(() => {
    if (!chain) return
    const match = networks.find((n) => n.id === chain.id)
    setActiveNetwork(match ?? networks[0])
  }, [chain, networks])

  const availableNetworks = useMemo(() => networks.map((n) => ({ id: n.id, name: n.name })), [networks])

  async function handleSwitchNetwork(networkId: number) {
    if (switchChain) {
      switchChain({ chainId: networkId })
      return
    }
    const target = wagmiChains.find((c: Chain) => c.id === networkId)
    if (target && (window as any).ethereum && (window as any).ethereum.request) {
      try {
        await (window as any).ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: `0x${networkId.toString(16)}` }]
        })
      } catch (err) {
        console.error('wallet_switchEthereumChain failed', err)
      }
    }
  }

  function getContracts() {
    return activeNetwork?.contracts ?? {}
  }

  function getTokens() {
    return activeNetwork?.tokens ?? []
  }

  function getFeatures() {
    return activeNetwork?.features ?? []
  }

  return {
    availableNetworks,
    activeNetwork,
    switchNetwork: handleSwitchNetwork,
    contracts: getContracts(),
    tokens: getTokens(),
    features: getFeatures(),
    isSupported: Boolean(activeNetwork)
  }
}

export type { NetworkConfig, Token }
