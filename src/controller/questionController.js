import Question from '../models/Question.js';
import QuestionCategory from '../models/QuestionCategory.js';

export const askQuestion = async (req, res) => {
  try {
    const { title, description, category } = req.body;

    if ((!title || !description, !category)) {
      return res.status(400).json({
        success: false,
        message: 'Title, Description & Category is required',
      });
    }

    const question = new Question({
      title,
      description,
      category,
      askedBy: req.user.id,
    });

    await question.save();

    res.status(201).json({
      success: true,
      message: 'Question is created',
      question: question,
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const answerQuestion = async (req, res) => {
  try {
    const { id } = req.params;
    const { text } = req.body;

    const question = await Question.findById(id);

    if (!question) {
      res.status(400).json({ success: false, message: 'No question found' });
    }

    question.answers.push({
      text,
      answeredBy: req.user.id,
    });

    await question.save();

    res
      .status(200)
      .json({ success: true, message: 'Answer saved', question: question });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const getAllQuestion = async (req, res) => {
  try {
    let questions = await Question.find()
      .populate('askedBy', 'name email')
      .populate('answers.answeredBy', 'name role')
      .populate('category', 'name')
      .lean();

    questions = questions.map((q) => {
      const approvedAnswer = q.answers.find((ans) => ans.isApproved);
      return {
        ...q,
        answers: approvedAnswer ? [approvedAnswer] : [],
      };
    });

    res.status(200).json({ success: true, questions });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const getQuestionById = async (req, res) => {
  try {
    const { id } = req.params;

    let question = await Question.findById(id)
      .populate('askedBy', 'name role')
      .populate('answers.answeredBy', 'name role')
      .populate('category', 'name')
      .lean();

    if (!question) {
      return res
        .status(404)
        .json({ success: false, message: 'No question found' });
    }

    const approvedAnswer = question.answers.find(
      (ans) => ans._id.toString() === question.approvedAnswer?.toString()
    );

    const formattedQuestion = {
      ...question,
      answers: approvedAnswer ? [approvedAnswer] : [],
    };

    res.status(200).json({
      success: true,
      question: formattedQuestion,
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const getQuestionByIdForTeacher = async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.user._id;

    let question = await Question.findById(id)
      .populate('askedBy', 'name role')
      .populate('answers.answeredBy', 'name role')
      .populate('category', 'name')
      .lean();

    if (!question) {
      return res
        .status(404)
        .json({ success: false, message: 'Question not found' });
    }

    if (
      req.user.role !== 'teacher'
    ) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    res.status(200).json({ success: true, question });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const getQuestionCategory = async (req, res) => {
  try {
    const categories = await QuestionCategory.find().sort({ name: 1 });

    if (categories.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: 'No categories found' });
    }

    res.status(200).json({ success: true, categories });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ success: false, message: 'Failed to get categories' });
  }
};

export const getPublishedQuestions = async (req, res) => {
  try {
    let publishedQuestions = await Question.find({ status: 'published' })
      .sort({ createdAt: -1 })
      .populate('askedBy', 'name email')
      .populate('answers.answeredBy', 'name role')
      .populate('category', 'name')
      .lean();

    if (!publishedQuestions || publishedQuestions.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: 'No question found' });
    }

    const formattedQuestions = publishedQuestions.map((q) => {
      const approved = q.answers.find(
        (ans) => ans._id.toString() === q.approvedAnswer?.toString()
      );

      return {
        ...q,
        answers: approved ? [approved] : [],
      };
    });

    res.status(200).json({
      success: true,
      questions: formattedQuestions,
    });
  } catch (error) {
    console.error('Error fetching published questions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch published questions',
    });
  }
};

export const getFeaturedQuestions = async (req, res) => {
  try {
    const featuredQuestions = await Question.find({
      featured: true,
      status: 'published',
    })
      .sort({ createdAt: -1 })
      .populate('askedBy', 'name email')
      .populate('answers.answeredBy', 'name role')
      .lean();

    if (!featuredQuestions || featuredQuestions.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: 'No question found' });
    }

    const formattedQuestions = featuredQuestions.map((q) => {
      const approved = q.answers.find(
        (ans) => ans._id.toString() === q.approvedAnswer?.toString()
      );

      return {
        ...q,
        answers: approved ? [approved] : [],
      };
    });

    res.status(200).json({
      success: true,
      questions: formattedQuestions,
    });
  } catch (error) {
    console.error('Error fetching featured blogs:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch featured blogs',
    });
  }
};

export const updateQuestion = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, category } = req.body;
    const question = await Question.findById(id);

    if (!question) {
      return res
        .status(404)
        .json({ success: false, error: 'Question not found' });
    }

    if (question.askedBy.toString() !== req.user.id) {
      return res.status(403).json({ success: false, error: 'Not authorized' });
    }

    if (question.status === 'approved') {
      return res
        .status(400)
        .json({ success: false, error: 'Cannot edit after approval' });
    }

    question.title = title || question.title;
    question.description = description || question.description;
    question.category = category || question.category;

    await question.save();
    res.json({ success: true, message: 'Question Updated' });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
};

export const updateAnswer = async (req, res) => {
  try {
    const { id, answerId } = req.params; // questionId, answerId
    const { text } = req.body;

    const question = await Question.findById(id);
    if (!question) {
      return res
        .status(404)
        .json({ success: false, error: 'Question not found' });
    }

    const answer = question.answers.id(answerId);
    if (!answer) {
      return res
        .status(404)
        .json({ success: false, error: 'Answer not found' });
    }

    if (answer.isApproved) {
      if (req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          error: 'Only admin can edit an approved answer',
        });
      }
    } else {
      if (answer.answeredBy.toString() !== req.user.id) {
        return res.status(403).json({
          success: false,
          error: 'Not authorized to edit this answer',
        });
      }
    }

    answer.text = text || answer.text;
    await question.save();

    res.json({ success: true, message: 'Answer updated' });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
};

export const deleteQuestion = async (req, res) => {
  try {
    const { id } = req.params;
    const question = await Question.findById(id);

    if (!question) {
      return res
        .status(404)
        .json({ success: false, message: 'Question not found' });
    }
    if (
      req.user.role === 'admin' ||
      question.askedBy.toString() === req.user.id
    ) {
      await Question.findByIdAndDelete(id);
      return res
        .status(200)
        .json({ success: true, message: 'Question deleted successfully' });
    } else {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to delete this question',
      });
    }
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

export const deleteAnswer = async (req, res) => {
  try {
    const { id, answerId } = req.params; // questionId, answerId

    const question = await Question.findById(id);
    if (!question) {
      return res
        .status(404)
        .json({ success: false, message: 'Question not found' });
    }

    const answer = question.answers.id(answerId);
    if (!answer) {
      return res
        .status(404)
        .json({ success: false, message: 'Answer not found' });
    }

    if (answer.isApproved) {
      if (req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Only admin can delete an approved answer',
        });
      }

      question.approvedAnswer = null;
    } else {
      if (
        req.user.role !== 'admin' &&
        answer.answeredBy.toString() !== req.user.id
      ) {
        return res.status(403).json({
          success: false,
          message: 'You are not authorized to delete this answer',
        });
      }
    }

    answer.deleteOne();
    await question.save();

    res
      .status(200)
      .json({ success: true, message: 'Answer deleted successfully' });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};
