import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { Role } from '@prisma/client';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: Role;
  };
}

export function authMiddleware(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction,
): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    req.user = undefined;
    next();
    return;
  }

  const token = authHeader.split(' ')[1];
  const accessSecret = process.env.JWT_ACCESS_SECRET || '';

  try {
    const decoded = jwt.verify(token, accessSecret) as {
      id: string;
      email: string;
      role: Role;
    };
    req.user = decoded;
    next();
  } catch {
    req.user = undefined;
    next();
  }
}

export function requireAuth(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction,
): void {
  if (!req.user) {
    next({
      statusCode: 401,
      message: 'Authentication required',
      isOperational: true,
    } as never);
    return;
  }
  next();
}

export function requireRole(
  ...allowedRoles: Role[]
) {
  return (
    req: AuthenticatedRequest,
    _res: Response,
    next: NextFunction,
  ): void => {
    if (!req.user) {
      next({
        statusCode: 401,
        message: 'Authentication required',
        isOperational: true,
      } as never);
      return;
    }
    if (!allowedRoles.includes(req.user.role)) {
      next({
        statusCode: 403,
        message: 'Insufficient permissions',
        isOperational: true,
      } as never);
      return;
    }
    next();
  };
}
