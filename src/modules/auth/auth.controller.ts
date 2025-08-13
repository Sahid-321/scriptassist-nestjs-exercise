import { 
  Controller, 
  Post, 
  Body, 
  Request, 
  Headers,
  UseFilters,
  UsePipes,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiHeader } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { EnhancedRateLimit } from '../../common/guards/enhanced-rate-limit.guard';
import { EnhancedValidationPipe } from '../../common/pipes/enhanced-validation.pipe';
import { HttpExceptionFilter } from '../../common/filters/http-exception.filter';

@ApiTags('Authentication')
@Controller('auth')
@UseFilters(HttpExceptionFilter)
@UsePipes(EnhancedValidationPipe)
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  @ApiOperation({ summary: 'User login' })
  @ApiResponse({ status: 200, description: 'Login successful' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  @ApiResponse({ status: 429, description: 'Too many requests' })
  @ApiHeader({
    name: 'User-Agent',
    description: 'Client user agent',
    required: true,
  })
  @EnhancedRateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5, // Limit login attempts
    skipSuccessfulRequests: true,
  })
  async login(
    @Body() loginDto: LoginDto,
    @Request() req: any,
    @Headers('user-agent') userAgent: string,
  ) {
    const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';
    return this.authService.login(loginDto, ipAddress, userAgent || 'unknown');
  }

  @Post('register')
  @ApiOperation({ summary: 'User registration' })
  @ApiResponse({ status: 201, description: 'Registration successful' })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 409, description: 'Email already exists' })
  @EnhancedRateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 3, // Limit registration attempts
  })
  async register(
    @Body() registerDto: RegisterDto,
    @Request() req: any,
    @Headers('user-agent') userAgent: string,
  ) {
    const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';
    return this.authService.register(registerDto, ipAddress, userAgent || 'unknown');
  }
} 