import express from 'express';
import { DEFAULT_IMAGE_DIR } from './ai.constants';

export const imageController = express.Router();

imageController.get('/:filename([0-9a-fA-F-]{36}\\.png)', (req, res, next) => {
  express.static(process.env.IMAGE_DIR ?? DEFAULT_IMAGE_DIR, {
    dotfiles: 'deny',
    index: false,
    redirect: false,
    setHeaders: (response) => response.setHeader('X-Content-Type-Options', 'nosniff'),
  })(req, res, next);
});
