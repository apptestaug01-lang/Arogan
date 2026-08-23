import { Request, Response, NextFunction } from 'express';

export function notFound(_req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    message: 'Resource not found',
  });
}
