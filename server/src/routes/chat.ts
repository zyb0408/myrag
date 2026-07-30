import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { queryAll, queryOne, execute } from '../db/index.js';
import { ragflowService } from '../services/ragflow.js';
import { requireAuth } from '../middleware/auth.js';
import type { Message, Conversation } from '../types/index.js';

const router = Router();

// All chat routes require authentication
router.use(requireAuth);

// POST /api/chat/:convId - Send a message and get streaming response
router.post('/:convId', async (req: Request, res: Response) => {
  try {
    const { convId } = req.params;
    const { content } = req.body;
    const userId = req.user.userId;

    if (!content) {
      res.status(400).json({ code: 1, message: 'content is required' });
      return;
    }

    // Get conversation info — verify ownership
    const conv = queryOne<Conversation>(
      'SELECT * FROM conversations WHERE id = ? AND user_id = ?',
      [convId, userId]
    );
    if (!conv) {
      res.status(404).json({ code: 1, message: 'Conversation not found' });
      return;
    }
    const conversation = conv;
    const now = new Date().toISOString();

    // Save user message
    const userMsgId = uuidv4();
    execute(
      'INSERT INTO messages (id, conversation_id, role, content, "references", created_at) VALUES (?, ?, ?, ?, ?, ?)',
      [userMsgId, convId, 'user', content, null, now]
    );

    // Update conversation timestamp
    execute('UPDATE conversations SET updated_at = ? WHERE id = ?', [now, convId]);

    // Fetch all messages for context
    const historyMessages = queryAll<Message>(
      'SELECT role, content FROM messages WHERE conversation_id = ? ORDER BY created_at ASC',
      [convId]
    );

    // Build messages array for RAGFlow
    const messages = historyMessages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    // Call RAGFlow with streaming
    const ragflowResponse = await ragflowService.chatCompletion(
      conversation.assistant_id,
      messages,
      true
    );

    if (!ragflowResponse.ok) {
      const errorText = await ragflowResponse.text();
      console.error('RAGFlow error:', errorText);
      res.status(500).json({ code: 1, message: 'RAGFlow API error' });
      return;
    }

    // Set up SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    const reader = ragflowResponse.body?.getReader();
    if (!reader) {
      res.end();
      return;
    }

    const decoder = new TextDecoder();
    let fullContent = '';
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;

        // Process SSE lines
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            if (data === '[DONE]') continue;

            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content || '';
              if (content) {
                fullContent += content;
              }
            } catch {
              // Skip unparseable chunks
            }

            // Forward the SSE event to the client
            res.write(`${line}\n\n`);
          }
        }
      }
    } catch (err) {
      console.error('Stream read error:', err);
    } finally {
      reader.releaseLock();
    }

    // Save assistant message
    if (fullContent) {
      const assistantMsgId = uuidv4();
      execute(
        'INSERT INTO messages (id, conversation_id, role, content, "references", created_at) VALUES (?, ?, ?, ?, ?, ?)',
      );
    }

    // Send DONE signal
    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error: any) {
    console.error('Chat error:', error.message);
    if (!res.headersSent) {
      res.status(500).json({ code: 1, message: error.message });
    } else {
      res.write(`data: {"error":"${error.message}"}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
    }
  }
});

// POST /api/chat/:convId/stop - Stop generation (placeholder)
router.post('/:convId/stop', (_req: Request, res: Response) => {
  res.json({ code: 0, data: { stopped: true } });
});

export default router;
