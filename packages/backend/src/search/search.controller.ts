import express, { Request, Response, Router } from 'express';
import { SearchService } from './search.service';
import { SearchAuthService } from './search.auth.service';
import { searchAuthMiddleware, AuthenticatedRequest } from './search.auth.middleware';
import { logger } from '../shared/logger/logger';

const controllerLogger = logger.child({ module: 'SearchController' });

export const searchController: Router = express.Router();

const searchService = new SearchService();
const authService = new SearchAuthService();

searchController.get('/auth/slack', async (req: Request, res: Response) => {
  const { code } = req.query;

  if (!code || typeof code !== 'string') {
    res.status(400).json({ error: 'Missing authorization code' });
    return;
  }

  try {
    const result = await authService.authenticateWithSlack(code);
    res.json({
      token: result.token,
      user: {
        userId: result.user.userId,
        teamId: result.user.teamId,
        userName: result.user.userName,
      },
    });
  } catch (error) {
    controllerLogger.error('Authentication error:', error);
    const message = error instanceof Error ? error.message : 'Authentication failed';
    res.status(401).json({ error: message });
  }
});

searchController.get('/auth/me', searchAuthMiddleware, (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }

  res.json({
    userId: req.user.userId,
    teamId: req.user.teamId,
    userName: req.user.userName,
  });
});

searchController.get('/messages', searchAuthMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }

  const { query, userId, channelId, startDate, endDate, limit, offset } = req.query;

  try {
    const results = await searchService.searchMessages({
      teamId: req.user.teamId,
      query: query as string | undefined,
      userId: userId as string | undefined,
      channelId: channelId as string | undefined,
      startDate: startDate as string | undefined,
      endDate: endDate as string | undefined,
      limit: limit ? parseInt(limit as string, 10) : undefined,
      offset: offset ? parseInt(offset as string, 10) : undefined,
    });

    res.json(results);
  } catch (error) {
    controllerLogger.error('Search error:', error);
    const message = error instanceof Error ? error.message : 'Search failed';
    res.status(400).json({ error: message });
  }
});

searchController.get('/users', searchAuthMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }

  try {
    const users = await searchService.getUsers(req.user.teamId);
    res.json(users);
  } catch (error) {
    controllerLogger.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

searchController.get('/channels', searchAuthMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }

  try {
    const channels = await searchService.getChannels(req.user.teamId);
    res.json(channels);
  } catch (error) {
    controllerLogger.error('Error fetching channels:', error);
    res.status(500).json({ error: 'Failed to fetch channels' });
  }
});
