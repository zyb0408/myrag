import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthUser {
  userId: string;
  username: string;
  isAdmin: boolean;
}

// Extend Express Request
declare global {
  namespace Express {
    interface Request {
      user: AuthUser;
    }
  }
}

const JWT_SECRET = process.env.JWT_SECRET || 'ragflow-knowledge-qa-secret-key-change-me';
const JWT_EXPIRES_IN = '7d';

export function generateToken(userId: string, username: string, isAdmin: boolean): string {
  return jwt.sign({ userId, username, isAdmin }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

export function verifyToken(token: string): AuthUser | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    return {
      userId: decoded.userId,
      username: decoded.username,
      isAdmin: decoded.isAdmin,
    };
  } catch {
    return null;
  }
}

// Required auth middleware — all protected routes must go through this
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ code: 401, message: '未登录，请先登录' });
    return;
  }

  const token = authHeader.slice(7);
  const user = verifyToken(token);
  if (!user) {
    res.status(401).json({ code: 401, message: '登录已过期，请重新登录' });
    return;
  }

  req.user = user;
  next();
}

// Admin-only middleware
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.user?.isAdmin) {
    res.status(403).json({ code: 403, message: '仅管理员可操作' });
    return;
  }
  next();
}

export { JWT_SECRET };
