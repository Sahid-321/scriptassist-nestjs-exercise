import { IsNotEmpty, IsString, Length, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RefreshTokenDto {
  @ApiProperty({
    description: 'Refresh token',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  @IsNotEmpty()
  @IsString()
  @Length(32, 512)
  @Matches(/^[A-Za-z0-9+/=._-]+$/, {
    message: 'Invalid token format',
  })
  refreshToken: string;
}
