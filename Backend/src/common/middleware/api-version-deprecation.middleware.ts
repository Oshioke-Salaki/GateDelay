import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

export interface ApiVersionConfig {
  deprecatedVersion: string;
  currentVersion: string;
  deprecatedPaths: string[];
  migrationGuideUrl: string;
  sunsetDate?: string;
}

const DEFAULT_CONFIG: ApiVersionConfig = {
  deprecatedVersion: 'v1',
  currentVersion: 'v2',
  deprecatedPaths: ['/api/v1'],
  migrationGuideUrl: 'https://docs.gatedelay.com/migration/v1-to-v2',
  sunsetDate: '2026-12-31',
};

@Injectable()
export class ApiVersionDeprecationMiddleware implements NestMiddleware {
  private readonly config: ApiVersionConfig;

  constructor(config?: Partial<ApiVersionConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  use(req: Request, res: Response, next: NextFunction): void {
    const isDeprecatedPath = this.config.deprecatedPaths.some((path) =>
      req.path.startsWith(path),
    );

    if (isDeprecatedPath) {
      res.setHeader('Deprecation', 'true');
      res.setHeader('Sunset', this.config.sunsetDate || '');
      res.setHeader('Link', `<${this.config.migrationGuideUrl}>; rel="deprecation"; type="text/html"`);
      res.setHeader('X-API-Deprecated-Version', this.config.deprecatedVersion);
      res.setHeader('X-API-Current-Version', this.config.currentVersion);
      res.setHeader('X-API-Migration-Guide', this.config.migrationGuideUrl);
    }

    next();
  }
}

export const createApiVersionDeprecationMiddleware = (config?: Partial<ApiVersionConfig>) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const middleware = new ApiVersionDeprecationMiddleware(config);
    middleware.use(req, res, next);
  };
};