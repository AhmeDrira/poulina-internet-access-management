import { Request } from 'express';

/** Extrait l'adresse IP réelle du client (gère les proxys via X-Forwarded-For) */
export function getClientIp(request: Request): string {
  const forwarded = request.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim();
  }
  return request.ip || request.socket?.remoteAddress || '';
}

/** Extrait le User-Agent du client */
export function getUserAgent(request: Request): string {
  return (request.headers['user-agent'] as string) || '';
}
