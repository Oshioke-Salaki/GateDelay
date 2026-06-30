"use client"

import React, { useMemo } from 'react'

type Props = {
  currentShares: number
  totalPool: number
  feePercent?: number
}

export default function ShareCalculator({ currentShares, totalPool, feePercent = 0.01 }: Props) {
  const scenarios = useMemo(() => {
    const shares = [currentShares * 0.5, currentShares, currentShares * 2]
    return shares.map((s) => {
      const sharePct = totalPool > 0 ? (s / totalPool) * 100 : 0
      const grossValue = (s / (totalPool || 1)) * totalPool
      const fees = grossValue * feePercent
      const net = grossValue - fees
      return { shares: s, sharePct, grossValue, fees, net }
    })
  }, [currentShares, totalPool, feePercent])

  return (
    <div style={{ border: '1px solid #eee', padding: 12, borderRadius: 8 }}>
      <h4 style={{ marginTop: 0 }}>Market Share Calculator</h4>
      <div style={{ marginBottom: 8 }}>Current shares: {currentShares}</div>

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th>Shares</th>
            <th>% of pool</th>
            <th>Gross value</th>
            <th>Fees</th>
            <th>Net</th>
          </tr>
        </thead>
        <tbody>
          {scenarios.map((s, i) => (
            <tr key={i} style={{ borderTop: '1px solid #fafafa' }}>
              <td>{s.shares.toFixed(6)}</td>
              <td>{s.sharePct.toFixed(3)}%</td>
              <td>{s.grossValue.toFixed(6)}</td>
              <td>{s.fees.toFixed(6)}</td>
              <td>{s.net.toFixed(6)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
