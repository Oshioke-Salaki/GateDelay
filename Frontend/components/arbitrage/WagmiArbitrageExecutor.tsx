import React, { useState, useRef, useMemo  } from 'react'
import { useWalletClient , useConnectorClient} from 'wagmi'
import { ethers, BrowserProvider, JsonRpcSigner } from 'ethers'
import ArbitrageDisplay from './ArbitrageDisplay'

/** Lazily resolve ethers from the global scope or a CDN-loaded bundle. */
function getEthers() {
  if (typeof window !== 'undefined' && (window as any).ethers) {
    return (window as any).ethers
  }
  return null
}

/** Derive a signer-like object from a wagmi v2 connector client via window.ethereum */
async function getSigner() {
  const { BrowserProvider } = await import('ethers').catch(() => ({ BrowserProvider: null }))
  if (!BrowserProvider || typeof window === 'undefined' || !(window as any).ethereum) return null
  const provider = new BrowserProvider((window as any).ethereum)
  return provider.getSigner()
}

export default function WagmiArbitrageExecutor() {
  const { data: walletClient } = useWalletClient()
  
  const signer = React.useMemo(() => {
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

  const [modalOpen, setModalOpen] = useState(false)
  const pendingRef = useRef<any>(null)

  async function onExecute(opp: any) {
    // Gather addresses: use opportunity data or prompt the user for missing values
    let tokenIn = opp.buy?.tokenAddress
    let tokenOut = opp.sell?.tokenAddress
    let routerAddress = opp.routerAddress || opp.buy?.routerAddress || opp.sell?.routerAddress || '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D'

    if (!tokenIn || !tokenOut) {
      // show modal and wait for user input
      pendingRef.current = { opp }
      setModalOpen(true)
      const result: any = await new Promise((resolve, reject) => {
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
      return { success: true, simulated: true, txHash: fakeHash, message: `Simulated execution on chain ${chainId}` }
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

    return { success: true, txHash: receipt.transactionHash }
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

  function Modal({ open, onClose, onSubmit }: any) {
    const [inAddr, setInAddr] = useState('')
    const [outAddr, setOutAddr] = useState('')
    const [routerAddr, setRouterAddr] = useState('')
    if (!open) return null
    return (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 }}>
        <div style={{ background: 'white', padding: 16, borderRadius: 8, width: 420 }}>
          <h3>Enter token &amp; router addresses</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label>Token In<input value={inAddr} onChange={(e) => setInAddr(e.target.value)} style={{ width: '100%' }} /></label>
            <label>Token Out<input value={outAddr} onChange={(e) => setOutAddr(e.target.value)} style={{ width: '100%' }} /></label>
            <label>Router<input value={routerAddr} onChange={(e) => setRouterAddr(e.target.value)} style={{ width: '100%' }} /></label>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button onClick={() => onClose()} style={{ padding: '6px 10px' }}>Cancel</button>
              <button onClick={() => onSubmit({ tokenIn: inAddr, tokenOut: outAddr, router: routerAddr })} style={{ padding: '6px 10px' }}>Submit</button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      <ArbitrageDisplay onExecute={onExecute as any} />
      <Modal open={modalOpen} onClose={handleModalClose} onSubmit={handleModalSubmit} />
    </>
  )
}
