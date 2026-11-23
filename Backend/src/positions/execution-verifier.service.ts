import { Injectable, BadRequestException, ForbiddenException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ethers } from 'ethers';
import { parseDeploymentRegistry } from '../blockchain/deployment-registry';
import { ExecutionPositionDto } from './dto/position.dto';

const abi = new ethers.Interface([
  'event SharesBought(uint256 indexed marketId,address indexed buyer,uint256 outcome,uint256 shares,uint256 cost)',
  'event SharesSold(uint256 indexed marketId,address indexed seller,uint256 outcome,uint256 shares,uint256 proceeds)',
]);

@Injectable()
export class ExecutionVerifier {
  private readonly provider: ethers.JsonRpcProvider;
  constructor(private readonly config: ConfigService) {
    this.provider = new ethers.JsonRpcProvider(config.get<string>('BLOCKCHAIN_RPC_URL', 'https://rpc.mantle.xyz'));
  }

  async verify(userId: string, dto: ExecutionPositionDto) {
    if (!/^0x[0-9a-fA-F]{64}$/.test(dto.txHash) || !Number.isSafeInteger(dto.logIndex) || dto.logIndex < 0) {
      throw new BadRequestException('Invalid execution reference');
    }
    const network = await this.provider.getNetwork();
    const chainId = network.chainId.toString();
    const raw = this.config.get<string>('DEPLOYMENT_REGISTRY_JSON');
    const deployment = raw && parseDeploymentRegistry(raw).find(e => e.name === 'MarketMaker' && String(e.chainId) === chainId);
    if (!deployment) throw new ServiceUnavailableException('MarketMaker deployment is not configured for this chain');
    const receipt = await this.provider.getTransactionReceipt(dto.txHash);
    const depth = Number(this.config.get('POSITION_CONFIRMATIONS', 12));
    if (!Number.isSafeInteger(depth) || depth < 1) throw new ServiceUnavailableException('Invalid confirmation policy');
    if (!receipt || receipt.status !== 1 || await receipt.confirmations() < depth) {
      throw new BadRequestException('Execution is not confirmed');
    }
    const block = await this.provider.getBlock(receipt.blockNumber);
    if (!block || block.hash !== receipt.blockHash) throw new BadRequestException('Execution is not canonical');
    const log = receipt.logs.find(l => l.index === dto.logIndex);
    if (!log || log.address.toLowerCase() !== deployment.address.toLowerCase()) throw new BadRequestException('Untrusted execution log');
    const event = abi.parseLog(log);
    if (!event || !['SharesBought', 'SharesSold'].includes(event.name)) throw new BadRequestException('Unsupported execution event');
    const market = new ethers.Contract(deployment.address, [
      'function markets(uint256) view returns (string description,uint256 b,uint256 numOutcomes,bool resolved,uint256 winningOutcome,address creator)',
    ], this.provider);
    const details = await market.markets(event.args[0], { blockTag: receipt.blockNumber });
    if (BigInt(details.numOutcomes) !== 2n) throw new BadRequestException('Only binary markets are supported');
    const account = String(event.args[1]).toLowerCase();
    // Signature binds the authenticated application user to this exact chain event.
    const message = ['GateDelay position execution v1', userId, chainId, deployment.address.toLowerCase(), dto.txHash.toLowerCase(), String(dto.logIndex)].join('\n');
    let signer: string;
    try { signer = ethers.verifyMessage(message, dto.signature).toLowerCase(); }
    catch { throw new ForbiddenException('Invalid account proof'); }
    if (signer !== account) throw new ForbiddenException('Execution belongs to another account');
    const outcome = BigInt(event.args[2]);
    if (outcome !== 0n && outcome !== 1n) throw new BadRequestException('Only binary outcomes are supported');
    const shares = BigInt(event.args[3]);
    const collateral = BigInt(event.args[4]);
    if (shares <= 0n || collateral < 0n) throw new BadRequestException('Invalid execution amounts');
    // This repository uses WAD shares and WAD collateral (MarketMaker.redeem is 1:1).
    return {
      key: [chainId, dto.txHash.toLowerCase(), dto.logIndex].join(':'),
      chainId, contract: deployment.address.toLowerCase(), account,
      marketId: event.args[0].toString(), side: outcome === 0n ? 'YES' as const : 'NO' as const,
      action: event.name === 'SharesBought' ? 'BUY' : 'SELL', shares, collateral,
      blockNumber: receipt.blockNumber, blockHash: receipt.blockHash,
      logIndex: dto.logIndex, timestamp: new Date(block.timestamp * 1000),
    };
  }
}
