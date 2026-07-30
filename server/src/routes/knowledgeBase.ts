import { Router, Request, Response } from 'express';
import { ragflowService } from '../services/ragflow.js';

const router = Router();

// GET / - List all knowledge bases (datasets)
router.get('/', async (_req: Request, res: Response) => {
  try {
    const kbs = await ragflowService.getKnowledgeBases();
    res.json({ code: 0, data: kbs });
  } catch (error: any) {
    console.error('Failed to fetch knowledge bases:', error.message);
    res.status(500).json({ code: 1, message: error.message });
  }
});

export default router;
