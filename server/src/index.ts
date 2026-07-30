import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import { ragflowService } from './services/ragflow.js';
import knowledgeBaseRouter from './routes/knowledgeBase.js';
import conversationRouter from './routes/conversation.js';
import chatRouter from './routes/chat.js';
import authRouter from './routes/auth.js';
import adminRouter from './routes/admin.js';

const app = express();

app.use(cors());
app.use(express.json());

// Public routes (no auth required)
app.use('/api/auth', authRouter);

// API Routes
app.use('/api/knowledge-bases', knowledgeBaseRouter);

// Chat assistants endpoint
app.get('/api/chat-assistants', async (_req, res) => {
  try {
    const assistants = await ragflowService.getChatAssistants();
    res.json({ code: 0, data: assistants });
  } catch (error: any) {
    console.error('Failed to fetch chat assistants:', error.message);
    res.status(500).json({ code: 1, message: error.message });
  }
});

// Protected routes (auth required)
app.use('/api/conversations', conversationRouter);
app.use('/api/chat', chatRouter);
app.use('/api/admin', adminRouter);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.listen(config.port, () => {
  console.log(`BFF server running on http://localhost:${config.port}`);
  console.log(`RAGFlow backend: ${config.ragflow.baseUrl}`);
});
