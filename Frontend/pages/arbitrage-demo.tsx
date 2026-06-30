import React from 'react'
import ArbitrageDisplay from '../components/arbitrage/ArbitrageDisplay'
import mockMarkets from '../data/mockMarkets'

export default function ArbitrageDemoPage() {
  return (
    <div style={{ padding: 24 }}>
      <h2>Arbitrage Demo</h2>
      <p>Demo using mock markets. This page mounts `ArbitrageDisplay` with sample data.</p>
      <ArbitrageDisplay markets={mockMarkets} defaultAmount={0.5} />
    </div>
  )
}
