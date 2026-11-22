import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
} from '@nestjs/common';
import { buildErrorEnvelope } from '../../utils/errorEnvelope';

@Catch()
export class HttpErrorEnvelopeFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();

    const statusCode =
      exception instanceof HttpException ? exception.getStatus() : 500;
    const exceptionResponse =
      exception instanceof HttpException ? exception.getResponse() : null;
    const details =
      typeof exceptionResponse === 'object' && exceptionResponse !== null
        ? exceptionResponse
        : null;
    const message =
      typeof exceptionResponse === 'object' &&
      exceptionResponse !== null &&
      'message' in exceptionResponse
        ? (exceptionResponse as any).message
        : exception instanceof Error
          ? exception.message
          : 'Internal server error';

    response.status(statusCode).json(
      buildErrorEnvelope(exception, {
        statusCode,
        code:
          typeof exceptionResponse === 'object' &&
          exceptionResponse !== null &&
          'error' in exceptionResponse
            ? String((exceptionResponse as any).error)
                .toUpperCase()
                .replace(/\s+/g, '_')
            : statusCode >= 500
              ? 'INTERNAL_SERVER_ERROR'
              : 'REQUEST_FAILED',
        message: Array.isArray(message) ? message.join('; ') : String(message),
        details,
        requestId: request.requestId,
      }),
    );
  }
}
