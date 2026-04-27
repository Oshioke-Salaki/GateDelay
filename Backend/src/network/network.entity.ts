export interface NetworkConfig {
  name: string;
  chainId: number;
  rpcUrl: string;
  contractAddresses: {
    market?: string;
    trading?: string;
    liquidity?: string;
    collateral?: string;
  };
  blockExplorer: string;
  nativeCurrency: string;
}

export interface NetworkHealth {
  network: string;
  isHealthy: boolean;
  latency: number;
  blockHeight: number;
  lastChecked: Date;
  error?: string;
}

export interface NetworkSwitchEvent {
  id: string;
  fromNetwork: string;
  toNetwork: string;
  timestamp: Date;
  status: 'success' | 'failed';
  message: string;
}
