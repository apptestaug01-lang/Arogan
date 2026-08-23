import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';

export function validate(
  schema: ZodSchema<unknown>,
  source: 'body' | 'query' | 'params' = 'body',
) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      next(result.error);
      return;
    }
    req[source] = result.data as unknown as never;
    next();
  };
}
