import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test', 'staging')
    .default('development'),

  PORT: Joi.number().port().default(3000),

  FRONTEND_URL: Joi.string().uri().default('*'),

  JWT_SECRET: Joi.string().min(32).required()
    .messages({
      'string.min': 'JWT_SECRET must be at least 32 characters',
      'any.required': 'JWT_SECRET is required',
    }),

  JWT_REFRESH_SECRET: Joi.string().min(32).required()
    .messages({
      'string.min': 'JWT_REFRESH_SECRET must be at least 32 characters',
      'any.required': 'JWT_REFRESH_SECRET is required',
    }),

  JWT_EXPIRES_IN: Joi.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: Joi.string().default('7d'),

  REDIS_HOST: Joi.string().hostname().default('localhost'),
  REDIS_PORT: Joi.number().port().default(6379),
  REDIS_PASSWORD: Joi.string().allow('').optional(),
  REDIS_DB: Joi.number().integer().min(0).max(15).default(0),
  REDIS_THROTTLE_DB: Joi.number().integer().min(0).max(15).default(6),
  REDIS_DDOS_DB: Joi.number().integer().min(0).max(15).default(5),
  REDIS_URL: Joi.string().uri().optional(),

  MONGODB_URI: Joi.string().uri().required()
    .messages({
      'string.uri': 'MONGODB_URI must be a valid MongoDB connection string',
      'any.required': 'MONGODB_URI is required',
    }),

  SMTP_HOST: Joi.string().hostname().required(),
  SMTP_PORT: Joi.number().port().default(587),
  SMTP_USER: Joi.string().email().required(),
  SMTP_PASS: Joi.string().required(),
  EMAIL_FROM: Joi.string().email().required(),

  // BE-004: Social login provider configuration
  SOCIAL_LOGIN_PROVIDERS: Joi.string().default('').allow('')
    .messages({
      'string.base': 'SOCIAL_LOGIN_PROVIDERS must be a comma-separated list (e.g., "google,twitter")',
    }),
  GOOGLE_OAUTH_CLIENT_ID: Joi.string().optional(),
  TWITTER_OAUTH_CLIENT_ID: Joi.string().optional(),

  AVIATION_STACK_API_KEY: Joi.string().required(),

  BLOCKCHAIN_RPC_URL: Joi.string().uri().required()
    .messages({
      'string.uri': 'BLOCKCHAIN_RPC_URL must be a valid URL',
      'any.required': 'BLOCKCHAIN_RPC_URL is required',
    }),

  BLOCKCHAIN_CHAIN_ID: Joi.number().integer().positive().required(),

  GROQ_API_KEY: Joi.string().required(),

  ETHERSCAN_API_KEY: Joi.string().optional(),

  FIREBASE_SERVICE_ACCOUNT: Joi.string().optional(),

  MAINNET_RPC_URL: Joi.string().uri().optional(),
  MAINNET_MARKET_ADDRESS: Joi.string().pattern(/^0x[a-fA-F0-9]{40}$/).optional(),
  MAINNET_TRADING_ADDRESS: Joi.string().pattern(/^0x[a-fA-F0-9]{40}$/).optional(),
  MAINNET_LIQUIDITY_ADDRESS: Joi.string().pattern(/^0x[a-fA-F0-9]{40}$/).optional(),
  MAINNET_COLLATERAL_ADDRESS: Joi.string().pattern(/^0x[a-fA-F0-9]{40}$/).optional(),

  TESTNET_RPC_URL: Joi.string().uri().optional(),
  TESTNET_MARKET_ADDRESS: Joi.string().pattern(/^0x[a-fA-F0-9]{40}$/).optional(),
  TESTNET_TRADING_ADDRESS: Joi.string().pattern(/^0x[a-fA-F0-9]{40}$/).optional(),
  TESTNET_LIQUIDITY_ADDRESS: Joi.string().pattern(/^0x[a-fA-F0-9]{40}$/).optional(),
  TESTNET_COLLATERAL_ADDRESS: Joi.string().pattern(/^0x[a-fA-F0-9]{40}$/).optional(),

  POLYGON_RPC_URL: Joi.string().uri().optional(),
  POLYGON_MARKET_ADDRESS: Joi.string().pattern(/^0x[a-fA-F0-9]{40}$/).optional(),
  POLYGON_TRADING_ADDRESS: Joi.string().pattern(/^0x[a-fA-F0-9]{40}$/).optional(),
  POLYGON_LIQUIDITY_ADDRESS: Joi.string().pattern(/^0x[a-fA-F0-9]{40}$/).optional(),
  POLYGON_COLLATERAL_ADDRESS: Joi.string().pattern(/^0x[a-fA-F0-9]{40}$/).optional(),

  RPC_URL: Joi.string().uri().optional(),
  ETH_PROVIDER_URL: Joi.string().uri().optional(),
  MARKET_CONTRACT_ADDRESS: Joi.string().pattern(/^0x[a-fA-F0-9]{40}$/).optional(),
  PRIVATE_KEY: Joi.string().pattern(/^0x[a-fA-F0-9]{64}$/).optional(),
  DEPLOYMENT_REGISTRY_JSON: Joi.string().allow('').optional(),
  MARKET_FACTORY_START_BLOCK: Joi.number().integer().min(0).optional(),
  CONTRACT_ABI_EXPECTATIONS_JSON: Joi.string().allow('').optional(),

  WEBHOOK_SECRET: Joi.string()
    .min(16)
    .invalid('default-secret')
    .when('NODE_ENV', {
      is: Joi.valid('production', 'staging'),
      then: Joi.required().messages({
        'any.required': 'WEBHOOK_SECRET is required in production/staging environments',
        'any.invalid': 'WEBHOOK_SECRET must not be the default placeholder value',
        'string.min': 'WEBHOOK_SECRET must be at least 16 characters',
      }),
      otherwise: Joi.string().min(16).default('dev-only-webhook-secret'),
    }),
  WEBHOOK_SECRET_ROTATION: Joi.string().optional(),
  WEBHOOK_TIMESTAMP_WINDOW_MS: Joi.number().integer().positive().optional(),
  WEBHOOK_MAX_ATTEMPTS: Joi.number().integer().min(1).max(20).default(5),
  WEBHOOK_RETRY_BASE_MS: Joi.number().integer().positive().default(2000),
  WEBHOOK_RETRY_FACTOR: Joi.number().min(1).default(2),
  WEBHOOK_RETRY_CAP_MS: Joi.number().integer().positive().default(60000),

  PINATA_API_KEY: Joi.string().optional(),
  PINATA_SECRET_API_KEY: Joi.string().optional(),
  IPFS_NODE_URL: Joi.string().uri().optional(),
  IPFS_GATEWAY: Joi.string().uri().optional(),

  LOG_LEVEL: Joi.string().valid('error', 'warn', 'info', 'debug', 'verbose').default('info'),

  BETA_INVITE_SECRET: Joi.string().min(16).default('gatedelay-beta-secret'),

  EXPORT_ENCRYPTION_KEY: Joi.string().min(32).default('default-key-change-in-prod'),

  RATE_LIMIT_WHITELIST: Joi.string().optional(),

  APP_VERSION: Joi.string().optional(),
}).unknown(true);

export const validateEnv = (config: Record<string, unknown>) => {
  const { error, value } = envValidationSchema.validate(config, {
    abortEarly: false,
    allowUnknown: true,
  });

  if (error) {
    const messages = error.details.map((detail) => detail.message).join(', ');
    throw new Error(`Environment validation failed: ${messages}`);
  }

  return value;
};
