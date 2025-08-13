import { registerAs } from '@nestjs/config';

export default registerAs('jwt', () => ({
  secret: process.env.JWT_SECRET || (() => {
    throw new Error('JWT_SECRET is required in production');
  })(),
  accessTokenExpiration: process.env.JWT_ACCESS_EXPIRATION || '15m',
  refreshTokenExpiration: process.env.JWT_REFRESH_EXPIRATION || '7d',
  issuer: process.env.JWT_ISSUER || 'taskflow-api',
  audience: process.env.JWT_AUDIENCE || 'taskflow-client',
  // Algorithm should be specified for security
  algorithm: 'HS256',
  // Additional security options
  clockTolerance: 30, // 30 seconds clock skew tolerance
  ignoreExpiration: false,
  ignoreNotBefore: false,
})); 