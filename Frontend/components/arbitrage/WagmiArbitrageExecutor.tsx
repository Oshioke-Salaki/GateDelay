import React, { useState, useRef } from 'react'
import { useWalletClient } from 'wagmi'
import { ethers, BrowserProvider, JsonRpcSigner } from 'ethers'
import ArbitrageDisplay from './ArbitrageDisplay'

function Modal({ open, onClose, onSubmit, defaultIn = '', defaultOut = '', defaultRouter = '' }: any) {
  const [inAddr, setInAddr] = useState(defaultIn)
  const [outAddr, setOutAddr] = useState(defaultOut)
  const [routerAddr, setRouterAddr] = useState(defaultRouter)

  if (!open) return null

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 }}>
      <div style={{ background: 'white', padding: 16, borderRadius: 8, width: 420 }}>
        <h3>Enter token & router addresses</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <label>
            Token In address
            <input value={inAddr} onChange={(e) => setInAddr(e.target.value)} style={{ width: '100%' }} />
          </label>
          <label>
            Token Out address
            <input value={outAddr} onChange={(e) => setOutAddr(e.target.value)} style={{ width: '100%' }} />
          </label>
          <label>
            Router address
            <input value={routerAddr} onChange={(e) => setRouterAddr(e.target.value)} style={{ width: '100%' }} />
          </label>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button onClick={() => onClose()} style={{ padding: '6px 10px' }}>Cancel</button>
            <button onClick={() => onSubmit({ tokenIn: inAddr, tokenOut: outAddr, router: routerAddr })} style={{ padding: '6px 10px' }}>Submit</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// Simple executor that demonstrates creating two transactions: buy then sell.
// In production you would craft contract calls, handle approvals, slippage, gas estimation,
// and use flash swaps/atomic executions. This is a minimal example wiring to Wagmi.

export default function WagmiArbitrageExecutor() {
  const { data: walletClient } = useWalletClient()
  const [modalOpen, setModalOpen] = useState(false)
  const pendingRef = useRef<any>(null)

  async function onExecute(opp: any) {
    if (!walletClient) throw new Error('No signer available')
    const provider = new BrowserProvider(walletClient as any)
    const signer = await provider.getSigner()

    // Gather addresses: use opportunity data or prompt the user for missing values
    let tokenIn = opp.buy?.tokenAddress
    let tokenOut = opp.sell?.tokenAddress
    let routerAddress = opp.routerAddress || opp.buy?.routerAddress || opp.sell?.routerAddress || '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D'

    if (!tokenIn || !tokenOut) {
      // show modal and wait for user input
      pendingRef.current = { opp }
      setModalOpen(true)
      const result = await new Promise<{ tokenIn: string; tokenOut: string; router: string } | false>((resolve, reject) => {
        // attach resolver to ref to be called by modal submit
        ;(pendingRef as any).current.resolve = resolve
        ;(pendingRef as any).current.reject = reject
      })
      if (!result) throw new Error('address entry cancelled')
      tokenIn = result.tokenIn || tokenIn
      tokenOut = result.tokenOut || tokenOut
      routerAddress = result.router || routerAddress
    }

    // Detect network and only run real on-chain flow on local networks
    const network = await signer.provider.getNetwork()
    const chainId = Number(network.chainId)
    const LOCAL_CHAIN_IDS = [31337, 1337, 1338]

    if (!LOCAL_CHAIN_IDS.includes(chainId)) {
      // Simulate execution on public networks for safety
      await new Promise((res) => setTimeout(res, 800))
      const fakeHash = '0x' + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('')
      console.log('Simulated execution', { chainId, txHash: fakeHash })
      return
    }

    const signerAddress = await signer.getAddress()

    const ERC20_ABI = [
      'function approve(address spender, uint256 amount) public returns (bool)',
      'function decimals() view returns (uint8)'
    ]

    const ROUTER_ABI = [
      'function swapExactTokensForTokens(uint256 amountIn,uint256 amountOutMin,address[] calldata path,address to,uint256 deadline) external returns (uint256[] memory amounts)'
    ]

    const tokenContract = new ethers.Contract(tokenIn, ERC20_ABI, signer)

    // Fetch decimals and compute amount in token units
    let decimals = 18
    try {
      // decimals may be a BigNumber in some ABIs; ensure number
      const d = await tokenContract.decimals()
      decimals = Number(d)
    } catch (e) {
      decimals = 18
    }

    const amountInUnits = ethers.parseUnits(String(opp.amount ?? 1), decimals)

    // 1) Approve router to spend tokenIn
    const approveTx = await tokenContract.approve(routerAddress, amountInUnits)
    await approveTx.wait()

    // 2) Execute swap on router
    const router = new ethers.Contract(routerAddress, ROUTER_ABI, signer)
    const path = [tokenIn, tokenOut]
    const amountOutMin = 0 // WARNING: in production calculate slippage-protected minimum
    const deadline = Math.floor(Date.now() / 1000) + 60 * 10

    const swapTx = await router.swapExactTokensForTokens(amountInUnits, amountOutMin, path, signerAddress, deadline)
    const receipt = await swapTx.wait()
    console.log('Swap executed', { txHash: receipt.transactionHash })
  }

  function handleModalSubmit(values: any) {
    setModalOpen(false)
    const resolver = (pendingRef as any).current?.resolve
    if (resolver) resolver({ tokenIn: values.tokenIn, tokenOut: values.tokenOut, router: values.router })
    pendingRef.current = null
  }

  function handleModalClose() {
    setModalOpen(false)
    const rejecter = (pendingRef as any).current?.reject
    if (rejecter) rejecter(false)
    pendingRef.current = null
  }

  return (
    <>
      <ArbitrageDisplay onExecute={onExecute} />
      <Modal open={modalOpen} onClose={handleModalClose} onSubmit={handleModalSubmit} />
    </>
  )
}
