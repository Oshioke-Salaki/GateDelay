const { JsonRpcProvider } = require('ethers')

const DEFAULT_RPC_URL = process.env.RPC_URL || 'http://127.0.0.1:8545'

async function main() {
  const rpcUrl = process.argv[2] || DEFAULT_RPC_URL
  const provider = new JsonRpcProvider(rpcUrl)

  try {
    const network = await provider.getNetwork()
    const blockNumber = await provider.getBlockNumber()
    console.log(
      `[health-check] ${rpcUrl} reachable (chainId=${Number(network.chainId)}, block=${blockNumber})`,
    )
  } catch (err) {
    console.error(`[health-check] ${rpcUrl} UNREACHABLE: ${err.message}`)
    console.error('[health-check] start the local node with: npm run node')
    process.exitCode = 1
  }
}

main()