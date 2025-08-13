import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { RefreshToken } from '../entities/refresh-token.entity';
import * as crypto from 'crypto';

@Injectable()
export class RefreshTokenRepository {
  constructor(
    @InjectRepository(RefreshToken)
    private readonly repository: Repository<RefreshToken>,
  ) {}

  async create(userId: string, ipAddress: string, userAgent: string): Promise<RefreshToken> {
    const token = this.generateRefreshToken();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiration

    const refreshToken = this.repository.create({
      token,
      userId,
      expiresAt,
      ipAddress: this.hashIpAddress(ipAddress),
      userAgent: this.sanitizeUserAgent(userAgent),
    });

    return this.repository.save(refreshToken);
  }

  async findByToken(token: string): Promise<RefreshToken | null> {
    return this.repository.findOne({
      where: { token },
      relations: ['user'],
    });
  }

  async findActiveByUserId(userId: string): Promise<RefreshToken[]> {
    return this.repository.find({
      where: {
        userId,
        isRevoked: false,
        expiresAt: LessThan(new Date()),
      },
    });
  }

  async revokeToken(token: string, reason: string, replacedByToken?: string): Promise<void> {
    await this.repository.update(
      { token },
      {
        isRevoked: true,
        revokedAt: new Date(),
        revokedReason: reason,
        replacedByToken,
      }
    );
  }

  async revokeAllUserTokens(userId: string, reason: string): Promise<void> {
    await this.repository.update(
      { userId, isRevoked: false },
      {
        isRevoked: true,
        revokedAt: new Date(),
        revokedReason: reason,
      }
    );
  }

  async rotateToken(oldToken: string, userId: string, ipAddress: string, userAgent: string): Promise<RefreshToken> {
    // Revoke the old token
    await this.revokeToken(oldToken, 'Token rotated');

    // Create a new token
    return this.create(userId, ipAddress, userAgent);
  }

  async cleanupExpiredTokens(): Promise<void> {
    await this.repository.delete({
      expiresAt: LessThan(new Date()),
    });
  }

  private generateRefreshToken(): string {
    return crypto.randomBytes(64).toString('hex');
  }

  private hashIpAddress(ipAddress: string): string {
    // Hash IP address for privacy compliance
    return crypto.createHash('sha256').update(ipAddress + process.env.IP_SALT || 'default-salt').digest('hex');
  }

  private sanitizeUserAgent(userAgent: string): string {
    // Sanitize and truncate user agent to prevent injection attacks
    return userAgent?.replace(/[<>]/g, '').substring(0, 500) || 'Unknown';
  }
}
