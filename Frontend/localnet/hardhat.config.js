const { task } = require('hardhat/config')
require('@nomicfoundation/hardhat-toolbox')

const LOCAL_HOST = '127.0.0.1'
const LOCAL_PORT = 8545
const LOCAL_RPC_URL = `http://${LOCAL_HOST}:${LOCAL_PORT}`

task('health-check', 'Probe the local hardhat node and report liveness')
  .addOptionalParam('rpcUrl', 'RPC URL to probe', LOCAL_RPC_URL)
  .setAction(async ({ rpcUrl }) => {
    const { JsonRpcProvider } = require('ethers')
    const provider = new JsonRpcProvider(rpcUrl)
    const network = await provider.getNetwork()
    const blockNumber = await provider.getBlockNumber()
    console.log(
      `[health-check] ${rpcUrl} reachable (chainId=${Number(network.chainId)}, block=${blockNumber})`,
    )
    return { ok: true, rpcUrl, chainId: Number(network.chainId), blockNumber }
  })

module.exports = {
  solidity: '0.8.20',
  networks: {
    localhost: {
      url: LOCAL_RPC_URL
    }
  }
}