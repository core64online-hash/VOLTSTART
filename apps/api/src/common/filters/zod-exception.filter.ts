import { Catch, type ArgumentsHost, type ExceptionFilter } from '@nestjs/common';
import { ZodError } from 'zod';

interface JsonResponse {
  status(code: number): { json(body: unknown): void };
}

/**
 * Помилки валідації zod (`Schema.parse` у контролерах) → 400 з переліком полів.
 * Без фільтра Nest відповідав 500 «Internal server error» на будь-який некоректний запит.
 */
@Catch(ZodError)
export class ZodExceptionFilter implements ExceptionFilter {
  catch(error: ZodError, host: ArgumentsHost): void {
    host
      .switchToHttp()
      .getResponse<JsonResponse>()
      .status(400)
      .json({
        statusCode: 400,
        error: 'Bad Request',
        message: error.issues.map((i) => (i.path.length ? `${i.path.join('.')}: ${i.message}` : i.message)),
      });
  }
}
