import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

/**
 * Manejo centralizado: HttpException con cuerpo Nest estándar;
 * otros errores → 500 y mensaje genérico (detalle solo en logs).
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('HTTP');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const payload = exception.getResponse();
      const body =
        typeof payload === 'string'
          ? { statusCode: status, message: payload }
          : { statusCode: status, ...(payload as object) };

      if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
        this.logger.error(
          `${req.method} ${req.url} → ${status}`,
          exception.stack,
        );
      } else if (status >= HttpStatus.BAD_REQUEST) {
        this.logger.warn(`${req.method} ${req.url} → ${status}`);
      }

      return res.status(status).json(body);
    }

    const msg =
      exception instanceof Error ? exception.message : String(exception);
    const stack = exception instanceof Error ? exception.stack : undefined;
    this.logger.error(`${req.method} ${req.url} — ${msg}`, stack);

    return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Error interno del servidor',
    });
  }
}
