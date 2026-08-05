import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { Request } from 'express';
import { AllowPasswordPending } from '../common/decorators/allow-password-pending.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { getClientIp, getUserAgent } from '../common/utils/request.util';
import { AuthService } from './auth.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';
import { SetPasswordDto } from './dto/set-password.dto';

@ApiTags('Authentification')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Connexion — renvoie un token JWT et le profil utilisateur' })
  login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.authService.login(dto, getClientIp(req), getUserAgent(req));
  }

  @Get('me')
  @AllowPasswordPending()
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: "Profil de l'utilisateur connecté" })
  me(@CurrentUser() user: AuthUser) {
    return this.authService.getProfile(user);
  }

  @Post('change-password')
  @AllowPasswordPending()
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary:
      'Changement du mot de passe de l’utilisateur connecté (également utilisé quand le changement est imposé)',
  })
  changePassword(
    @CurrentUser() user: AuthUser,
    @Body() dto: ChangePasswordDto,
    @Req() req: Request,
  ) {
    return this.authService.changePassword(user, dto, getClientIp(req), getUserAgent(req));
  }

  // ------------------------------------------------------------------
  // Activation d'un compte créé par une personne habilitée
  // ------------------------------------------------------------------

  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Get('activation/:token')
  @ApiOperation({
    summary: 'Vérifie un lien d’activation temporaire et renvoie le compte concerné',
  })
  describeActivation(@Param('token') token: string, @Req() req: Request) {
    return this.authService.describeActivation(token, getClientIp(req), getUserAgent(req));
  }

  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('activation/:token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Définit le mot de passe depuis un lien d’activation (usage unique : le lien est ensuite invalidé)',
  })
  activate(
    @Param('token') token: string,
    @Body() dto: SetPasswordDto,
    @Req() req: Request,
  ) {
    return this.authService.activateAccount(token, dto, getClientIp(req), getUserAgent(req));
  }
}
