import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ethers } from 'ethers';
import { BlockchainService } from '../blockchain/blockchain.service';
import type { MarketResolution } from './resolution.entity';
import type { ConfirmResolutionDto } from './dto/resolution.dto';

@Injectable()
export class ResolutionEvidenceService {
  private readonly provider: ethers.JsonRpcProvider;
  private readonly abi = new ethers.Interface([
    'event MarketResolved(address indexed market, uint8 outcome, address indexed resolver)',
  ]);
  constructor(private readonly config: ConfigService, private readonly blockchain: BlockchainService) {
    this.provider = new ethers.JsonRpcProvider(config.get<string>('BLOCKCHAIN_RPC_URL', 'https://rpc.mantle.xyz'));
  }
  async verify(resolution: MarketResolution, dto: ConfirmResolutionDto) {
    if (!dto.txHash || !/^0x[0-9a-fA-F]{64}$/.test(dto.txHash)) {
      throw new BadRequestException('A transaction hash is required');
    }
    if (!ethers.isAddress(resolution.marketId) || resolution.outcome === 'INVALID') {
      throw new BadRequestException('Resolution contract evidence requires a market address and YES or NO outcome');
    }
    const deployment = this.blockchain.getDeployedContract('Resolution');
    const required = Number(this.config.get('RESOLUTION_REQUIRED_CONFIRMATIONS', 12));
    if (!deployment || !Number.isSafeInteger(required) || required < 1) {
      throw new ServiceUnavailableException('Resolution deployment and positive finality policy must be configured');
    }
    const [network, receipt] = await Promise.all([
      this.provider.getNetwork(), this.provider.getTransactionReceipt(dto.txHash),
    ]);
    if (network.chainId !== BigInt(deployment.chainId)) throw new BadRequestException('Wrong resolution chain');
    if (!receipt || receipt.status !== 1 || receipt.hash.toLowerCase() !== dto.txHash.toLowerCase()) {
      throw new BadRequestException('Resolution transaction has no successful receipt');
    }
    if (dto.blockNumber !== undefined && dto.blockNumber !== receipt.blockNumber) {
      throw new BadRequestException('Block number does not match the receipt');
    }
    const [head, block] = await Promise.all([
      this.provider.getBlockNumber(), this.provider.getBlock(receipt.blockNumber),
    ]);
    if (!block || block.hash !== receipt.blockHash || head - receipt.blockNumber + 1 < required) {
      throw new BadRequestException('Resolution transaction is not canonical or lacks required finality');
    }
    const expected = resolution.outcome === 'YES' ? 1n : 2n;
    const matches = receipt.logs.filter(log => {
      if (log.address.toLowerCase() !== deployment.address.toLowerCase()) return false;
      try {
        const event = this.abi.parseLog(log);
        return event?.name === 'MarketResolved' &&
          event.args.market.toLowerCase() === resolution.marketId.toLowerCase() && event.args.outcome === expected;
      } catch { return false; }
    });
    if (matches.length !== 1) throw new BadRequestException('Expected one matching Resolution.MarketResolved event');
    return { txHash: receipt.hash.toLowerCase(), blockNumber: receipt.blockNumber,
      blockHash: receipt.blockHash, chainId: deployment.chainId,
      contractAddress: deployment.address.toLowerCase(), logIndex: matches[0].index };
  }
}
