"use client"

import React, { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useWalletClient } from 'wagmi'
import { BrowserProvider, JsonRpcSigner } from 'ethers'

type Props = {
  poolInfo: {
    totalPoolEth: number
    totalLPTokens: number
    tokenSymbol: string
  }
  onProvide?: (amount: number) => Promise<void>
}

export default function ProvisionForm({ poolInfo, onProvide }: Props) {
  const { register, handleSubmit, formState } = useForm<{ amount: string }>()
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

  const expectedLP = useMemo(() => (amountStr: string) => {
    const amount = Number(amountStr || 0)
    if (!amount || poolInfo.totalPoolEth === 0) return 0
    return (amount / poolInfo.totalPoolEth) * poolInfo.totalLPTokens
  }, [poolInfo])

  async function submit(values: { amount: string }) {
    const amount = Number(values.amount)
    if (!amount || amount <= 0) return
    setStatus('submitting')
    try {
      if (onProvide) await onProvide(amount)
      else {
        if (!walletClient) throw new Error('No signer')
        const provider = new BrowserProvider(walletClient as any)
        const signer = await provider.getSigner()
        const tx = await signer.sendTransaction({ to: await signer.getAddress(), value: 0 })
        if (!signer) throw new Error('No signer')
      
        await tx.wait()
      }
      setStatus('success')
    } catch (e) {
      setStatus('failed')
    }
    setTimeout(() => setStatus(null), 1500)
  }

  return (
    <form onSubmit={handleSubmit(submit)} style={{ border: '1px solid #eee', padding: 12, borderRadius: 8 }}>
      <h4 style={{ marginTop: 0 }}>Provide Liquidity</h4>
      <div style={{ marginBottom: 8 }}>
        <div><strong>Pool</strong>: {poolInfo.tokenSymbol}</div>
        <div><strong>Total Pool (ETH)</strong>: {poolInfo.totalPoolEth}</div>
        <div><strong>LP Supply</strong>: {poolInfo.totalLPTokens}</div>
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
        <input {...register('amount', { required: true })} placeholder="Amount (ETH)" style={{ flex: 1 }} />
        <button type="submit" disabled={formState.isSubmitting} style={{ padding: '6px 10px' }}>Provide</button>
      </div>

      <div style={{ marginBottom: 8 }}>
        <em>Expected LP tokens (preview):</em>
        <div>{expectedLP((formState as any).values?.amount || '')?.toFixed(6) || '0'}</div>
      </div>

      {status && (
        <div>
          <strong>Status:</strong> {status}
        </div>
      )}
    </form>
  )
}
