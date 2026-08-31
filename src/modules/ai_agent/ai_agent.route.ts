import { Router } from 'express';
import { generateFormula, getLogs } from './ai_agent.controller.js';
import { handleChat } from './chat.controller.js';
import { authMiddleware } from '../../middleware/auth.middleware.js';

export const aiAgentRoute = (router: Router) => {
  router.post('/ai-agent/generate-formula', authMiddleware, generateFormula);
  router.post('/ai-agent/chat', authMiddleware, handleChat);
  router.get('/ai-agent/logs', authMiddleware, getLogs);
};
