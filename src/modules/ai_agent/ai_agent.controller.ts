import { Request, Response } from 'express';
import { generateFormulaService, getAiLogsService } from './ai_agent.service.js';
import { Error404 } from '../../utils/customError.js';
import { res200, res201 } from '../../utils/response.js';

export const generateFormula = async (req: Request, res: Response) => {
  const { prompt } = req.body;

  if (!prompt) {
    throw new Error404('Prompt wajib diisi');
  }

  const userId = (req as any).user?.user_id;
  const data = await generateFormulaService(prompt, userId);

  return res201({ res, message: 'Formula berhasil di-*generate*', data });
};

export const getLogs = async (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 50;

  const data = await getAiLogsService(page, limit);

  return res200({ res, message: 'Log AI Copilot berhasil diambil', data });
};
