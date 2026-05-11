import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import { Request } from 'express';

/**
 * Verifies Meta's X-Hub-Signature-256 header on incoming webhook POSTs.
 *
 * Meta signs the raw request body with HMAC-SHA256 using the App Secret.
 * We compute the same HMAC on the raw body and compare with timing-safe equality
 * to prevent timing attacks.
 *
 * Requires rawBody: true in NestFactory.create options.
 */
@Injectable()
export class WhatsAppSignatureGuard implements CanActivate {
  private readonly logger = new Logger(WhatsAppSignatureGuard.name);
  private readonly appSecret = process.env['WHATSAPP_APP_SECRET'] ?? '';

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request & { rawBody?: Buffer }>();

    if (!this.appSecret) {
      this.logger.error('WHATSAPP_APP_SECRET not configured — rejecting all webhook requests');
      throw new UnauthorizedException('Webhook no configurado correctamente');
    }

    const signature = req.headers['x-hub-signature-256'];

    if (typeof signature !== 'string' || !signature.startsWith('sha256=')) {
      this.logger.warn({ ip: req.ip }, 'Missing or malformed X-Hub-Signature-256');
      throw new UnauthorizedException('Firma de webhook inválida');
    }

    const rawBody = req.rawBody;
    if (!rawBody) {
      this.logger.error('rawBody is undefined — ensure rawBody: true is set in NestFactory.create');
      throw new UnauthorizedException('No se pudo verificar la firma del webhook');
    }

    const expectedHmac = createHmac('sha256', this.appSecret)
      .update(rawBody)
      .digest('hex');

    const expected = Buffer.from(`sha256=${expectedHmac}`, 'utf8');
    const received = Buffer.from(signature, 'utf8');

    // Pad to same length to avoid length leak, then compare
    if (expected.length !== received.length) {
      this.logger.warn({ ip: req.ip }, 'Signature length mismatch');
      throw new UnauthorizedException('Firma de webhook inválida');
    }

    if (!timingSafeEqual(expected, received)) {
      this.logger.warn({ ip: req.ip }, 'Signature verification failed');
      throw new UnauthorizedException('Firma de webhook inválida');
    }

    return true;
  }
}
