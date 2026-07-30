import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { queryAll, execute } from '../db/index.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import type { User } from '../types/index.js';

const router = Router();

// All admin routes require auth + admin role
router.use(requireAuth, requireAdmin);

// GET /api/admin/users — list all users
router.get('/users', (_req: Request, res: Response) => {
  try {
    const users = queryAll<User>(
      'SELECT id, username, display_name, must_reset_password, is_active, is_admin, created_at FROM users ORDER BY created_at ASC'
    );
    res.json({
      code: 0,
      data: users.map((u) => ({
        id: u.id,
        username: u.username,
        displayName: u.display_name,
        mustResetPassword: !!u.must_reset_password,
        isActive: !!u.is_active,
        isAdmin: !!u.is_admin,
        createdAt: u.created_at,
      })),
    });
  } catch (error: any) {
    res.status(500).json({ code: 1, message: '获取用户列表失败' });
  }
});

// POST /api/admin/users — create new user
router.post('/users', (req: Request, res: Response) => {
  try {
    const { username, password, displayName } = req.body;

    if (!username || !password || !displayName) {
      res.status(400).json({ code: 1, message: '用户名、密码和显示名称不能为空' });
      return;
    }

    if (password.length < 6) {
      res.status(400).json({ code: 1, message: '密码至少 6 位' });
      return;
    }

    const existing = queryAll('SELECT id FROM users WHERE username = ?', [username]);
    if (existing.length > 0) {
      res.status(400).json({ code: 1, message: '用户名已存在' });
      return;
    }

    const id = uuidv4();
    const hash = bcrypt.hashSync(password, 10);
    const now = new Date().toISOString();

    execute(
      'INSERT INTO users (id, username, password_hash, display_name, must_reset_password, is_active, is_admin, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [id, username, hash, displayName, 1, 1, 0, now]
    );

    res.json({
      code: 0,
      data: {
        id,
        username,
        displayName,
        mustResetPassword: true,
        isActive: true,
        isAdmin: false,
      },
    });
  } catch (error: any) {
    console.error('Create user error:', error.message);
    res.status(500).json({ code: 1, message: '创建用户失败' });
  }
});

// DELETE /api/admin/users/:id — delete user
router.delete('/users/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Don't allow deleting yourself
    if (id === req.user.userId) {
      res.status(400).json({ code: 1, message: '不能删除自己' });
      return;
    }

    // Check if it's the last admin
    const user = queryAll<User>('SELECT is_admin FROM users WHERE id = ?', [id]);
    if (user.length > 0 && user[0].is_admin) {
      const adminCount = queryAll<{ count: number }>(
        'SELECT COUNT(*) as count FROM users WHERE is_admin = 1 AND is_active = 1'
      );
      if (adminCount[0].count <= 1) {
        res.status(400).json({ code: 1, message: '不能删除最后一个管理员' });
        return;
      }
    }

    execute('DELETE FROM users WHERE id = ?', [id]);
    // Also delete user's conversations
    execute('DELETE FROM conversations WHERE user_id = ?', [id]);

    res.json({ code: 0, data: { success: true } });
  } catch (error: any) {
    console.error('Delete user error:', error.message);
    res.status(500).json({ code: 1, message: '删除用户失败' });
  }
});

// PATCH /api/admin/users/:id/reset-password — admin resets user password
router.patch('/users/:id/reset-password', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      res.status(400).json({ code: 1, message: '新密码至少 6 位' });
      return;
    }

    const hash = bcrypt.hashSync(newPassword, 10);
    execute(
      'UPDATE users SET password_hash = ?, must_reset_password = 1 WHERE id = ?',
      [hash, id]
    );

    res.json({ code: 0, data: { success: true } });
  } catch (error: any) {
    res.status(500).json({ code: 1, message: '重置密码失败' });
  }
});

export default router;
