import Course from '../models/Course.js';
import Lecture from '../models/Lecture.js';
import Coupon from '../models/Coupon.js';
import Enrollment from '../models/Enrollment.js';
import CourseCategory from '../models/CourseCategory.js';

import cloudinary from '../utils/cloudinary.js';
import User from '../models/User.js';

// ------------------- Course -------------------

export const createCourse = async (req, res) => {
  try {
    const {
      title,
      price,
      description,
      category,
      teachers,
      enrollmentStart,
      enrollmentEnd,
      courseStart,
      duration,
      status,
      featured,
      features,
    } = req.body;

    // Validation for required fields
    if (
      !title ||
      !price ||
      !description ||
      !category ||
      !enrollmentStart ||
      !enrollmentEnd ||
      !duration ||
      !courseStart
    ) {
      return res.status(400).json({
        success: false,
        message:
          'Title, price, description, category, enrollment dates, and duration are required fields',
      });
    }

    // Validate and parse features array - FIXED VERSION
    let featuresArray = [];
    if (features) {
      // Case 1: Already an array
      if (Array.isArray(features)) {
        featuresArray = features;
      }
      // Case 2: String that might be JSON
      else if (typeof features === 'string') {
        try {
          // Try to parse as JSON first
          const parsed = JSON.parse(features);
          if (Array.isArray(parsed)) {
            featuresArray = parsed;
          } else {
            // If it's a string of comma-separated values
            featuresArray = features
              .split(',')
              .map((feature) => feature.trim())
              .filter(Boolean);
          }
        } catch (error) {
          // If JSON parsing fails, treat as comma-separated string
          featuresArray = features
            .split(',')
            .map((feature) => feature.trim())
            .filter(Boolean);
        }
      }
      // Case 3: Invalid type - set to empty array
      else {
        featuresArray = [];
      }

      // Ensure featuresArray is actually an array before using array methods
      if (!Array.isArray(featuresArray)) {
        featuresArray = [];
      }

      // Validate each feature is not empty (only if we have features)
      if (
        featuresArray.length > 0 &&
        featuresArray.some((feature) => !feature.trim())
      ) {
        return res.status(400).json({
          success: false,
          message: 'Features cannot contain empty values',
        });
      }
    }

    // Validate enrollment dates
    if (new Date(enrollmentStart) >= new Date(enrollmentEnd)) {
      return res.status(400).json({
        success: false,
        message: 'Enrollment end date must be after start date',
      });
    }

    // Validate duration
    if (duration <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Duration must be a positive number',
      });
    }

    // Validate teachers array
    let teachersArray = [];
    if (teachers) {
      if (Array.isArray(teachers)) {
        teachersArray = teachers;
      } else {
        teachersArray = [teachers];
      }

      // Validate if teachers exist in database
      const existingTeachers = await User.find({
        _id: { $in: teachersArray },
        role: { $in: ['teacher', 'admin'] },
      });

      if (existingTeachers.length !== teachersArray.length) {
        return res.status(400).json({
          success: false,
          message: 'One or more selected teachers do not exist',
        });
      }
    }

    // Validate category exists
    const existingCategory = await CourseCategory.findById(category);
    if (!existingCategory) {
      return res.status(400).json({
        success: false,
        message: 'Selected category does not exist',
      });
    }

    let thumbnailUrl = null;
    let thumbnailPublicId = null;

    // Handle thumbnail upload
    if (req.file) {
      // Validate file type
      const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
      if (!allowedMimeTypes.includes(req.file.mimetype)) {
        return res.status(400).json({
          success: false,
          message: 'Only JPG, PNG, and WEBP images are allowed',
        });
      }

      // Validate file size (5MB)
      if (req.file.size > 5 * 1024 * 1024) {
        return res.status(400).json({
          success: false,
          message: 'File size should be less than 5MB',
        });
      }

      try {
        const uploadResult = await new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            {
              folder: 'courses',
              transformation: [
                { width: 800, height: 450, crop: 'fill' },
                { quality: 'auto' },
                { format: 'webp' },
              ],
            },
            (error, result) => {
              if (error) reject(error);
              else resolve(result);
            }
          );
          stream.end(req.file.buffer);
        });

        thumbnailUrl = uploadResult.secure_url;
        thumbnailPublicId = uploadResult.public_id;
      } catch (uploadError) {
        return res.status(500).json({
          success: false,
          message: 'Error uploading thumbnail image',
        });
      }
    }

    // Create new course
    const newCourse = await Course.create({
      title: title.trim(),
      price: parseFloat(price),
      description: description,
      category: category,
      features: featuresArray,
      teachers: teachersArray,
      enrollmentStart: new Date(enrollmentStart),
      enrollmentEnd: new Date(enrollmentEnd),
      courseStart: new Date(courseStart),
      duration: parseInt(duration),
      status: status || 'pending',
      featured: featured === 'true' || featured === true,
      thumbnail: thumbnailUrl,
      thumbnailPublicId: thumbnailPublicId,
      averageRating: 0,
      ratingCount: 0,
      reviews: [],
      lectures: [],
      coupons: [],
    });

    // Populate the response with category and teachers details
    const populatedCourse = await Course.findById(newCourse._id)
      .populate('category', 'name')
      .populate('teachers', 'name email')
      .select('-thumbnailPublicId');

    res.status(201).json({
      success: true,
      message: 'Course created successfully',
      course: populatedCourse,
    });
  } catch (error) {
    console.error('Course creation error:', error);

    // Handle duplicate key errors
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'A course with this title already exists',
      });
    }

    // Handle validation errors
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map((err) => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: errors,
      });
    }

    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}; // Done

export const addCourseCategory = async (req, res) => {
  try {
    const { name } = req.body;

    if (!name) {
      return res
        .status(400)
        .json({ success: false, message: 'Name is required' });
    }

    const existing = await CourseCategory.findOne({ name });
    if (existing) {
      return res
        .status(400)
        .json({ success: false, message: 'Category already exists' });
    }

    const category = await CourseCategory.create({ name });
    res
      .status(201)
      .json({ success: true, message: 'New Category added', category });
  } catch (error) {
    console.error('Error creating category:', error);
    res
      .status(500)
      .json({ success: false, message: 'Failed to create category' });
  }
}; // Done

export const getCourseCategory = async (req, res) => {
  try {
    const categories = await CourseCategory.find().sort({ name: 1 });

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
}; // Done

export const getPublishCourses = async (req, res) => {
  try {
    const publishCourse = await Course.find({
      status: 'published',
    })
      .sort({ createdAt: -1 })
      .populate('category', 'name')
      .populate('teachers', 'name role avatar')
      .select(
        'title thumbnail price category description duration enrollmentEnd courseStart averageRating lectures teachers'
      );

    if (!publishCourse) {
      return res
        .status(404)
        .json({ success: false, message: 'No course found' });
    }

    res.status(200).json({
      success: true,
      courses: publishCourse,
    });
  } catch (error) {
    console.error('Error fetching published course:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch published course',
    });
  }
}; // Done

export const getFeaturedCourses = async (req, res) => {
  try {
    const featuredCourse = await Course.find({
      featured: true,
    })
      .sort({ createdAt: -1 })
      .populate('category', 'name')
      .populate('teachers', 'name role avatar')
      .select(
        'title thumbnail price category description duration enrollmentEnd courseStart averageRating lectures teachers ratingCount'
      );

    if (!featuredCourse) {
      return res
        .status(404)
        .json({ success: false, message: 'No course found' });
    }

    res.status(200).json({
      success: true,
      courses: featuredCourse,
    });
  } catch (error) {
    console.error('Error fetching featured course:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch featured course',
    });
  }
};

export const getCourseDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const course = await Course.findById(id)
      .sort({ createdAt: -1 })
      .populate('category', 'name')
      .populate('lectures', 'title')
      .populate('teachers', 'name role bio avatar')
      .select(
        'averageRating category courseStart description duration enrollmentEnd enrollmentStart featured features lectures price ratingCount status studentCount teachers thumbnail title'
      );

    if (!course) {
      return res
        .status(404)
        .json({ success: false, message: 'No course found' });
    }

    res.status(200).json({
      success: true,
      course,
    });
  } catch (error) {
    console.error('Error fetching published course:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch published course',
    });
  }
};

export const getCourses = async (req, res) => {
  try {
    const courses = await Course.find()
      .populate('teachers', 'name email role')
      .populate('category', 'name')
      .select(
        'title thumbnail price category description features teachers enrollmentStart enrollmentEnd courseStart duration averageRating ratingCount lectures status featured createdAt studentCount'
      );
    const modifiedCourses = courses.map((course) => ({
      ...course.toObject(),
      lectureCount: course.lectures.length,
      lectures: undefined,
    }));

    res.json(modifiedCourses);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getCourseById = async (req, res) => {
  try {
    const course = await Course.findById(req.params.id)
      .populate('teachers', 'name email role')
      .populate('lectures', 'title videoUrl resources')
      .populate('category', 'name');

    if (!course) {
      return res.status(404).json({ message: 'Course not found' });
    }

    const modifiedCourse = {
      ...course._doc,
      lectureCount: course.lectures.length,
    };

    res.json(modifiedCourse);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getCourseWithLectures = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const enrollment = await Enrollment.findOne({
      student: userId,
      course: id,
      paymentStatus: 'completed',
    });

    if (!enrollment) {
      return res
        .status(403)
        .json({ message: 'You must enroll in this course to access lectures' });
    }

    const course = await Course.findById(id).populate(
      'lectures',
      'title videoUrl'
    );

    res.json(course);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const updateCourse = async (req, res) => {
  try {
    const { id } = req.params;

    const {
      title,
      price,
      description,
      category,
      teachers,
      enrollmentStart,
      enrollmentEnd,
      courseStart,
      duration,
      status,
      featured,
      features,
    } = req.body;

    const existingCourse = await Course.findById(id);
    if (!existingCourse) {
      return res.status(404).json({
        success: false,
        message: 'Course not found',
      });
    }

    if (!title?.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Course title is required',
      });
    }

    if (!price || isNaN(price)) {
      return res.status(400).json({
        success: false,
        message: 'Valid price is required',
      });
    }

    if (!description?.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Course description is required',
      });
    }

    if (!category) {
      return res.status(400).json({
        success: false,
        message: 'Category is required',
      });
    }

    // Validate features array
    let featuresArray = [];
    if (features) {
      if (Array.isArray(features)) {
        featuresArray = features;
      } else if (typeof features === 'string') {
        try {
          featuresArray = JSON.parse(features);
        } catch (error) {
          featuresArray = features
            .split(',')
            .map((feature) => feature.trim())
            .filter(Boolean);
        }
      }

      // Validate each feature is not empty
      if (featuresArray.some((feature) => !feature.trim())) {
        return res.status(400).json({
          success: false,
          message: 'Features cannot contain empty values',
        });
      }
    }

    if (!enrollmentStart || !enrollmentEnd) {
      return res.status(400).json({
        success: false,
        message: 'Enrollment start and end dates are required',
      });
    }

    const startDate = new Date(enrollmentStart);
    const endDate = new Date(enrollmentEnd);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid date format',
      });
    }

    if (startDate >= endDate) {
      return res.status(400).json({
        success: false,
        message: 'Enrollment end date must be after start date',
      });
    }

    if (!duration || isNaN(duration) || parseInt(duration) <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Valid duration is required (positive number)',
      });
    }

    let teachersArray = [];
    if (teachers) {
      try {
        if (typeof teachers === 'string') {
          teachersArray = JSON.parse(teachers);
        } else if (Array.isArray(teachers)) {
          teachersArray = teachers;
        } else {
          teachersArray = [teachers];
        }
      } catch (error) {
        teachersArray = Array.isArray(teachers) ? teachers : [teachers];
      }

      teachersArray = [...new Set(teachersArray.filter(Boolean))];

      if (teachersArray.length > 0) {
        const existingTeachers = await User.find({
          _id: { $in: teachersArray },
        });

        if (existingTeachers.length !== teachersArray.length) {
          return res.status(400).json({
            success: false,
            message: 'One or more selected teachers do not exist',
          });
        }
      }
    }

    const existingCategory = await CourseCategory.findById(category);
    if (!existingCategory) {
      return res.status(400).json({
        success: false,
        message: 'Selected category does not exist',
      });
    }

    let thumbnailUrl = existingCourse.thumbnail;
    let thumbnailPublicId = existingCourse.thumbnailPublicId;

    if (req.file) {
      const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
      if (!allowedMimeTypes.includes(req.file.mimetype)) {
        return res.status(400).json({
          success: false,
          message: 'Only JPG, PNG, and WEBP images are allowed',
        });
      }

      if (req.file.size > 5 * 1024 * 1024) {
        return res.status(400).json({
          success: false,
          message: 'File size should be less than 5MB',
        });
      }

      try {
        if (thumbnailPublicId) {
          await cloudinary.uploader.destroy(thumbnailPublicId);
        }

        const uploadResult = await new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            {
              folder: 'courses',
              transformation: [
                { width: 800, height: 450, crop: 'fill' },
                { quality: 'auto' },
                { format: 'webp' },
              ],
            },
            (error, result) => {
              if (error) reject(error);
              else resolve(result);
            }
          );
          stream.end(req.file.buffer);
        });

        thumbnailUrl = uploadResult.secure_url;
        thumbnailPublicId = uploadResult.public_id;
      } catch (uploadError) {
        console.error('Cloudinary upload error:', uploadError);
        return res.status(500).json({
          success: false,
          message: 'Error uploading thumbnail image',
        });
      }
    }

    const updateData = {
      title: title.trim(),
      price: parseFloat(price),
      description: description,
      category: category,
      features: featuresArray,
      teachers: teachersArray,
      enrollmentStart: new Date(enrollmentStart),
      enrollmentEnd: new Date(enrollmentEnd),
      courseStart: new Date(courseStart),
      duration: parseInt(duration),
      status: status || 'pending',
      featured: featured === 'true' || featured === true || featured === '1',
      thumbnail: thumbnailUrl,
      thumbnailPublicId: thumbnailPublicId,
    };

    const updatedCourse = await Course.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    });

    const populatedCourse = await Course.findById(updatedCourse._id)
      .populate('category', 'name')
      .populate('teachers', 'name email')
      .select('-thumbnailPublicId');

    res.status(200).json({
      success: true,
      message: 'Course updated successfully',
      course: populatedCourse,
    });
  } catch (error) {
    console.error('Course update error:', error);

    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'A course with this title already exists',
      });
    }

    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map((err) => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: errors,
      });
    }

    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid course ID',
      });
    }

    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}; // Done

export const deleteCourseCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const category = await CourseCategory.findById(id);

    if (!category) {
      return res
        .status(404)
        .json({ success: false, message: 'Course category not found' });
    }

    if (req.user.role === 'admin') {
      await CourseCategory.findByIdAndDelete(id);
      return res
        .status(200)
        .json({ success: true, message: 'Course deleted successfully' });
    } else {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to delete this course',
      });
    }
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
}; // Done

export const deleteCourse = async (req, res) => {
  try {
    const course = await Course.findByIdAndDelete(req.params.id);
    if (!course) return res.status(404).json({ message: 'Course not found' });
    res.json({ message: 'Course deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}; // Done

export const getTeacherCourses = async (req, res) => {
  try {
    const courses = await Course.find({
      teachers: req.user._id,
    })
      .populate('category', 'name')
      .populate('teachers', 'name email')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: courses.length,
      data: courses,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Server Error',
    });
  }
};

export const getTeacherCourseDetails = async (req, res) => {
  try {
    const course = await Course.findById(req.params.id)
      .populate('teachers', 'name email role')
      .populate('lectures', 'title videoUrl resources')
      .populate('category', 'name');

    if (!course) {
      return res.status(404).json({ message: 'Course not found' });
    }

    const modifiedCourse = {
      ...course._doc,
      lectureCount: course.lectures.length,
    };

    res.json(modifiedCourse);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Server Error',
    });
  }
};

// ------------------- Lecture -------------------

export const createLecture = async (req, res) => {
  try {
    const { title, courseId, videoUrl } = req.body;
    const resourceFiles = req.files?.resources || [];

    // Validation
    if (!title?.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Lecture title is required',
      });
    }

    if (!courseId) {
      return res.status(400).json({
        success: false,
        message: 'Course ID is required',
      });
    }

    // Validate video URL format
    if (videoUrl) {
      try {
        new URL(videoUrl);
      } catch (error) {
        return res.status(400).json({
          success: false,
          message: 'Please provide a valid video URL',
        });
      }
    }

    // Check if course exists
    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found',
      });
    }

    if (req.user.role === 'teacher') {
      const isTeacherOfThisCourse = course.teachers.some(
        (teacherId) => teacherId.toString() === req.user._id.toString()
      );

      if (!isTeacherOfThisCourse) {
        return res.status(403).json({
          success: false,
          message: 'You are not allowed to add lectures to this course.',
        });
      }
    }

    // Upload resource files to Cloudinary (if any)
    const resources = [];
    for (const resourceFile of resourceFiles) {
      try {
        const uploadResult = await new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            {
              resource_type: 'auto',
              folder: 'course-lectures/resources',
            },
            (error, result) => {
              if (error) reject(error);
              else resolve(result);
            }
          );
          stream.end(resourceFile.buffer);
        });

        resources.push({
          title: resourceFile.originalname,
          fileUrl: uploadResult.secure_url,
          publicId: uploadResult.public_id,
        });
      } catch (uploadError) {
        console.error('Resource upload error:', uploadError);
        // Continue with other resources even if one fails
      }
    }

    // Create lecture
    const lecture = await Lecture.create({
      title: title.trim(),
      videoUrl: videoUrl.trim(),
      course: courseId,
      resources,
    });

    // Add lecture to course
    await Course.findByIdAndUpdate(
      courseId,
      { $push: { lectures: lecture._id } },
      { new: true }
    );

    const populatedLecture = await Lecture.findById(lecture._id).populate(
      'course',
      'title'
    );

    res.status(201).json({
      success: true,
      message: 'Lecture created successfully',
      lecture: populatedLecture,
    });
  } catch (error) {
    console.error('Create lecture error:', error);

    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map((err) => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: errors,
      });
    }

    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}; // Done

export const getLecturesByCourse = async (req, res) => {
  try {
    const { courseId } = req.params;

    const lectures = await Lecture.find({ course: courseId }).sort({
      createdAt: 1,
    });

    res.status(200).json({
      success: true,
      lectures,
      count: lectures.length,
    });
  } catch (error) {
    console.error('Get lectures error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
}; // Done

export const updateLecture = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, videoUrl } = req.body;
    const resourceFiles = req.files?.resources || [];

    const lecture = await Lecture.findById(id);
    if (!lecture) {
      return res.status(404).json({
        success: false,
        message: 'Lecture not found',
      });
    }

    // --- Teacher Permission Check ---
    if (req.user.role === 'teacher') {
      const course = await Course.findById(lecture.course).select('teachers');

      const isTeacherOfCourse = course.teachers.some(
        (tId) => tId.toString() === req.user._id.toString()
      );

      if (!isTeacherOfCourse) {
        return res.status(403).json({
          success: false,
          message: 'You are not allowed to update lectures of this course.',
        });
      }
    }

    // Update title
    if (title?.trim()) {
      lecture.title = title.trim();
    }

    // Update video URL
    if (videoUrl?.trim()) {
      try {
        new URL(videoUrl);
        lecture.videoUrl = videoUrl.trim();
      } catch (error) {
        return res.status(400).json({
          success: false,
          message: 'Please provide a valid video URL',
        });
      }
    }

    // New resources upload
    for (const resourceFile of resourceFiles) {
      try {
        const uploadResult = await new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            {
              resource_type: 'auto',
              folder: 'course-lectures/resources',
            },
            (error, result) => {
              if (error) reject(error);
              else resolve(result);
            }
          );
          stream.end(resourceFile.buffer);
        });

        lecture.resources.push({
          title: resourceFile.originalname,
          fileUrl: uploadResult.secure_url,
          publicId: uploadResult.public_id,
        });
      } catch (err) {}
    }

    await lecture.save();

    const updatedLecture = await Lecture.findById(id).populate(
      'course',
      'title'
    );

    res.status(200).json({
      success: true,
      message: 'Lecture updated successfully',
      lecture: updatedLecture,
    });
  } catch (error) {
    console.error('Update lecture error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

export const getLecture = async (req, res) => {
  try {
    const { id } = req.params;

    const lecture = await Lecture.findById(id).populate('course', 'title');

    if (!lecture) {
      return res.status(404).json({
        success: false,
        message: 'Lecture not found',
      });
    }

    res.status(200).json({
      success: true,
      lecture,
    });
  } catch (error) {
    console.error('Get lecture error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

export const deleteLecture = async (req, res) => {
  try {
    const { id } = req.params;

    const lecture = await Lecture.findById(id);
    if (!lecture) {
      return res.status(404).json({
        success: false,
        message: 'Lecture not found',
      });
    }

    // --- Teacher Permission Check ---
    if (req.user.role === 'teacher') {
      const course = await Course.findById(lecture.course).select('teachers');

      const isTeacherOfCourse = course.teachers.some(
        (tId) => tId.toString() === req.user._id.toString()
      );

      if (!isTeacherOfCourse) {
        return res.status(403).json({
          success: false,
          message: 'You are not allowed to delete this lecture.',
        });
      }
    }

    // Delete resources from Cloudinary
    for (const resource of lecture.resources) {
      if (resource.publicId) {
        await cloudinary.uploader.destroy(resource.publicId);
      }
    }

    // Remove lecture from course
    await Course.findByIdAndUpdate(lecture.course, {
      $pull: { lectures: lecture._id },
    });

    // Delete lecture
    await Lecture.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: 'Lecture deleted successfully',
    });
  } catch (error) {
    console.error('Delete lecture error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

export const deleteResource = async (req, res) => {
  try {
    const { lectureId, resourceId } = req.params;

    const lecture = await Lecture.findById(lectureId);
    if (!lecture) {
      return res.status(404).json({
        success: false,
        message: 'Lecture not found',
      });
    }

    // --- Teacher Permission Check ---
    if (req.user.role === 'teacher') {
      const course = await Course.findById(lecture.course).select('teachers');

      const isTeacherOfCourse = course.teachers.some(
        (tId) => tId.toString() === req.user._id.toString()
      );

      if (!isTeacherOfCourse) {
        return res.status(403).json({
          success: false,
          message: 'You are not allowed to delete resources from this lecture.',
        });
      }
    }

    const resource = lecture.resources.id(resourceId);
    if (!resource) {
      return res.status(404).json({
        success: false,
        message: 'Resource not found',
      });
    }

    // Delete resource file
    if (resource.publicId) {
      await cloudinary.uploader.destroy(resource.publicId);
    }

    // Remove resource
    lecture.resources.pull(resourceId);
    await lecture.save();

    res.status(200).json({
      success: true,
      message: 'Resource deleted successfully',
    });
  } catch (error) {
    console.error('Delete resource error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// ------------------- Coupon -------------------

export const addCouponToCourse = async (req, res) => {
  try {
    const { id } = req.params; // courseId
    const coupon = new Coupon({ ...req.body, course: id });
    await coupon.save();

    await Course.findByIdAndUpdate(id, { $push: { coupons: coupon._id } });

    res.status(201).json(coupon);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const updateCoupon = async (req, res) => {
  try {
    const coupon = await Coupon.findByIdAndUpdate(
      req.params.couponId,
      req.body,
      { new: true }
    );
    if (!coupon) return res.status(404).json({ message: 'Coupon not found' });
    res.json(coupon);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const deleteCoupon = async (req, res) => {
  try {
    const coupon = await Coupon.findByIdAndDelete(req.params.couponId);
    if (!coupon) return res.status(404).json({ message: 'Coupon not found' });

    await Course.findByIdAndUpdate(coupon.course, {
      $pull: { coupons: coupon._id },
    });

    res.json({ message: 'Coupon deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
