import { Injectable, NestMiddleware } from '@nestjs/common';
import { expressCorrelationMiddleware } from '../../utils/correlation';

@Injectable()
export class RequestCorrelationMiddleware implements NestMiddleware {
  use(req: any, res: any, next: () => void) {
    expressCorrelationMiddleware(req, res, next);
  }
}
