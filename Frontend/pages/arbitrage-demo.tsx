import React from 'react'
import ArbitrageDisplay from '../components/arbitrage/ArbitrageDisplay'

export default function ArbitrageDemoPage() {
  return (
    <div style={{ padding: 24 }}>
      <h2>Arbitrage Demo</h2>
      <p>Demo using markets from the API when available.</p>
      <ArbitrageDisplay defaultAmount={0.5} />
    </div>
  )
}
