import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { queryOne, execute } from '../db/index.js';
import { generateToken, requireAuth } from '../middleware/auth.js';
import type { User } from '../types/index.js';

const router = Router();

// POST /api/auth/login
router.post('/login', (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      res.status(400).json({ code: 1, message: '用户名和密码不能为空' });
      return;
    }

    const user = queryOne<User>('SELECT * FROM users WHERE username = ?', [username]);
    if (!user) {
      res.status(401).json({ code: 1, message: '用户名或密码错误' });
      return;
    }

    if (!user.is_active) {
      res.status(403).json({ code: 1, message: '账号已被禁用' });
      return;
    }

    const valid = bcrypt.compareSync(password, user.password_hash);
    if (!valid) {
      res.status(401).json({ code: 1, message: '用户名或密码错误' });
      return;
    }

    const token = generateToken(user.id, user.username, !!user.is_admin);

    res.json({
      code: 0,
      data: {
        token,
        user: {
          id: user.id,
          username: user.username,
          displayName: user.display_name,
          isAdmin: !!user.is_admin,
          mustResetPassword: !!user.must_reset_password,
        },
      },
    });
  } catch (error: any) {
    console.error('Login error:', error.message);
    res.status(500).json({ code: 1, message: '登录失败' });
  }
});

// POST /api/auth/reset-password
router.post('/reset-password', (req: Request, res: Response) => {
  try {
    const { username, oldPassword, newPassword } = req.body;

    if (!username || !oldPassword || !newPassword) {
      res.status(400).json({ code: 1, message: '参数不完整' });
      return;
    }

    if (newPassword.length < 6) {
      res.status(400).json({ code: 1, message: '新密码至少 6 位' });
      return;
    }

    const user = queryOne<User>('SELECT * FROM users WHERE username = ?', [username]);
    if (!user) {
      res.status(404).json({ code: 1, message: '用户不存在' });
      return;
    }

    const valid = bcrypt.compareSync(oldPassword, user.password_hash);
    if (!valid) {
      res.status(401).json({ code: 1, message: '原密码错误' });
      return;
    }

    const newHash = bcrypt.hashSync(newPassword, 10);
    execute(
      'UPDATE users SET password_hash = ?, must_reset_password = 0 WHERE id = ?',
      [newHash, user.id]
    );

    res.json({ code: 0, data: { success: true } });
  } catch (error: any) {
    console.error('Reset password error:', error.message);
    res.status(500).json({ code: 1, message: '修改密码失败' });
  }
});

// GET /api/auth/me — get current user info
router.get('/me', requireAuth, (req: Request, res: Response) => {
  try {
    const user = queryOne<User>('SELECT * FROM users WHERE id = ?', [req.user.userId]);
    if (!user) {
      res.status(404).json({ code: 1, message: '用户不存在' });
      return;
    }

    res.json({
      code: 0,
      data: {
        id: user.id,
        username: user.username,
        displayName: user.display_name,
        isAdmin: !!user.is_admin,
        mustResetPassword: !!user.must_reset_password,
      },
    });
  } catch (error: any) {
    res.status(500).json({ code: 1, message: '获取用户信息失败' });
  }
});

export default router;
