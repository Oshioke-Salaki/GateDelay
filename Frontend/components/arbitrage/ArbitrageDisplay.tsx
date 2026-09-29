import React, { useEffect, useMemo, useState } from 'react'

type Market = {
  id: string
  name: string
  asset: string
  price: number // price quoted in same unit (e.g., USD per token)
  feePercent?: number // percent fee charged for trade (0-100)
  liquidity?: number // available liquidity in asset units
}

type Opportunity = {
  buy: Market
  sell: Market
  amount: number
  profit: number
  profitPercent: number
  fees: number
  gasCost: number
  slippageRisk: number
}

interface Props {
  markets?: Market[]
  fetchUrl?: string // optional API endpoint returning Market[]
  defaultAmount?: number
  onExecute?: (opp: Opportunity) => Promise<void>
}

function round(n: number, d = 2) {
  return Math.round(n * Math.pow(10, d)) / Math.pow(10, d)
}

// Lightweight opportunitiy scanning algorithm: pairwise compare markets for same asset
function computeOpportunities(
  markets: Market[],
  amount: number,
  gasCost: number,
  feeOverride?: number
): Opportunity[] {
  const ops: Opportunity[] = []
  for (let i = 0; i < markets.length; i++) {
    for (let j = 0; j < markets.length; j++) {
      if (i === j) continue
      const buy = markets[i]
      const sell = markets[j]
      if (buy.asset !== sell.asset) continue

      const buyPrice = buy.price
      const sellPrice = sell.price
      if (sellPrice <= buyPrice) continue

      const buyCost = amount * buyPrice
      const sellRevenue = amount * sellPrice

      const buyFee = (buy.feePercent ?? feeOverride ?? 0) / 100
      const sellFee = (sell.feePercent ?? feeOverride ?? 0) / 100
      const fees = buyCost * buyFee + sellRevenue * sellFee

      const profit = sellRevenue - buyCost - fees - gasCost
      const profitPercent = buyCost > 0 ? (profit / buyCost) * 100 : 0

      const liquidity = Math.max(buy.liquidity ?? 0, sell.liquidity ?? 0)
      const slippageRisk = liquidity > 0 ? amount / liquidity : 1 // 1 = high risk

      ops.push({
        buy,
        sell,
        amount,
        profit,
        profitPercent,
        fees,
        gasCost,
        slippageRisk,
      })
    }
  }

  // keep only profitable ones and sort by profit desc
  return ops.filter((o) => o.profit > 0).sort((a, b) => b.profit - a.profit)
}

export default function ArbitrageDisplay({
  markets: initialMarkets = [],
  fetchUrl,
  defaultAmount = 1,
  onExecute,
}: Props) {
  const [markets, setMarkets] = useState<Market[]>(initialMarkets)
  const [amount, setAmount] = useState<number>(defaultAmount)
  const [gasCost, setGasCost] = useState<number>(0.001) // quoted in same quote-currency
  const [feeOverride, setFeeOverride] = useState<number | undefined>(undefined)
  const [minProfit, setMinProfit] = useState<number>(0)
  const [status, setStatus] = useState<string | null>(null)

  useEffect(() => {
    const url = fetchUrl ?? '/api/markets'
    let mounted = true
    fetch(url)
      .then((r) => r.json())
      .then((payload) => {
        if (!mounted) return
        const data = Array.isArray(payload) ? payload : payload?.data ?? []
        if (Array.isArray(data)) setMarkets(data)
      })
      .catch(() => {
        // ignore fetch errors; keep initial markets
      })
    return () => {
      mounted = false
    }
  }, [fetchUrl])

  const opportunities = useMemo(() => computeOpportunities(markets, amount, gasCost, feeOverride), [
    markets,
    amount,
    gasCost,
    feeOverride,
  ])

  async function handleExecute(opp: Opportunity) {
    setStatus('executing')
    try {
      if (onExecute) {
        await onExecute(opp)
      } else {
        // default mock execution: simulate a short wait and succeed
        await new Promise((res) => setTimeout(res, 800))
      }
      setStatus('success')
      setTimeout(() => setStatus(null), 1500)
    } catch (e) {
      setStatus('failed')
      setTimeout(() => setStatus(null), 2000)
    }
  }

  return (
    <div style={{ border: '1px solid #ddd', padding: 12, borderRadius: 8, maxWidth: 920 }}>
      <h3 style={{ marginTop: 0 }}>Arbitrage Opportunities</h3>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          Amount:
          <input
            type="number"
            value={amount}
            min={0}
            step="any"
            onChange={(e) => setAmount(Number(e.target.value))}
            style={{ width: 120 }}
          />
        </label>

        <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          Gas cost:
          <input
            type="number"
            value={gasCost}
            min={0}
            step="any"
            onChange={(e) => setGasCost(Number(e.target.value))}
            style={{ width: 120 }}
          />
        </label>

        <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          Fee % override:
          <input
            type="number"
            value={feeOverride ?? ''}
            placeholder="auto"
            onChange={(e) => setFeeOverride(e.target.value === '' ? undefined : Number(e.target.value))}
            style={{ width: 100 }}
          />
        </label>

        <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          Min profit:
          <input
            type="number"
            value={minProfit}
            onChange={(e) => setMinProfit(Number(e.target.value))}
            style={{ width: 120 }}
          />
        </label>
      </div>

      <div style={{ marginBottom: 12 }}>
        <strong>Markets scanned:</strong> {markets.length}
      </div>

      <div>
        {opportunities.filter((o) => o.profit >= minProfit).length === 0 ? (
          <div style={{ color: '#666' }}>No profitable opportunities found.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid #eee' }}>
                <th>Pair</th>
                <th>Amount</th>
                <th>Profit</th>
                <th>ROI</th>
                <th>Fees</th>
                <th>Slippage Risk</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {opportunities
                .filter((o) => o.profit >= minProfit)
                .map((o, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid #fafafa' }}>
                    <td>
                      Buy: {o.buy.name} → Sell: {o.sell.name} <br />
                      <small style={{ color: '#666' }}>{o.buy.asset}</small>
                    </td>
                    <td>{o.amount}</td>
                    <td style={{ color: o.profit > 0 ? 'green' : 'inherit' }}>{round(o.profit, 6)}</td>
                    <td>{round(o.profitPercent, 3)}%</td>
                    <td>{round(o.fees, 6)}</td>
                    <td>
                      {o.slippageRisk >= 1
                        ? 'High'
                        : o.slippageRisk >= 0.2
                        ? 'Medium'
                        : 'Low'}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        onClick={() => handleExecute(o)}
                        disabled={status === 'executing'}
                        style={{ padding: '6px 10px' }}>
                        Execute
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        )}
      </div>

      {status && (
        <div style={{ marginTop: 12 }}>
          <strong>Status:</strong> {status}
        </div>
      )}
    </div>
  )
}
