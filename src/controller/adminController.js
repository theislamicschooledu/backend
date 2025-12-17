import BlogCategory from '../models/BlogCategory.js';
import BlogPost from '../models/BlogPost.js';
import Course from '../models/Course.js';
import Question from '../models/Question.js';
import QuestionCategory from '../models/QuestionCategory.js';
import User from '../models/User.js';

// User Controller
export const getAllUser = async (req, res) => {
  try {
    const users = await User.find();
    if (!users) {
      return res.status(400).json({ success: false, message: 'No user found' });
    }

    res.status(200).json(users);
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const getUserById = async (req, res) => {
  const { id } = req.params;

  try {
    const user = await User.findById(id);
    if (!user)
      return res
        .status(404)
        .json({ success: false, message: 'User not found' });
    res.status(200).json(user);
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: 'User not found' });
    }

    await User.findByIdAndDelete(id);
    return res
      .status(200)
      .json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const banUser = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id);
    if (!user)
      return res
        .status(404)
        .json({ success: false, message: 'User not found' });
    user.isBanned = true;
    await user.save();
    res.json({ success: true, message: 'User banned' });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const unBanUser = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id);
    if (!user)
      return res
        .status(404)
        .json({ success: false, message: 'User not found' });
    user.isBanned = false;
    await user.save();
    res.json({ success: true, message: 'User unbanned' });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const changeRole = async (req, res) => {
  try {
    const { id, role } = req.body;
    const user = await User.findById(id);
    if (!user)
      return res
        .status(404)
        .json({ success: false, message: 'User not found' });
    user.role = role;
    await user.save();
    res.json({ success: true, message: `${user.name} is make as ${role}` });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// Blog Controller
export const getBlogsForAdmin = async (req, res) => {
  try {
    const blogs = await BlogPost.find()
      .sort({ createdAt: -1 })
      .populate('author', 'name role')
      .populate('category', 'name');
    if (!blogs) {
      return res.status(400).json({ success: false, message: 'No blog found' });
    }

    if (req.user.role !== 'admin') {
      return res.status(401).json({
        success: false,
        message: 'Unauthorize | No permission to get blogs',
      });
    }

    res.status(200).json(blogs);
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

export const getBlogByIdForAdmin = async (req, res) => {
  try {
    const { id } = req.params;

    const blog = await BlogPost.findById(id)
      .populate('author', 'name role')
      .populate('category', 'name');
    if (!blog) {
      return res.status(400).json({ success: false, message: 'No blog found' });
    }

    res.status(200).json(blog);
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

export const addBlogCategory = async (req, res) => {
  try {
    const { name } = req.body;

    if (!name) {
      return res
        .status(400)
        .json({ success: false, message: 'Name is required' });
    }

    const existing = await BlogCategory.findOne({ name });
    if (existing) {
      return res
        .status(400)
        .json({ success: false, message: 'Category already exists' });
    }

    const category = await BlogCategory.create({ name });
    res
      .status(201)
      .json({ success: true, message: 'New Category added', category });
  } catch (error) {
    console.error('Error creating category:', error);
    res
      .status(500)
      .json({ success: false, message: 'Failed to create category' });
  }
};

export const deleteBlogCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const category = await BlogCategory.findById(id);

    if (!category) {
      return res
        .status(404)
        .json({ success: false, message: 'Blog category not found' });
    }

    if (req.user.role === 'admin') {
      await BlogCategory.findByIdAndDelete(id);
      return res
        .status(200)
        .json({ success: true, message: 'Blog deleted successfully' });
    } else {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to delete this blog',
      });
    }
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

export const changeBlogStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      return res
        .status(400)
        .json({ success: false, message: 'status is required' });
    }

    const blog = await BlogPost.findById(id);

    if (!blog) {
      return res
        .status(400)
        .json({ success: false, message: 'blog not found' });
    }
    blog.status = status;
    await blog.save();
    res.json({
      success: true,
      message: `You successfully ${status} this blog`,
    });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

export const changeBlogFeatured = async (req, res) => {
  try {
    const { id } = req.params;
    const { featured } = req.body;

    const blog = await BlogPost.findById(id);

    if (!blog) {
      return res
        .status(400)
        .json({ success: false, message: 'blog not found' });
    }
    blog.featured = featured;
    await blog.save();
    res.json({
      success: true,
      message: `You successfully ${featured ? 'featured' : 'disappeared'} this blog`,
      blog,
    });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// QnA Controller
export const addQuestionCategory = async (req, res) => {
  try {
    const { name } = req.body;

    if (!name) {
      return res
        .status(400)
        .json({ success: false, message: 'Name is required' });
    }

    const existing = await QuestionCategory.findOne({ name });
    if (existing) {
      return res
        .status(400)
        .json({ success: false, message: 'Category already exists' });
    }

    const category = await QuestionCategory.create({ name });
    res
      .status(201)
      .json({ success: true, message: 'New Category added', category });
  } catch (error) {
    console.error('Error creating category:', error);
    res
      .status(500)
      .json({ success: false, message: 'Failed to create category' });
  }
};

export const deleteQuestionCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const category = await QuestionCategory.findById(id);

    if (!category) {
      return res
        .status(404)
        .json({ success: false, message: 'Question category not found' });
    }

    if (req.user.role === 'admin') {
      await QuestionCategory.findByIdAndDelete(id);
      return res
        .status(200)
        .json({ success: true, message: 'Question deleted successfully' });
    } else {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to delete this category',
      });
    }
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
}

export const approveAnswer = async (req, res) => {
  try {
    const { id, answerId } = req.params; // questionId, answerId
    const { status } = req.body;

    const question = await Question.findById(id);
    if (!question) {
      return res
        .status(404)
        .json({ success: false, error: 'Question not found' });
    }

    question.answers.forEach((ans) => (ans.isApproved = false));

    const answer = question.answers.id(answerId);
    if (!answer) {
      return res
        .status(404)
        .json({ success: false, error: 'Answer not found' });
    }

    answer.isApproved = status;
    question.approvedAnswer = answer._id;
    if (status === false) {
      question.status = 'pending';
    }

    await question.save();
    res.json({ success: true, message: 'Answer approved', question });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
};

export const getQuestionByIdAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    let question = await Question.findById(id)
      .populate('askedBy', 'name email')
      .populate('answers.answeredBy', 'name role')
      .populate('category', 'name')
      .lean();

    if (!question) {
      return res
        .status(404)
        .json({ success: false, message: 'Question not found' });
    }

    res.status(200).json({ success: true, question });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const changeQnaStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      return res
        .status(400)
        .json({ success: false, message: 'Status is required' });
    }

    const question = await Question.findById(id);
    if (!question) {
      return res
        .status(404)
        .json({ success: false, message: 'Question not found' });
    }

    if (status === 'published' && !question.approvedAnswer) {
      return res.status(400).json({
        success: false,
        message: 'First approve one answer to publish this question',
      });
    }

    question.status = status;
    await question.save();

    return res.status(200).json({
      success: true,
      message: `You successfully ${status} this question`,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message || 'Internal server error',
    });
  }
};

export const changeQnaFeatured = async (req, res) => {
  try {
    const { id } = req.params;
    const { featured } = req.body;

    const question = await Question.findById(id);

    if (!question) {
      return res
        .status(400)
        .json({ success: false, message: 'question not found' });
    }
    question.featured = featured;
    await question.save();
    res.json({
      success: true,
      message: `You successfully ${featured ? 'featured' : 'disappeared'} this question`,
    });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// Course Controller
export const changeCourseStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      return res
        .status(400)
        .json({ success: false, message: 'Status is required' });
    }

    const course = await Course.findById(id);
    if (!course) {
      return res
        .status(404)
        .json({ success: false, message: 'Question not found' });
    }

    course.status = status;
    await course.save();

    return res.status(200).json({
      success: true,
      message: `You successfully ${status} this course`,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message || 'Internal server error',
    });
  }
}

export const changeCourseFeatured = async (req, res) => {
  try {
    const { id } = req.params;
    const { featured } = req.body;

    const course = await Course.findById(id);

    if (!course) {
      return res
        .status(400)
        .json({ success: false, message: 'course not found' });
    }
    course.featured = featured;
    await course.save();
    res.json({
      success: true,
      message: `You successfully ${featured ? 'featured' : 'disappeared'} this course`,
    });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};
