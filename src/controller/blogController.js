import BlogPost from '../models/BlogPost.js';
import BlogCategory from '../models/BlogCategory.js';
import cloudinary from '../utils/cloudinary.js';
import mongoose from 'mongoose';

// Create Blog

export const createBlog = async (req, res) => {
  try {
    const { title, content, category } = req.body;

    if (!req.user || !req.user._id) {
      return res
        .status(401)
        .json({ error: 'Unauthorized. Please login first.' });
    }

    let imageUrl = null;
    let imagePublicId = null;

    if (req.file) {
      const uploadResult = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: 'blogs' },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        );
        stream.end(req.file.buffer);
      });

      imageUrl = uploadResult.secure_url;
      imagePublicId = uploadResult.public_id;
    }

    const newBlog = await BlogPost.create({
      title,
      content,
      category,
      cover: imageUrl,
      coverPublicId: imagePublicId,
      author: req.user._id,
    });

    res.status(201).json({ success: true, blog: newBlog });
  } catch (error) {
    console.error('Cloudinary Upload Error:', error);
    res.status(500).json({ error: error.message });
  }
};

// Get Blogs
export const getBlogBySlug = async (req, res) => {
  try {
    const { slug } = req.params;

    const blog = await BlogPost.findOne({
      $or: [{ slug }, { previousSlugs: slug }],
    }).populate('author', 'name email');

    if (!blog) {
      return res.status(404).json({ message: 'Blog not found' });
    }

    if (blog.slug !== slug) {
      return res.status(200).json({
        redirect: `/api/blogs/slug/${blog.slug}`,
      });
    }

    res.status(200).json({ blog });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

export const getBlogCategory = async (req, res) => {
  try {
    const categories = await BlogCategory.find().sort({ name: 1 });

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

export const getPublishedBlogs = async (req, res) => {
  try {
    const publishedBlogs = await BlogPost.find({
      status: 'published',
    })
      .sort({ createdAt: -1 })
      .populate('author', 'name email')
      .populate('category', 'name');

    if (!publishedBlogs) {
      return res.status(404).json({ success: false, message: 'No blog found' });
    }

    res.status(200).json({
      success: true,
      blogs: publishedBlogs,
    });
  } catch (error) {
    console.error('Error fetching published blogs:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch published blogs',
    });
  }
};

export const getPublishedBlogDetails = async (req, res) => {
  try {
    const blog = await BlogPost.findById(req.params.id)
      .populate('author', 'name email')
      .populate('category', 'name');

    if (!blog) {
      return res.status(404).json({ success: false, message: 'No blog found' });
    }

    if (blog.status !== "published") {
      return res.status(401).json({ success: false, message: 'Blog is not published yet.' });
    }

    res.status(200).json({
      success: true,
      blogs: blog,
    });
  } catch (error) {
    console.error('Error fetching published blogs:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch published blogs',
    });
  }
};

export const getFeaturedBlogs = async (req, res) => {
  try {
    const featuredBlogs = await BlogPost.find({
      featured: true,
      status: 'published',
    })
      .sort({ createdAt: -1 })
      .populate('author', 'name email')
      .populate('category', 'name');

    if (!featuredBlogs) {
      return res.status(404).json({ success: false, message: 'No blog found' });
    }

    res.status(200).json({
      success: true,
      blogs: featuredBlogs,
    });
  } catch (error) {
    console.error('Error fetching featured blogs:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch featured blogs',
    });
  }
};

// Get Blogs for creator
export const getBlogsForCreator = async (req, res) => {
  try {
    const blogs = await BlogPost.find({ author: req.user._id })
      .sort({ createdAt: -1 })
      .populate('author', 'name role')
      .populate('category', 'name');
    if (!blogs) {
      return res.status(400).json({ success: false, message: 'No blog found' });
    }

    res.status(200).json(blogs);
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

export const getBlogByIdForAdminOrCreator = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const blog = await BlogPost.findById(id)
      .populate('author', 'name role')
      .populate('category', 'name');

    if (!blog) {
      return res.status(400).json({ success: false, message: 'No blog found' });
    }

    if (
      req.user.role !== 'admin' &&
      blog.author._id.toString() !== userId.toString()
    ) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    res.status(200).json(blog);
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

// Update Blog
export const updateBlog = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;
    const { title, content, category } = req.body;

    const blog = await BlogPost.findById(id);
    if (!blog)
      return res
        .status(404)
        .json({ success: false, message: 'Blog not found' });

    if (
      req.user.role !== 'admin' &&
      blog.author._id.toString() !== userId.toString()
    ) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    blog.title = title || blog.title;
    blog.content = content || blog.content;
    blog.category = category || blog.category;

    if (req.file) {
      if (blog.coverPublicId) {
        await cloudinary.uploader.destroy(blog.coverPublicId);
      }

      const result = await cloudinary.uploader.upload_stream(
        { folder: 'blogs' },
        async (error, result) => {
          if (error) throw error;
          blog.cover = result.secure_url;
          blog.coverPublicId = result.public_id;
          await blog.save();
          res.json({ success: true, blog });
        }
      );

      result.end(req.file.buffer);
      return;
    }

    await blog.save();
    res.json({ success: true, blog });
  } catch (error) {
    console.error('Update Blog Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server Error',
      error: error.message,
    });
  }
};

// Delete Blog
export const deleteBlog = async (req, res) => {
  try {
    const { id } = req.params;
    const blog = await BlogPost.findById(id);

    if (!blog) {
      return res
        .status(404)
        .json({ success: false, message: 'Blog not found' });
    }

    if (
      req.user.role === 'admin' ||
      (req.user.role === 'teacher' && blog.author.toString() === req.user.id)
    ) {
      await BlogPost.findByIdAndDelete(id);
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
