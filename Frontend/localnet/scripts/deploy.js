const hre = require('hardhat')

async function main() {
  const [deployer] = await hre.ethers.getSigners()
  console.log('Deploying with', deployer.address)

  const MockERC20 = await hre.ethers.getContractFactory('MockERC20')
  const MockRouter = await hre.ethers.getContractFactory('MockRouter')

  const tokenA = await MockERC20.deploy('TokenA', 'TKA')
  await tokenA.deployed()
  console.log('TokenA:', tokenA.address)

  const tokenB = await MockERC20.deploy('TokenB', 'TKB')
  await tokenB.deployed()
  console.log('TokenB:', tokenB.address)

  const router = await MockRouter.deploy()
  await router.deployed()
  console.log('Router:', router.address)

  // Mint some tokenB to router so swap can send tokenB to users
  const mintAmount = hre.ethers.parseUnits('1000000', 18)
  await tokenB.mint(router.address, mintAmount)
  console.log('Minted tokenB to router')

  // Print a sample markets.json snippet to copy into mockMarkets
  console.log('\nSample mock markets entries:')
  console.log(JSON.stringify([
    { id: 'localA', name: 'Local A', asset: 'TKA', price: 1, feePercent: 0.1, liquidity: 1000, tokenAddress: tokenA.address, routerAddress: router.address },
    { id: 'localB', name: 'Local B', asset: 'TKB', price: 1, feePercent: 0.1, liquidity: 1000, tokenAddress: tokenB.address, routerAddress: router.address }
  ], null, 2))
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})
