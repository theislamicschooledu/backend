import express from 'express';
import { adminOnly, protect } from '../middlewares/auth.js';
import {
  createOrUpdateDocumentation,
  deleteDocumentation,
  getDocumentation,
} from '../controller/documentationController.js';

const documentationRouter = express.Router();

documentationRouter.get('/', protect, adminOnly, getDocumentation);

documentationRouter.post('/', protect, adminOnly, createOrUpdateDocumentation);

documentationRouter.put('/', protect, adminOnly, createOrUpdateDocumentation);

documentationRouter.delete('/', protect, adminOnly, deleteDocumentation);

export default documentationRouter;
