import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { UsersService } from '../../users/users.service';
import { TokenPayload } from '../interfaces/auth.interfaces';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly logger = new Logger(JwtStrategy.name);

  constructor(
    private configService: ConfigService,
    private usersService: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get('jwt.secret'),
      issuer: configService.get('jwt.issuer'),
      audience: configService.get('jwt.audience'),
      algorithms: ['HS256'], // Explicitly specify allowed algorithms
      passReqToCallback: true, // Pass request to validate method for additional checks
    });
  }

  async validate(request: Request, payload: TokenPayload) {
    try {
      // Validate token structure
      if (!payload.sub || !payload.email || !payload.role) {
        throw new UnauthorizedException('Invalid token structure');
      }

      // Check if user still exists and is active
      const user = await this.usersService.findOne(payload.sub);
      
      if (!user) {
        this.logger.warn(`Token validation failed: User ${payload.sub} not found`);
        throw new UnauthorizedException('User not found');
      }

      // Additional security checks
      const currentTime = Math.floor(Date.now() / 1000);
      
      // Check if token was issued in the future (clock skew protection)
      if (payload.iat && payload.iat > currentTime + 30) {
        this.logger.warn(`Token issued in future: ${payload.iat} > ${currentTime}`);
        throw new UnauthorizedException('Invalid token timestamp');
      }

      // Check token age (additional layer beyond exp claim)
      const maxTokenAge = 24 * 60 * 60; // 24 hours
      if (payload.iat && (currentTime - payload.iat) > maxTokenAge) {
        this.logger.warn(`Token too old: ${currentTime - payload.iat} seconds`);
        throw new UnauthorizedException('Token expired');
      }

      // Extract IP address for logging
      const ipAddress = this.extractIpAddress(request);
      
      // Log successful token validation (for security monitoring)
      this.logger.debug(`Token validated for user ${user.email} from IP ${this.hashIpAddress(ipAddress)}`);

      return {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        tokenId: payload.jti, // Include JWT ID for token tracking
        ipAddress,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`JWT validation error: ${errorMessage}`);
      throw new UnauthorizedException('Invalid token');
    }
  }

  private extractIpAddress(request: Request): string {
    return request.ip || 
           request.connection?.remoteAddress || 
           request.socket?.remoteAddress || 
           (request.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
           'unknown';
  }

  private hashIpAddress(ipAddress: string): string {
    const crypto = require('crypto');
    const salt = this.configService.get('IP_SALT', 'default-salt');
    return crypto.createHash('sha256').update(ipAddress + salt).digest('hex').substring(0, 8);
  }
} 