const assert = require('node:assert')
const hre = require('hardhat')

describe('localnet health probe', function () {
  it('exposes a reproducible localhost network URL in the hardhat config', function () {
    assert.strictEqual(hre.config.networks.localhost.url, 'http://127.0.0.1:8545')
  })

  it('serves chain data from the in-process provider', async function () {
    const chainId = await hre.network.provider.send('eth_chainId')
    const blockNumber = await hre.network.provider.send('eth_blockNumber')
    assert.ok(parseInt(chainId, 16) > 0)
    assert.ok(Number(blockNumber) >= 0)
  })

  it('boots the mock contracts after a build (post-build smoke)', async function () {
    const tokenFactory = await hre.ethers.getContractFactory('MockERC20')
    const token = await tokenFactory.deploy('Smoke', 'SMK')
    await token.waitForDeployment()
    assert.strictEqual(await token.name(), 'Smoke')
    assert.strictEqual(await token.symbol(), 'SMK')
  })
})