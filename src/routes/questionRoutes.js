import express from 'express';
import { protect, teacherOrAdmin } from '../middlewares/auth.js';
import {
  answerQuestion,
  askQuestion,
  deleteAnswer,
  deleteQuestion,
  getAllQuestion,
  getFeaturedQuestions,
  getPublishedQuestions,
  getQuestionById,
  getQuestionByIdForTeacher,
  getQuestionCategory,
  updateAnswer,
  updateQuestion,
} from '../controller/questionController.js';
const questionRouter = express.Router();

questionRouter.get('/', getAllQuestion);
questionRouter.get('/questionCategory', getQuestionCategory);
questionRouter.get('/publishQuestion', getPublishedQuestions)
questionRouter.get('/featuredQuestion', getFeaturedQuestions)
questionRouter.get('/:id', getQuestionById);
questionRouter.get('/teacher/:id', protect, getQuestionByIdForTeacher);

questionRouter.post('/', protect, askQuestion);
questionRouter.put('/:id', protect, updateQuestion);
questionRouter.delete('/:id', protect, deleteQuestion);

questionRouter.post('/:id/answers', protect, teacherOrAdmin, answerQuestion);
questionRouter.put('/:id/answers/:answerId', protect, updateAnswer);
questionRouter.delete(
  '/:id/answers/:answerId',
  protect,
  teacherOrAdmin,
  deleteAnswer
);

export default questionRouter;
