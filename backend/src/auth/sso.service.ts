import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BaseClient, generators, Issuer } from 'openid-client';
import { randomBytes } from 'crypto';

/** Durée de vie d'une tentative de connexion SSO (état + PKCE) */
const LOGIN_ATTEMPT_TTL_MS = 10 * 60 * 1000;
/** Durée de vie du code d'échange remis au frontend après authentification */
const EXCHANGE_CODE_TTL_MS = 60 * 1000;

interface LoginAttempt {
  codeVerifier: string;
  nonce: string;
  /** Page demandée avant la redirection vers le fournisseur d'identité */
  returnTo: string;
  expiresAt: number;
}

interface ExchangeEntry {
  userId: string;
  expiresAt: number;
}

/** Identité renvoyée par le fournisseur après authentification */
export interface SsoIdentity {
  email: string;
  subject: string;
  name?: string;
}

/**
 * Authentification unique (SSO) par OpenID Connect.
 *
 * Compatible avec les fournisseurs standards du marché (Microsoft Entra ID,
 * Keycloak, Google Workspace) : seule l'URL de l'émetteur change. Le module
 * reste **optionnel** — sans configuration, l'application fonctionne
 * exactement comme avant avec la connexion par mot de passe.
 *
 * Flux mis en œuvre : Authorization Code + PKCE + `state` + `nonce`.
 * Le jeton applicatif n'est jamais placé dans une URL : le fournisseur
 * redirige vers le frontend avec un **code d'échange à usage unique**, que la
 * page échange contre le JWT par un POST.
 */
@Injectable()
export class SsoService {
  private readonly logger = new Logger(SsoService.name);
  private client: BaseClient | null = null;
  private discovery: Promise<BaseClient> | null = null;

  /** Tentatives en cours, indexées par `state` */
  private readonly attempts = new Map<string, LoginAttempt>();
  /** Codes d'échange à usage unique remis au frontend */
  private readonly exchangeCodes = new Map<string, ExchangeEntry>();

  constructor(private readonly config: ConfigService) {}

  // ------------------------------------------------------------------
  // Configuration
  // ------------------------------------------------------------------

  isEnabled(): boolean {
    return Boolean(
      this.config.get<string>('SSO_ISSUER_URL') &&
        this.config.get<string>('SSO_CLIENT_ID') &&
        this.config.get<string>('SSO_CLIENT_SECRET'),
    );
  }

  /** Libellé affiché sur le bouton de connexion */
  buttonLabel(): string {
    return (
      this.config.get<string>('SSO_BUTTON_LABEL') ||
      'Se connecter avec le compte du groupe'
    );
  }

  /** URL du frontend, base des redirections après authentification */
  private appUrl(): string {
    return (this.config.get<string>('APP_URL') || 'http://localhost:5173').replace(/\/+$/, '');
  }

  private redirectUri(): string {
    return (
      this.config.get<string>('SSO_REDIRECT_URI') ||
      'http://localhost:3000/api/auth/sso/callback'
    );
  }

  /**
   * Découverte du fournisseur (mise en cache).
   * La découverte est paresseuse : un fournisseur injoignable au démarrage
   * n'empêche jamais l'API de démarrer.
   */
  private async getClient(): Promise<BaseClient> {
    if (this.client) {
      return this.client;
    }
    if (!this.isEnabled()) {
      throw new ServiceUnavailableException(
        "L'authentification unique n'est pas configurée sur ce serveur.",
      );
    }
    if (!this.discovery) {
      const issuerUrl = this.config.get<string>('SSO_ISSUER_URL') as string;
      this.discovery = Issuer.discover(issuerUrl)
        .then((issuer) => {
          this.logger.log(`Fournisseur d'identité découvert : ${issuer.issuer}`);
          const client = new issuer.Client({
            client_id: this.config.get<string>('SSO_CLIENT_ID') as string,
            client_secret: this.config.get<string>('SSO_CLIENT_SECRET') as string,
            redirect_uris: [this.redirectUri()],
            response_types: ['code'],
          });
          this.client = client;
          return client;
        })
        .catch((error) => {
          // Nouvelle tentative au prochain appel plutôt qu'un échec définitif
          this.discovery = null;
          this.logger.error(`Découverte du fournisseur d'identité impossible : ${error}`);
          throw new ServiceUnavailableException(
            "Le fournisseur d'identité est injoignable. Réessayez plus tard ou utilisez votre mot de passe.",
          );
        });
    }
    return this.discovery;
  }

  // ------------------------------------------------------------------
  // Étape 1 : redirection vers le fournisseur
  // ------------------------------------------------------------------

  async buildAuthorizationUrl(returnTo: string): Promise<string> {
    const client = await this.getClient();
    this.purgeExpired();

    const state = generators.state();
    const nonce = generators.nonce();
    const codeVerifier = generators.codeVerifier();

    this.attempts.set(state, {
      codeVerifier,
      nonce,
      returnTo,
      expiresAt: Date.now() + LOGIN_ATTEMPT_TTL_MS,
    });

    return client.authorizationUrl({
      scope: this.config.get<string>('SSO_SCOPES') || 'openid email profile',
      state,
      nonce,
      code_challenge: generators.codeChallenge(codeVerifier),
      code_challenge_method: 'S256',
    });
  }

  // ------------------------------------------------------------------
  // Étape 2 : retour du fournisseur
  // ------------------------------------------------------------------

  /**
   * Valide le retour du fournisseur et renvoie l'identité authentifiée.
   * Le `state` est consommé : un lien de retour ne peut pas être rejoué.
   */
  async handleCallback(
    params: Record<string, string | undefined>,
  ): Promise<{ identity: SsoIdentity; returnTo: string }> {
    const client = await this.getClient();
    const state = params.state;
    const attempt = state ? this.attempts.get(state) : undefined;

    if (!state || !attempt) {
      throw new Error('Requête de connexion inconnue ou expirée.');
    }
    this.attempts.delete(state);
    if (attempt.expiresAt < Date.now()) {
      throw new Error('La demande de connexion a expiré.');
    }

    const tokenSet = await client.callback(this.redirectUri(), params, {
      state,
      nonce: attempt.nonce,
      code_verifier: attempt.codeVerifier,
    });

    const claims = tokenSet.claims();
    const email = (claims.email ?? (claims as Record<string, unknown>).preferred_username) as
      | string
      | undefined;

    if (!email) {
      throw new Error(
        "Le fournisseur d'identité n'a pas transmis d'adresse email : vérifiez les scopes configurés.",
      );
    }
    if (claims.email_verified === false) {
      throw new Error("L'adresse email fournie n'est pas vérifiée.");
    }

    return {
      identity: {
        email: String(email).toLowerCase().trim(),
        subject: claims.sub,
        name: typeof claims.name === 'string' ? claims.name : undefined,
      },
      returnTo: attempt.returnTo,
    };
  }

  // ------------------------------------------------------------------
  // Étape 3 : code d'échange à usage unique
  // ------------------------------------------------------------------

  /** Émet un code court que le frontend échangera contre le JWT applicatif */
  issueExchangeCode(userId: string): string {
    this.purgeExpired();
    const code = randomBytes(32).toString('hex');
    this.exchangeCodes.set(code, { userId, expiresAt: Date.now() + EXCHANGE_CODE_TTL_MS });
    return code;
  }

  /** Consomme le code (usage unique) et renvoie l'utilisateur associé */
  consumeExchangeCode(code: string): string | null {
    this.purgeExpired();
    const entry = this.exchangeCodes.get(code);
    if (!entry) {
      return null;
    }
    this.exchangeCodes.delete(code);
    return entry.expiresAt >= Date.now() ? entry.userId : null;
  }

  /** URL de retour vers le frontend (succès ou erreur) */
  frontendRedirect(params: { code?: string; error?: string; returnTo?: string }): string {
    const query = new URLSearchParams();
    if (params.code) query.set('code', params.code);
    if (params.error) query.set('error', params.error);
    if (params.returnTo && params.returnTo !== '/') query.set('returnTo', params.returnTo);
    return `${this.appUrl()}/sso/callback?${query.toString()}`;
  }

  /**
   * N'accepte que des chemins internes : empêche un rebond vers un site tiers
   * (redirection ouverte) via le paramètre `returnTo`.
   */
  sanitizeReturnTo(value: unknown): string {
    if (typeof value !== 'string') return '/';
    if (!value.startsWith('/') || value.startsWith('//')) return '/';
    return value.slice(0, 200);
  }

  private purgeExpired(): void {
    const now = Date.now();
    for (const [key, attempt] of this.attempts) {
      if (attempt.expiresAt < now) this.attempts.delete(key);
    }
    for (const [key, entry] of this.exchangeCodes) {
      if (entry.expiresAt < now) this.exchangeCodes.delete(key);
    }
  }
}
