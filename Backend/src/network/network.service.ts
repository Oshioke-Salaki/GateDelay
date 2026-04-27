import { Injectable, BadRequestException } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { NetworkConfig, NetworkHealth, NetworkSwitchEvent } from './network.entity';

@Injectable()
export class NetworkService {
  private currentNetwork: string = 'mainnet';
  private networks = new Map<string, NetworkConfig>();
  private networkHealth = new Map<string, NetworkHealth>();
  private switchEvents: NetworkSwitchEvent[] = [];

  constructor() {
    this.initializeNetworks();
  }

  private initializeNetworks(): void {
    const mainnet: NetworkConfig = {
      name: 'mainnet',
      chainId: 1,
      rpcUrl: process.env.MAINNET_RPC_URL || 'https://eth-mainnet.g.alchemy.com/v2/demo',
      contractAddresses: {
        market: process.env.MAINNET_MARKET_ADDRESS || '0x0000000000000000000000000000000000000001',
        trading: process.env.MAINNET_TRADING_ADDRESS || '0x0000000000000000000000000000000000000002',
        liquidity: process.env.MAINNET_LIQUIDITY_ADDRESS || '0x0000000000000000000000000000000000000003',
        collateral: process.env.MAINNET_COLLATERAL_ADDRESS || '0x0000000000000000000000000000000000000004',
      },
      blockExplorer: 'https://etherscan.io',
      nativeCurrency: 'ETH',
    };

    const testnet: NetworkConfig = {
      name: 'testnet',
      chainId: 5,
      rpcUrl: process.env.TESTNET_RPC_URL || 'https://eth-goerli.g.alchemy.com/v2/demo',
      contractAddresses: {
        market: process.env.TESTNET_MARKET_ADDRESS || '0x0000000000000000000000000000000000000005',
        trading: process.env.TESTNET_TRADING_ADDRESS || '0x0000000000000000000000000000000000000006',
        liquidity: process.env.TESTNET_LIQUIDITY_ADDRESS || '0x0000000000000000000000000000000000000007',
        collateral: process.env.TESTNET_COLLATERAL_ADDRESS || '0x0000000000000000000000000000000000000008',
      },
      blockExplorer: 'https://goerli.etherscan.io',
      nativeCurrency: 'ETH',
    };

    const polygon: NetworkConfig = {
      name: 'polygon',
      chainId: 137,
      rpcUrl: process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com',
      contractAddresses: {
        market: process.env.POLYGON_MARKET_ADDRESS || '0x0000000000000000000000000000000000000009',
        trading: process.env.POLYGON_TRADING_ADDRESS || '0x0000000000000000000000000000000000000010',
        liquidity: process.env.POLYGON_LIQUIDITY_ADDRESS || '0x0000000000000000000000000000000000000011',
        collateral: process.env.POLYGON_COLLATERAL_ADDRESS || '0x0000000000000000000000000000000000000012',
      },
      blockExplorer: 'https://polygonscan.com',
      nativeCurrency: 'MATIC',
    };

    this.networks.set('mainnet', mainnet);
    this.networks.set('testnet', testnet);
    this.networks.set('polygon', polygon);
  }

  getCurrentNetwork(): NetworkConfig {
    const network = this.networks.get(this.currentNetwork);
    if (!network) {
      throw new BadRequestException('Current network not found');
    }
    return network;
  }

  switchNetwork(networkName: string): NetworkSwitchEvent {
    const network = this.networks.get(networkName);
    if (!network) {
      throw new BadRequestException(`Network ${networkName} not found`);
    }

    const previousNetwork = this.currentNetwork;
    this.currentNetwork = networkName;

    const event: NetworkSwitchEvent = {
      id: uuidv4(),
      fromNetwork: previousNetwork,
      toNetwork: networkName,
      timestamp: new Date(),
      status: 'success',
      message: `Successfully switched from ${previousNetwork} to ${networkName}`,
    };

    this.switchEvents.push(event);
    return event;
  }

  getNetworkConfig(networkName: string): NetworkConfig {
    const network = this.networks.get(networkName);
    if (!network) {
      throw new BadRequestException(`Network ${networkName} not found`);
    }
    return network;
  }

  getAllNetworks(): NetworkConfig[] {
    return Array.from(this.networks.values());
  }

  async checkNetworkHealth(networkName: string): Promise<NetworkHealth> {
    const network = this.networks.get(networkName);
    if (!network) {
      throw new BadRequestException(`Network ${networkName} not found`);
    }

    const startTime = Date.now();
    let isHealthy = true;
    let error: string | undefined;
    let blockHeight = 0;

    try {
      // Simulate RPC call to check network health
      await new Promise(resolve => setTimeout(resolve, Math.random() * 100));
      blockHeight = Math.floor(Math.random() * 1000000) + 15000000;
    } catch (err) {
      isHealthy = false;
      error = err instanceof Error ? err.message : 'Unknown error';
    }

    const latency = Date.now() - startTime;

    const health: NetworkHealth = {
      network: networkName,
      isHealthy,
      latency,
      blockHeight,
      lastChecked: new Date(),
      error,
    };

    this.networkHealth.set(networkName, health);
    return health;
  }

  getNetworkHealth(networkName: string): NetworkHealth | undefined {
    return this.networkHealth.get(networkName);
  }

  getAllNetworkHealth(): NetworkHealth[] {
    return Array.from(this.networkHealth.values());
  }

  updateContractAddress(networkName: string, contractType: string, address: string): NetworkConfig {
    const network = this.networks.get(networkName);
    if (!network) {
      throw new BadRequestException(`Network ${networkName} not found`);
    }

    if (!network.contractAddresses.hasOwnProperty(contractType)) {
      throw new BadRequestException(`Invalid contract type: ${contractType}`);
    }

    (network.contractAddresses as any)[contractType] = address;
    return network;
  }

  getSwitchHistory(): NetworkSwitchEvent[] {
    return this.switchEvents;
  }
}
