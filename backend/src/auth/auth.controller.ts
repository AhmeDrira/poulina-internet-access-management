import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { AllowPasswordPending } from '../common/decorators/allow-password-pending.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { getClientIp, getUserAgent } from '../common/utils/request.util';
import { AuthService } from './auth.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';
import { SetPasswordDto } from './dto/set-password.dto';
import { SsoExchangeDto } from './dto/sso-exchange.dto';
import { SsoService } from './sso.service';

@ApiTags('Authentification')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly sso: SsoService,
  ) {}

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

  // ------------------------------------------------------------------
  // Authentification unique (OpenID Connect)
  // ------------------------------------------------------------------

  @Public()
  @Get('sso/config')
  @ApiOperation({
    summary: 'Indique si l’authentification unique est disponible (affiche le bouton)',
  })
  ssoConfig() {
    return { enabled: this.sso.isEnabled(), label: this.sso.buttonLabel() };
  }

  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 15, ttl: 60_000 } })
  @Get('sso/login')
  @ApiOperation({ summary: 'Redirige vers le fournisseur d’identité du groupe' })
  async ssoLogin(@Query('returnTo') returnTo: string, @Res() res: Response) {
    const target = this.sso.sanitizeReturnTo(returnTo);
    try {
      const url = await this.sso.buildAuthorizationUrl(target);
      return res.redirect(url);
    } catch (error) {
      // Fournisseur injoignable : retour au portail avec un message explicite
      return res.redirect(
        this.sso.frontendRedirect({
          error:
            error instanceof Error
              ? error.message
              : "Le fournisseur d'identité est injoignable.",
        }),
      );
    }
  }

  @Public()
  @Get('sso/callback')
  @ApiOperation({
    summary:
      'Retour du fournisseur d’identité : redirige vers le portail avec un code d’échange à usage unique',
  })
  async ssoCallback(
    @Query() query: Record<string, string>,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    try {
      if (query.error) {
        throw new Error(
          query.error_description || `Authentification refusée par le fournisseur (${query.error}).`,
        );
      }
      const { identity, returnTo } = await this.sso.handleCallback(query);
      const user = await this.authService.resolveSsoUser(
        identity,
        getClientIp(req),
        getUserAgent(req),
      );
      const code = this.sso.issueExchangeCode(user._id.toString());
      return res.redirect(this.sso.frontendRedirect({ code, returnTo }));
    } catch (error) {
      const message =
        error instanceof HttpException
          ? ((error.getResponse() as { message?: string })?.message ?? error.message)
          : error instanceof Error
            ? error.message
            : 'Authentification unique impossible.';
      return res.redirect(this.sso.frontendRedirect({ error: message }));
    }
  }

  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 15, ttl: 60_000 } })
  @Post('sso/exchange')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Échange le code à usage unique contre un jeton de session applicatif',
  })
  async ssoExchange(@Body() dto: SsoExchangeDto, @Req() req: Request) {
    const userId = this.sso.consumeExchangeCode(dto.code);
    if (!userId) {
      throw new UnauthorizedException(
        'Ce lien de connexion a expiré ou a déjà été utilisé. Relancez la connexion.',
      );
    }
    return this.authService.issueSsoSession(userId, getClientIp(req), getUserAgent(req));
  }

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
