import { Injectable } from '@nestjs/common';
import balanceService from '../../services/balanceService';

// The legacy model remains the persistence contract for both API stacks.

@Injectable()
export class BalanceService {
  getBalances(userId: string, asset?: string) {
    return balanceService.getBalances(userId, asset);
  }

  getBalance(userId: string, asset: string) {
    return balanceService.getBalance(userId, asset);
  }
}
