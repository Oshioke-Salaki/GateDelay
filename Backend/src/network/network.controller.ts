import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { NetworkService } from './network.service';

@Controller('network')
export class NetworkController {
  constructor(private readonly networkService: NetworkService) {}

  @Get('current')
  getCurrentNetwork() {
    return this.networkService.getCurrentNetwork();
  }

  @Post('switch/:networkName')
  switchNetwork(@Param('networkName') networkName: string) {
    return this.networkService.switchNetwork(networkName);
  }

  @Get('config/:networkName')
  getNetworkConfig(@Param('networkName') networkName: string) {
    return this.networkService.getNetworkConfig(networkName);
  }

  @Get('all')
  getAllNetworks() {
    return this.networkService.getAllNetworks();
  }

  @Get('health/:networkName')
  async checkNetworkHealth(@Param('networkName') networkName: string) {
    return this.networkService.checkNetworkHealth(networkName);
  }

  @Get('health')
  getAllNetworkHealth() {
    return this.networkService.getAllNetworkHealth();
  }

  @Post('contract-address/:networkName')
  updateContractAddress(
    @Param('networkName') networkName: string,
    @Body() body: { contractType: string; address: string },
  ) {
    return this.networkService.updateContractAddress(networkName, body.contractType, body.address);
  }

  @Get('switch-history')
  getSwitchHistory() {
    return this.networkService.getSwitchHistory();
  }
}
