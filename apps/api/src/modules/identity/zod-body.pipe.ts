import { HttpStatus, type PipeTransform } from '@nestjs/common';
import type { z } from 'zod';
import { ApiError } from './errors.js';

/** Validates a request body against a shared zod schema and returns the parsed value. */
export class ZodBody<T extends z.ZodType> implements PipeTransform<unknown, z.infer<T>> {
  constructor(private readonly schema: T) {}

  transform(value: unknown): z.infer<T> {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      const issue = result.error.issues[0];
      const field = issue?.path.length ? String(issue.path[0]) : undefined;
      throw new ApiError(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'invalid_request',
        issue?.message ?? 'Invalid request.',
        field,
      );
    }
    return result.data;
  }
}
