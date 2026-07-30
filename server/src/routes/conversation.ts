import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { queryAll, queryOne, execute } from '../db/index.js';
import type { Conversation, Message } from '../types/index.js';

const router = Router();

// GET /api/conversations?kbId=xxx - List conversations for a knowledge base
router.get('/', (req: Request, res: Response) => {
  try {
    const { kb_id } = req.query;
    let conversations: Conversation[];

    if (kb_id) {
      conversations = queryAll<Conversation>(
        'SELECT * FROM conversations WHERE kb_id = ? ORDER BY updated_at DESC',
        [kb_id as string]
      );
    } else {
      conversations = queryAll<Conversation>(
        'SELECT * FROM conversations ORDER BY updated_at DESC'
      );
    }

    res.json({ code: 0, data: conversations });
  } catch (error: any) {
    console.error('Failed to list conversations:', error.message);
    res.status(500).json({ code: 1, message: error.message });
  }
});

// POST /api/conversations - Create a new conversation
router.post('/', (req: Request, res: Response) => {
  try {
    const { name, assistant_id, kb_id, kb_name } = req.body;

    if (!assistant_id || !kb_id || !kb_name) {
      res.status(400).json({
        code: 1,
        message: 'assistant_id, kb_id, and kb_name are required',
      });
      return;
    }

    const now = new Date().toISOString();
    const id = uuidv4();
    const convName = name || `新对话 ${new Date().toLocaleString('zh-CN')}`;

    execute(
      'INSERT INTO conversations (id, name, assistant_id, kb_id, kb_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, convName, assistant_id, kb_id, kb_name, now, now]
    );

    const conversation = queryOne<Conversation>(
      'SELECT * FROM conversations WHERE id = ?',
      [id]
    );

    res.json({ code: 0, data: conversation });
  } catch (error: any) {
    console.error('Failed to create conversation:', error.message);
    res.status(500).json({ code: 1, message: error.message });
  }
});

// PATCH /api/conversations/:id - Rename a conversation
router.patch('/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    if (!name) {
      res.status(400).json({ code: 1, message: 'name is required' });
      return;
    }

    execute(
      'UPDATE conversations SET name = ?, updated_at = ? WHERE id = ?',
      [name, new Date().toISOString(), id]
    );

    const conversation = queryOne<Conversation>(
      'SELECT * FROM conversations WHERE id = ?',
      [id]
    );

    res.json({ code: 0, data: conversation });
  } catch (error: any) {
    console.error('Failed to rename conversation:', error.message);
    res.status(500).json({ code: 1, message: error.message });
  }
});

// DELETE /api/conversations/:id - Delete a conversation
router.delete('/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    execute('DELETE FROM conversations WHERE id = ?', [id]);
    res.json({ code: 0, data: true });
  } catch (error: any) {
    console.error('Failed to delete conversation:', error.message);
    res.status(500).json({ code: 1, message: error.message });
  }
});

// GET /api/conversations/:id/messages - Get messages for a conversation
router.get('/:id/messages', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const messages = queryAll<Message>(
      'SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC',
      [id]
    );
    res.json({ code: 0, data: messages });
  } catch (error: any) {
    console.error('Failed to get messages:', error.message);
    res.status(500).json({ code: 1, message: error.message });
  }
});

export default router;
