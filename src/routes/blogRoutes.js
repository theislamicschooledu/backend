import express from 'express';
import { protect, teacherOrAdmin } from '../middlewares/auth.js';
import {
  createBlog,
  updateBlog,
  deleteBlog,
  getBlogBySlug,
  getFeaturedBlogs,
  getPublishedBlogs,
  getBlogCategory,
  getBlogByIdForAdminOrCreator,
  getBlogsForCreator,
  getPublishedBlogDetails,
} from '../controller/blogController.js';
import { upload } from '../middlewares/upload.js';

const blogRouter = express.Router();

// Create & Update
blogRouter.post('/', protect, teacherOrAdmin, upload.single('cover'), createBlog);
blogRouter.put('/:id', protect, teacherOrAdmin, upload.single('cover'), updateBlog);

// Get Blogs
// blogRouter.get('/', protect, getBlogs);
blogRouter.get('/slug/:slug', getBlogBySlug);
blogRouter.get('/blogCategory', getBlogCategory);
blogRouter.get('/publishedBlog', getPublishedBlogs);
blogRouter.get('/publishedBlog/:id', getPublishedBlogDetails);
blogRouter.get('/featuredBlog', getFeaturedBlogs);
blogRouter.get('/my-blogs', protect, getBlogsForCreator);

// Get by ID
blogRouter.get('/:id', protect, getBlogByIdForAdminOrCreator);


// Delete
blogRouter.delete('/:id', protect, teacherOrAdmin, deleteBlog);

export default blogRouter;
