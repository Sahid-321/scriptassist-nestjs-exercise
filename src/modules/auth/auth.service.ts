import { Injectable, UnauthorizedException, ForbiddenException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service';
import { RefreshTokenRepository } from './repositories/refresh-token.repository';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { TokenPayload, AuthTokens, LoginResponse, RefreshTokenResponse } from './interfaces/auth.interfaces';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly maxLoginAttempts = 5;
  private readonly lockoutDuration = 15 * 60 * 1000; // 15 minutes
  private readonly loginAttempts = new Map<string, { count: number; lastAttempt: Date }>();

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly refreshTokenRepository: RefreshTokenRepository,
  ) {}

  async login(loginDto: LoginDto, ipAddress: string, userAgent: string): Promise<LoginResponse> {
    const { email, password } = loginDto;

    // Check for rate limiting
    await this.checkLoginRateLimit(email, ipAddress);

    const user = await this.usersService.findByEmail(email);
    
    if (!user) {
      this.recordFailedLogin(email);
      // Use generic message to prevent user enumeration
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordValid = await bcrypt.compare(password, user.password);
    
    if (!passwordValid) {
      this.recordFailedLogin(email);
      throw new UnauthorizedException('Invalid credentials');
    }

    // Reset failed attempts on successful login
    this.loginAttempts.delete(email);

    // Generate tokens
    const tokens = await this.generateTokens(user.id, user.email, user.role, ipAddress, userAgent);

    this.logger.log(`User ${user.email} logged in successfully from IP: ${this.hashIpAddress(ipAddress)}`);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      tokens,
    };
  }

  async refreshToken(refreshTokenDto: RefreshTokenDto, ipAddress: string, userAgent: string): Promise<RefreshTokenResponse> {
    const { refreshToken } = refreshTokenDto;

    const tokenRecord = await this.refreshTokenRepository.findByToken(refreshToken);

    if (!tokenRecord || !tokenRecord.isActive) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    // Verify IP and user agent for additional security
    const currentIpHash = this.hashIpAddress(ipAddress);
    if (tokenRecord.ipAddress !== currentIpHash) {
      // Revoke all tokens for this user due to potential security breach
      await this.refreshTokenRepository.revokeAllUserTokens(
        tokenRecord.userId,
        'IP address mismatch - potential security breach'
      );
      
      this.logger.warn(`Refresh token used from different IP. User: ${tokenRecord.user.email}`);
      throw new ForbiddenException('Security violation detected');
    }

    // Rotate the refresh token
    const newRefreshToken = await this.refreshTokenRepository.rotateToken(
      refreshToken,
      tokenRecord.userId,
      ipAddress,
      userAgent
    );

    // Generate new access token
    const newTokens = await this.generateTokens(
      tokenRecord.user.id,
      tokenRecord.user.email,
      tokenRecord.user.role,
      ipAddress,
      userAgent,
      newRefreshToken.token
    );

    return { tokens: newTokens };
  }

  async register(registerDto: RegisterDto, ipAddress: string, userAgent: string): Promise<LoginResponse> {
    const existingUser = await this.usersService.findByEmail(registerDto.email);

    if (existingUser) {
      throw new UnauthorizedException('Email already exists');
    }

    const user = await this.usersService.create(registerDto);

    // Generate tokens for the new user
    const tokens = await this.generateTokens(user.id, user.email, user.role, ipAddress, userAgent);

    this.logger.log(`New user registered: ${user.email} from IP: ${this.hashIpAddress(ipAddress)}`);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      tokens,
    };
  }

  async logout(refreshToken: string, userId: string): Promise<void> {
    await this.refreshTokenRepository.revokeToken(refreshToken, 'User logout');
    this.logger.log(`User ${userId} logged out`);
  }

  async logoutAll(userId: string): Promise<void> {
    await this.refreshTokenRepository.revokeAllUserTokens(userId, 'Logout from all devices');
    this.logger.log(`User ${userId} logged out from all devices`);
  }

  async validateUser(userId: string): Promise<any> {
    const user = await this.usersService.findOne(userId);
    
    if (!user) {
      return null;
    }
    
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    };
  }

  private async generateTokens(
    userId: string,
    email: string,
    role: string,
    ipAddress: string,
    userAgent: string,
    existingRefreshToken?: string
  ): Promise<AuthTokens> {
    const jti = crypto.randomUUID(); // JWT ID for tracking
    
    const payload: TokenPayload = {
      sub: userId,
      email,
      role,
      jti,
    };

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: this.configService.get('jwt.accessTokenExpiration', '15m'),
    });

    // Use existing refresh token or create a new one
    let refreshToken: string;
    if (existingRefreshToken) {
      refreshToken = existingRefreshToken;
    } else {
      const refreshTokenRecord = await this.refreshTokenRepository.create(userId, ipAddress, userAgent);
      refreshToken = refreshTokenRecord.token;
    }

    return {
      accessToken,
      refreshToken,
      expiresIn: 15 * 60, // 15 minutes in seconds
    };
  }

  private async checkLoginRateLimit(email: string, ipAddress: string): Promise<void> {
    const key = `${email}-${this.hashIpAddress(ipAddress)}`;
    const attempt = this.loginAttempts.get(key);

    if (attempt) {
      const timeSinceLastAttempt = Date.now() - attempt.lastAttempt.getTime();
      
      if (attempt.count >= this.maxLoginAttempts) {
        if (timeSinceLastAttempt < this.lockoutDuration) {
          const remainingTime = Math.ceil((this.lockoutDuration - timeSinceLastAttempt) / 1000 / 60);
          throw new UnauthorizedException(`Account temporarily locked. Try again in ${remainingTime} minutes.`);
        } else {
          // Reset attempts after lockout period
          this.loginAttempts.delete(key);
        }
      }
    }
  }

  private recordFailedLogin(email: string): void {
    // Note: In production, this should use Redis or database for distributed systems
    const attempt = this.loginAttempts.get(email) || { count: 0, lastAttempt: new Date() };
    attempt.count++;
    attempt.lastAttempt = new Date();
    this.loginAttempts.set(email, attempt);
  }

  private hashIpAddress(ipAddress: string): string {
    const salt = this.configService.get('IP_SALT', 'default-salt');
    return crypto.createHash('sha256').update(ipAddress + salt).digest('hex');
  }
} 