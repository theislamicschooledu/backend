import express from 'express';
import { upload } from '../middlewares/upload.js';
import { 
  createDocumentation, 
  deleteSection, 
  getDocumentation, 
  updateDocumentation,
  getDocumentationById 
} from '../controller/documentationController.js';
import { protect } from '../middlewares/auth.js';
import rateLimit from 'express-rate-limit';

const documentationRouter = express.Router();

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});

// Apply rate limiting
documentationRouter.use(limiter);

// Get all documentation
documentationRouter.get('/', getDocumentation);

// Get specific documentation by ID
documentationRouter.get('/:docId', getDocumentationById);

// Create new documentation (Admin only)
documentationRouter.post(
  '/', 
  protect, 
  upload.fields([
    { name: 'directorVoice', maxCount: 1 },
    { name: 'teacherVoice', maxCount: 1 },
    { name: 'studentVoice', maxCount: 1 },
    { name: 'parentVoice', maxCount: 1 }
  ]), 
  createDocumentation
);

// Update documentation (Admin only)
documentationRouter.put(
  '/:docId', 
  protect, 
  upload.fields([
    { name: 'directorVoice', maxCount: 1 },
    { name: 'teacherVoice', maxCount: 1 },
    { name: 'studentVoice', maxCount: 1 },
    { name: 'parentVoice', maxCount: 1 }
  ]), 
  updateDocumentation
);

// Delete section from documentation (Admin only)
documentationRouter.delete('/:docId/section/:sectionName', protect, deleteSection);

export default documentationRouter;