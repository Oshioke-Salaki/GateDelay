"use client"

import React, { useState, useMemo  } from 'react'
import { useWalletClient } from 'wagmi'
import { BrowserProvider , JsonRpcSigner } from 'ethers'

type Market = {
  id: string
  title: string
  status: string
  totalYesStake: number
  totalNoStake: number
}

export default function SettleInterface({ market }: { market: Market }) {
  const { data: walletClient } = useWalletClient()

  const signer = useMemo(() => {
    if (!walletClient) return null
    const { account, chain, transport } = walletClient
    const network = {
      chainId: chain.id,
      name: chain.name,
      ensAddress: chain.contracts?.ensRegistry?.address,
    }
    const provider = new BrowserProvider(transport, network)
    return new JsonRpcSigner(provider, account.address)
  }, [walletClient])

  const [status, setStatus] = useState<string | null>(null)

  const totalPool = market.totalYesStake + market.totalNoStake
  const yesPayoutPerUnit = market.totalYesStake > 0 ? totalPool / market.totalYesStake : 0
  const noPayoutPerUnit = market.totalNoStake > 0 ? totalPool / market.totalNoStake : 0

  async function handleSettle() {
    setStatus('settling')
    try {
      if (!walletClient) throw new Error('No signer')
      const provider = new BrowserProvider(walletClient as any)
      const signer = await provider.getSigner()
      // For safety this is a mock on-chain action; in production call your settlement contract
      const tx = await signer.sendTransaction({ to: await signer.getAddress(), value: 0 })
      await tx.wait()
      setStatus('success')
    } catch (e) {
      setStatus('failed')
    }
    setTimeout(() => setStatus(null), 1500)
  }

  return (
    <div style={{ border: '1px solid #e6e6e6', padding: 12, borderRadius: 8 }}>
      <h4 style={{ marginTop: 0 }}>{market.title} — Settlement</h4>
      <div style={{ marginBottom: 8 }}>
        <strong>Status:</strong> {market.status}
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
        <div>
          <div><strong>Total pool</strong></div>
          <div>{totalPool}</div>
        </div>
        <div>
          <div><strong>YES payout/unit</strong></div>
          <div>{yesPayoutPerUnit.toFixed(6)}</div>
        </div>
        <div>
          <div><strong>NO payout/unit</strong></div>
          <div>{noPayoutPerUnit.toFixed(6)}</div>
        </div>
      </div>

      <div style={{ marginBottom: 12 }}>
        <button onClick={handleSettle} disabled={status === 'settling'} style={{ padding: '8px 12px' }}>
          Settle & Claim Payout
        </button>
      </div>

      {status && (
        <div>
          <strong>Result:</strong> {status}
        </div>
      )}
    </div>
  )
}
