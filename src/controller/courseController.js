import Course from '../models/Course.js';
import Lecture from '../models/Lecture.js';
import Coupon from '../models/Coupon.js';
import Enrollment from '../models/Enrollment.js';
import CourseCategory from '../models/CourseCategory.js';

import cloudinary from '../utils/cloudinary.js';
import User from '../models/User.js';

// Constants for consistent status values
const COURSE_STATUS = {
  COMING_SOON: 'coming_soon',
  UPCOMING: 'upcoming',
  ENROLLMENT_OPEN: 'enrollment_open',
  ENROLLMENT_CLOSED: 'enrollment_closed',
  COURSE_STARTED: 'course_started',
  PUBLISHED: 'published',
  PENDING: 'pending',
};

// Helper function to determine course status based on dates
const getCourseStatus = (course) => {
  const now = new Date();

  // If isUpcoming is true, it's always "coming soon"
  if (course.isUpcoming === true) {
    return COURSE_STATUS.COMING_SOON;
  }

  // If any of the dates is missing, it's "coming soon"
  if (!course.enrollmentStart || !course.enrollmentEnd || !course.courseStart) {
    return COURSE_STATUS.COMING_SOON;
  }

  // If enrollment hasn't started yet
  if (now < course.enrollmentStart) {
    return COURSE_STATUS.UPCOMING;
  }

  // If enrollment is open
  if (now >= course.enrollmentStart && now <= course.enrollmentEnd) {
    return COURSE_STATUS.ENROLLMENT_OPEN;
  }

  // If enrollment closed but course hasn't started
  if (now > course.enrollmentEnd && now < course.courseStart) {
    return COURSE_STATUS.ENROLLMENT_CLOSED;
  }

  // If course has started
  if (now >= course.courseStart) {
    return COURSE_STATUS.COURSE_STARTED;
  }

  return COURSE_STATUS.PUBLISHED; // fallback
};

// Format course response with additional status info
const formatCourseResponse = (course) => {
  if (!course) return null;

  const courseObj = course.toObject ? course.toObject() : course;
  const currentStatus = getCourseStatus(course);

  return {
    ...courseObj,
    currentStatus,
    isComingSoon: currentStatus === COURSE_STATUS.COMING_SOON,
  };
};

// Helper function to handle errors consistently
const handleError = (res, error, customMessage = 'Internal server error') => {
  console.error(`Error: ${customMessage}`, error);

  if (error.name === 'CastError') {
    return res.status(400).json({
      success: false,
      message: 'Invalid ID format',
    });
  }

  if (error.name === 'ValidationError') {
    const errors = Object.values(error.errors).map((err) => err.message);
    return res.status(400).json({
      success: false,
      message: 'Validation error',
      errors,
    });
  }

  if (error.code === 11000) {
    return res.status(400).json({
      success: false,
      message: 'Duplicate key error. A record with this value already exists.',
    });
  }

  res.status(500).json({
    success: false,
    message: customMessage,
    ...(process.env.NODE_ENV === 'development' && { stack: error.stack }),
  });
};

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
      isUpcoming,
    } = req.body;

    // Basic required fields
    if (!title || !price || !description || !category || !duration) {
      return res.status(400).json({
        success: false,
        message:
          'Title, price, description, category, and duration are required fields',
      });
    }

    // Parse features
    let featuresArray = [];
    if (features) {
      if (Array.isArray(features)) {
        featuresArray = features;
      } else if (typeof features === 'string') {
        try {
          const parsed = JSON.parse(features);
          featuresArray = Array.isArray(parsed) ? parsed : [];
        } catch (error) {
          featuresArray = features
            .split(',')
            .map((feature) => feature.trim())
            .filter(Boolean);
        }
      }

      if (!Array.isArray(featuresArray)) {
        featuresArray = [];
      }

      if (featuresArray.some((feature) => !feature?.trim())) {
        return res.status(400).json({
          success: false,
          message: 'Features cannot contain empty values',
        });
      }
    }

    // Validate dates
    let finalEnrollmentStart = null;
    let finalEnrollmentEnd = null;
    let finalCourseStart = null;
    let finalStatus = status || COURSE_STATUS.PENDING;
    let finalIsUpcoming = isUpcoming === true || isUpcoming === 'true';

    if (finalIsUpcoming) {
      // For upcoming courses, dates are optional
      finalEnrollmentStart = enrollmentStart ? new Date(enrollmentStart) : null;
      finalEnrollmentEnd = enrollmentEnd ? new Date(enrollmentEnd) : null;
      finalCourseStart = courseStart ? new Date(courseStart) : null;
    } else if (enrollmentStart && enrollmentEnd && courseStart) {
      // All dates provided - validate them
      finalEnrollmentStart = new Date(enrollmentStart);
      finalEnrollmentEnd = new Date(enrollmentEnd);
      finalCourseStart = new Date(courseStart);

      // Check if dates are valid
      if (
        isNaN(finalEnrollmentStart.getTime()) ||
        isNaN(finalEnrollmentEnd.getTime()) ||
        isNaN(finalCourseStart.getTime())
      ) {
        return res.status(400).json({
          success: false,
          message: 'Invalid date format',
        });
      }

      if (finalEnrollmentStart > finalEnrollmentEnd) {
        return res.status(400).json({
          success: false,
          message: 'Enrollment end date must be after or equal to start date',
        });
      }

      if (finalEnrollmentEnd > finalCourseStart) {
        return res.status(400).json({
          success: false,
          message: 'Course must start on or after enrollment ends',
        });
      }

      finalIsUpcoming = false;
    } else {
      return res.status(400).json({
        success: false,
        message:
          'Regular courses require all dates (enrollmentStart, enrollmentEnd, courseStart)',
      });
    }

    if (duration <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Duration must be a positive number',
      });
    }

    // Validate teachers
    let teachersArray = [];
    if (teachers) {
      teachersArray = Array.isArray(teachers)
        ? teachers
        : [teachers].filter(Boolean);

      if (teachersArray.length > 0) {
        const existingTeachers = await User.find({
          _id: { $in: teachersArray },
          role: { $in: ['teacher', 'admin'] },
        }).select('_id');

        if (existingTeachers.length !== teachersArray.length) {
          return res.status(400).json({
            success: false,
            message:
              'One or more selected teachers do not exist or are not teachers',
          });
        }
      }
    }

    // Validate category
    const existingCategory = await CourseCategory.findById(category);
    if (!existingCategory) {
      return res.status(400).json({
        success: false,
        message: 'Selected category does not exist',
      });
    }

    // Handle thumbnail upload
    let thumbnailUrl = null;
    let thumbnailPublicId = null;

    if (req.file) {
      const allowedMimeTypes = [
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/webp',
      ];
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

    // Create course
    const newCourse = await Course.create({
      title: title.trim(),
      price: parseFloat(price),
      description: description.trim(),
      category,
      features: featuresArray,
      teachers: teachersArray,
      enrollmentStart: finalEnrollmentStart,
      enrollmentEnd: finalEnrollmentEnd,
      courseStart: finalCourseStart,
      duration: parseInt(duration),
      status: finalStatus,
      isUpcoming: finalIsUpcoming,
      featured: featured === 'true' || featured === true,
      thumbnail: thumbnailUrl,
      thumbnailPublicId: thumbnailPublicId,
      averageRating: 0,
      ratingCount: 0,
      reviews: [],
      lectures: [],
      coupons: [],
    });

    const populatedCourse = await Course.findById(newCourse._id)
      .populate('category', 'name')
      .populate('teachers', 'name email')
      .select('-thumbnailPublicId');

    const formattedCourse = formatCourseResponse(populatedCourse);

    res.status(201).json({
      success: true,
      message: 'Course created successfully',
      data: formattedCourse,
    });
  } catch (error) {
    handleError(res, error, 'Course creation failed');
  }
};

export const addCourseCategory = async (req, res) => {
  try {
    const { name } = req.body;

    if (!name?.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Category name is required',
      });
    }

    const existing = await CourseCategory.findOne({ name: name.trim() });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'Category already exists',
      });
    }

    const category = await CourseCategory.create({ name: name.trim() });

    res.status(201).json({
      success: true,
      message: 'Category added successfully',
      data: category,
    });
  } catch (error) {
    handleError(res, error, 'Failed to create category');
  }
};

export const getCourseCategory = async (req, res) => {
  try {
    const categories = await CourseCategory.find().sort({ name: 1 });

    res.status(200).json({
      success: true,
      count: categories.length,
      data: categories,
    });
  } catch (error) {
    handleError(res, error, 'Failed to get categories');
  }
};

export const getPublishCourses = async (req, res) => {
  try {
    const { status, upcoming } = req.query;
    const now = new Date();

    let query = { status: 'published' };

    // Filter by upcoming
    if (upcoming === 'true') {
      query.isUpcoming = true;
    } else if (upcoming === 'false') {
      query.isUpcoming = false;
    }

    // Filter by dynamic status
    if (status) {
      switch (status) {
        case COURSE_STATUS.ENROLLMENT_OPEN:
          query = {
            ...query,
            isUpcoming: false,
            enrollmentStart: { $lte: now, $ne: null },
            enrollmentEnd: { $gte: now, $ne: null },
            courseStart: { $ne: null },
          };
          break;
        case COURSE_STATUS.UPCOMING:
          query = {
            ...query,
            isUpcoming: false,
            enrollmentStart: { $gt: now, $ne: null },
            enrollmentEnd: { $ne: null },
            courseStart: { $ne: null },
          };
          break;
        case COURSE_STATUS.ENROLLMENT_CLOSED:
          query = {
            ...query,
            isUpcoming: false,
            enrollmentEnd: { $lt: now, $ne: null },
            courseStart: { $gt: now, $ne: null },
          };
          break;
        case COURSE_STATUS.COURSE_STARTED:
          query = {
            ...query,
            isUpcoming: false,
            courseStart: { $lte: now, $ne: null },
          };
          break;
        case COURSE_STATUS.COMING_SOON:
          query = {
            ...query,
            isUpcoming: true,
          };
          break;
      }
    }

    const publishCourse = await Course.find(query)
      .sort({ createdAt: -1 })
      .populate('category', 'name')
      .populate('teachers', 'name role avatar')
      .select(
        'title thumbnail price category description duration enrollmentStart enrollmentEnd courseStart averageRating ratingCount currentStatus lectures teachers status featured isComingSoon'
      );

    // Format each course with status info
    const formattedCourses = publishCourse.map((course) =>
      formatCourseResponse(course)
    );

    res.status(200).json({
      success: true,
      count: formattedCourses.length,
      data: formattedCourses,
    });
  } catch (error) {
    handleError(res, error, 'Failed to fetch published courses');
  }
};

export const getFeaturedCourses = async (req, res) => {
  try {
    const featuredCourses = await Course.find({
      featured: true,
      status: 'published',
    })
      .sort({ createdAt: -1 })
      .populate('category', 'name')
      .populate('teachers', 'name role avatar')
      .select(
        'title thumbnail price category description duration enrollmentStart enrollmentEnd courseStart averageRating lectures teachers ratingCount status isUpcoming'
      );

    const formattedCourses = featuredCourses.map((course) =>
      formatCourseResponse(course)
    );

    res.status(200).json({
      success: true,
      count: formattedCourses.length,
      data: formattedCourses,
    });
  } catch (error) {
    handleError(res, error, 'Failed to fetch featured courses');
  }
};

export const getCourseDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const course = await Course.findById(id)
      .populate('category', 'name')
      .populate('lectures', 'title duration')
      .populate('teachers', 'name role bio avatar')
      .populate({
        path: 'reviews',
        populate: { path: 'user', select: 'name avatar' },
      })
      .select(
        'averageRating category courseStart description duration enrollmentEnd enrollmentStart featured features lectures price ratingCount status studentCount teachers thumbnail title isUpcoming'
      );

    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found',
      });
    }

    const formattedCourse = formatCourseResponse(course);

    res.status(200).json({
      success: true,
      data: formattedCourse,
    });
  } catch (error) {
    handleError(res, error, 'Failed to fetch course details');
  }
};

export const getCourses = async (req, res) => {
  try {
    const { status, featured, upcoming } = req.query;

    let query = {};

    // Filter by status
    if (status) {
      query.status = status;
    }

    // Filter by featured
    if (featured === 'true') {
      query.featured = true;
    }

    // Filter by upcoming
    if (upcoming === 'true') {
      query.isUpcoming = true;
    } else if (upcoming === 'false') {
      query.isUpcoming = false;
    }

    const courses = await Course.find(query)
      .populate('teachers', 'name email role')
      .populate('category', 'name')
      .select(
        'title thumbnail price category description features teachers enrollmentStart enrollmentEnd courseStart duration averageRating ratingCount lectures status featured createdAt studentCount isUpcoming'
      );

    // Format courses with additional status info
    const modifiedCourses = courses.map((course) => {
      const formattedCourse = formatCourseResponse(course);
      return {
        ...formattedCourse,
        lectureCount: course.lectures?.length || 0,
        lectures: undefined,
      };
    });

    res.status(200).json({
      success: true,
      count: modifiedCourses.length,
      data: modifiedCourses,
    });
  } catch (error) {
    handleError(res, error, 'Failed to fetch courses');
  }
};

export const getCourseById = async (req, res) => {
  try {
    const course = await Course.findById(req.params.id)
      .populate('teachers', 'name email role')
      .populate('lectures', 'title videoUrl resources duration')
      .populate('category', 'name');

    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found',
      });
    }

    const formattedCourse = formatCourseResponse(course);
    const modifiedCourse = {
      ...formattedCourse,
      lectureCount: course.lectures?.length || 0,
    };

    res.status(200).json({
      success: true,
      data: modifiedCourse,
    });
  } catch (error) {
    handleError(res, error, 'Failed to fetch course');
  }
};

export const getCourseWithLectures = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    const enrollment = await Enrollment.findOne({
      student: userId,
      course: id,
      paymentStatus: 'completed',
    });

    if (!enrollment) {
      return res.status(403).json({
        success: false,
        message: 'You must enroll in this course to access lectures',
      });
    }

    const course = await Course.findById(id)
      .populate('lectures', 'title videoUrl duration resources')
      .populate('teachers', 'name email');

    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found',
      });
    }

    const formattedCourse = formatCourseResponse(course);

    res.status(200).json({
      success: true,
      data: formattedCourse,
    });
  } catch (error) {
    handleError(res, error, 'Failed to fetch course lectures');
  }
};

export const updateCourse = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if user is authorized (admin or teacher of this course)
    if (req.user.role !== 'admin') {
      const course = await Course.findById(id).select('teachers');
      if (!course) {
        return res.status(404).json({
          success: false,
          message: 'Course not found',
        });
      }

      const isTeacherOfCourse = course.teachers.some(
        (tId) => tId.toString() === req.user._id.toString()
      );

      if (!isTeacherOfCourse) {
        return res.status(403).json({
          success: false,
          message: 'You are not authorized to update this course',
        });
      }
    }

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
      isUpcoming,
    } = req.body;

    const existingCourse = await Course.findById(id);
    if (!existingCourse) {
      return res.status(404).json({
        success: false,
        message: 'Course not found',
      });
    }

    // Basic validations
    if (title && !title.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Course title cannot be empty',
      });
    }

    if (price && isNaN(price)) {
      return res.status(400).json({
        success: false,
        message: 'Valid price is required',
      });
    }

    if (description && !description.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Course description cannot be empty',
      });
    }

    // Parse features if provided
    let featuresArray = existingCourse.features;
    if (features !== undefined) {
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

      if (featuresArray.some((feature) => !feature?.trim())) {
        return res.status(400).json({
          success: false,
          message: 'Features cannot contain empty values',
        });
      }
    }

    // Handle dates
    let finalEnrollmentStart = existingCourse.enrollmentStart;
    let finalEnrollmentEnd = existingCourse.enrollmentEnd;
    let finalCourseStart = existingCourse.courseStart;
    let finalStatus = status || existingCourse.status;
    let finalIsUpcoming =
      isUpcoming !== undefined
        ? isUpcoming === true || isUpcoming === 'true'
        : existingCourse.isUpcoming;

    const isUpdatingDates =
      enrollmentStart !== undefined ||
      enrollmentEnd !== undefined ||
      courseStart !== undefined;

    if (isUpdatingDates) {
      finalEnrollmentStart = enrollmentStart
        ? new Date(enrollmentStart)
        : existingCourse.enrollmentStart;
      finalEnrollmentEnd = enrollmentEnd
        ? new Date(enrollmentEnd)
        : existingCourse.enrollmentEnd;
      finalCourseStart = courseStart
        ? new Date(courseStart)
        : existingCourse.courseStart;

      // Validate dates if all are provided
      if (finalEnrollmentStart && finalEnrollmentEnd && finalCourseStart) {
        if (finalEnrollmentStart > finalEnrollmentEnd) {
          return res.status(400).json({
            success: false,
            message: 'Enrollment end date must be after or equal to start date',
          });
        }

        if (finalEnrollmentEnd > finalCourseStart) {
          return res.status(400).json({
            success: false,
            message: 'Course must start on or after enrollment ends',
          });
        }
      }
    }

    // Validate duration
    if (duration && (isNaN(duration) || parseInt(duration) <= 0)) {
      return res.status(400).json({
        success: false,
        message: 'Valid duration is required (positive number)',
      });
    }

    // Handle teachers
    let teachersArray = existingCourse.teachers;
    if (teachers !== undefined) {
      teachersArray = Array.isArray(teachers)
        ? teachers
        : [teachers].filter(Boolean);
      teachersArray = [...new Set(teachersArray)];

      if (teachersArray.length > 0) {
        const existingTeachers = await User.find({
          _id: { $in: teachersArray },
        }).select('_id');

        if (existingTeachers.length !== teachersArray.length) {
          return res.status(400).json({
            success: false,
            message: 'One or more selected teachers do not exist',
          });
        }
      }
    }

    // Validate category if provided
    if (category) {
      const existingCategory = await CourseCategory.findById(category);
      if (!existingCategory) {
        return res.status(400).json({
          success: false,
          message: 'Selected category does not exist',
        });
      }
    }

    // Handle thumbnail
    let thumbnailUrl = existingCourse.thumbnail;
    let thumbnailPublicId = existingCourse.thumbnailPublicId;

    if (req.file) {
      const allowedMimeTypes = [
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/webp',
      ];
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
        // Delete old thumbnail if exists
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
        return res.status(500).json({
          success: false,
          message: 'Error uploading thumbnail image',
        });
      }
    }

    // Prepare update data
    const updateData = {
      ...(title && { title: title.trim() }),
      ...(price && { price: parseFloat(price) }),
      ...(description && { description: description.trim() }),
      ...(category && { category }),
      ...(features !== undefined && { features: featuresArray }),
      ...(teachers !== undefined && { teachers: teachersArray }),
      enrollmentStart: finalEnrollmentStart,
      enrollmentEnd: finalEnrollmentEnd,
      courseStart: finalCourseStart,
      ...(duration && { duration: parseInt(duration) }),
      status: finalStatus,
      isUpcoming: finalIsUpcoming,
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

    const formattedCourse = formatCourseResponse(populatedCourse);

    res.status(200).json({
      success: true,
      message: 'Course updated successfully',
      data: formattedCourse,
    });
  } catch (error) {
    handleError(res, error, 'Course update failed');
  }
};

export const deleteCourseCategory = async (req, res) => {
  try {
    // Only admin can delete categories
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only admin can delete categories',
      });
    }

    const { id } = req.params;

    // Check if category is being used by any course
    const coursesUsingCategory = await Course.countDocuments({ category: id });
    if (coursesUsingCategory > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete category that is being used by courses',
      });
    }

    const category = await CourseCategory.findByIdAndDelete(id);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Category deleted successfully',
    });
  } catch (error) {
    handleError(res, error, 'Failed to delete category');
  }
};

export const deleteCourse = async (req, res) => {
  try {
    // Only admin can delete courses
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only admin can delete courses',
      });
    }

    const course = await Course.findById(req.params.id);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found',
      });
    }

    // Check if there are any enrollments
    const enrollmentsCount = await Enrollment.countDocuments({
      course: course._id,
      paymentStatus: 'completed',
    });

    if (enrollmentsCount > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete course with active enrollments',
      });
    }

    // Delete related lectures and their resources
    for (const lectureId of course.lectures) {
      const lecture = await Lecture.findById(lectureId);
      if (lecture) {
        // Delete lecture resources from Cloudinary
        for (const resource of lecture.resources) {
          if (resource.publicId) {
            await cloudinary.uploader.destroy(resource.publicId);
          }
        }
        await Lecture.findByIdAndDelete(lectureId);
      }
    }

    // Delete related coupons
    await Coupon.deleteMany({ _id: { $in: course.coupons } });

    // Delete course thumbnail from Cloudinary
    if (course.thumbnailPublicId) {
      await cloudinary.uploader.destroy(course.thumbnailPublicId);
    }

    // Delete the course
    await Course.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: 'Course deleted successfully',
    });
  } catch (error) {
    handleError(res, error, 'Failed to delete course');
  }
};

export const getTeacherCourses = async (req, res) => {
  try {
    const courses = await Course.find({
      teachers: req.user._id,
    })
      .populate('category', 'name')
      .populate('teachers', 'name email')
      .sort({ createdAt: -1 });

    const formattedCourses = courses.map((course) =>
      formatCourseResponse(course)
    );

    res.status(200).json({
      success: true,
      count: formattedCourses.length,
      data: formattedCourses,
    });
  } catch (error) {
    handleError(res, error, 'Failed to fetch teacher courses');
  }
};

export const getTeacherCourseDetails = async (req, res) => {
  try {
    const course = await Course.findById(req.params.id)
      .populate('teachers', 'name email role')
      .populate('lectures', 'title videoUrl resources duration')
      .populate('category', 'name');

    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found',
      });
    }

    // Check if teacher has access to this course
    const isTeacherOfCourse = course.teachers.some(
      (tId) => tId._id.toString() === req.user._id.toString()
    );

    if (req.user.role !== 'admin' && !isTeacherOfCourse) {
      return res.status(403).json({
        success: false,
        message: 'You do not have access to this course',
      });
    }

    const formattedCourse = formatCourseResponse(course);
    const modifiedCourse = {
      ...formattedCourse,
      lectureCount: course.lectures?.length || 0,
    };

    res.status(200).json({
      success: true,
      data: modifiedCourse,
    });
  } catch (error) {
    handleError(res, error, 'Failed to fetch course details');
  }
};

export const getCoursesByStatus = async (req, res) => {
  try {
    const { status } = req.query;
    const now = new Date();

    let query = { status: 'published' };

    switch (status) {
      case COURSE_STATUS.COMING_SOON:
        query.isUpcoming = true;
        break;

      case COURSE_STATUS.ENROLLMENT_OPEN:
        query = {
          ...query,
          isUpcoming: false,
          enrollmentStart: { $lte: now, $ne: null },
          enrollmentEnd: { $gte: now, $ne: null },
          courseStart: { $ne: null },
        };
        break;

      case COURSE_STATUS.UPCOMING:
        query = {
          ...query,
          isUpcoming: false,
          enrollmentStart: { $gt: now, $ne: null },
          enrollmentEnd: { $ne: null },
          courseStart: { $ne: null },
        };
        break;

      case COURSE_STATUS.ENROLLMENT_CLOSED:
        query = {
          ...query,
          isUpcoming: false,
          enrollmentEnd: { $lt: now, $ne: null },
          courseStart: { $gt: now, $ne: null },
        };
        break;

      case COURSE_STATUS.COURSE_STARTED:
        query = {
          ...query,
          isUpcoming: false,
          courseStart: { $lte: now, $ne: null },
        };
        break;
    }

    const courses = await Course.find(query)
      .populate('category', 'name')
      .populate('teachers', 'name role avatar')
      .sort({ createdAt: -1 });

    const formattedCourses = courses.map((course) =>
      formatCourseResponse(course)
    );

    res.status(200).json({
      success: true,
      count: formattedCourses.length,
      data: formattedCourses,
    });
  } catch (error) {
    handleError(res, error, 'Failed to fetch courses by status');
  }
};

// ------------------- Lecture -------------------

export const createLecture = async (req, res) => {
  try {
    const { title, courseId, videoUrl, duration } = req.body;
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

    // Check if course exists and user has permission
    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found',
      });
    }

    // Check permission
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

    // Upload resource files to Cloudinary
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
          fileType: resourceFile.mimetype,
          fileSize: resourceFile.size,
        });
      } catch (uploadError) {
        console.error('Resource upload error:', uploadError);
      }
    }

    // Create lecture
    const lecture = await Lecture.create({
      title: title.trim(),
      videoUrl: videoUrl?.trim(),
      course: courseId,
      resources,
      duration: duration || 0,
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
      data: populatedLecture,
    });
  } catch (error) {
    handleError(res, error, 'Failed to create lecture');
  }
};

export const getLecturesByCourse = async (req, res) => {
  try {
    const { courseId } = req.params;

    const lectures = await Lecture.find({ course: courseId })
      .sort({ createdAt: 1 })
      .select('-resources.publicId'); // Don't send publicId to client

    res.status(200).json({
      success: true,
      count: lectures.length,
      data: lectures,
    });
  } catch (error) {
    handleError(res, error, 'Failed to fetch lectures');
  }
};

export const updateLecture = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, videoUrl, duration } = req.body;
    const resourceFiles = req.files?.resources || [];

    const lecture = await Lecture.findById(id);
    if (!lecture) {
      return res.status(404).json({
        success: false,
        message: 'Lecture not found',
      });
    }

    // Check permission
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

    // Update fields
    if (title?.trim()) {
      lecture.title = title.trim();
    }

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

    if (duration !== undefined) {
      lecture.duration = parseInt(duration) || 0;
    }

    // Upload new resources
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
          fileType: resourceFile.mimetype,
          fileSize: resourceFile.size,
        });
      } catch (err) {
        console.error('Resource upload error:', err);
      }
    }

    await lecture.save();

    const updatedLecture = await Lecture.findById(id)
      .populate('course', 'title')
      .select('-resources.publicId');

    res.status(200).json({
      success: true,
      message: 'Lecture updated successfully',
      data: updatedLecture,
    });
  } catch (error) {
    handleError(res, error, 'Failed to update lecture');
  }
};

export const getLecture = async (req, res) => {
  try {
    const { id } = req.params;

    const lecture = await Lecture.findById(id)
      .populate('course', 'title')
      .select('-resources.publicId');

    if (!lecture) {
      return res.status(404).json({
        success: false,
        message: 'Lecture not found',
      });
    }

    res.status(200).json({
      success: true,
      data: lecture,
    });
  } catch (error) {
    handleError(res, error, 'Failed to fetch lecture');
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

    // Check permission
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
    handleError(res, error, 'Failed to delete lecture');
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

    // Check permission
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

    // Delete resource file from Cloudinary
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
    handleError(res, error, 'Failed to delete resource');
  }
};

// ------------------- Coupon -------------------

export const addCouponToCourse = async (req, res) => {
  try {
    const { id } = req.params; // courseId

    // Check if course exists
    const course = await Course.findById(id);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found',
      });
    }

    // Check permission
    if (req.user.role === 'teacher') {
      const isTeacherOfCourse = course.teachers.some(
        (tId) => tId.toString() === req.user._id.toString()
      );
      if (!isTeacherOfCourse) {
        return res.status(403).json({
          success: false,
          message: 'You are not allowed to add coupons to this course',
        });
      }
    }

    // Check if coupon code already exists
    const existingCoupon = await Coupon.findOne({
      code: req.body.code,
      course: id,
    });

    if (existingCoupon) {
      return res.status(400).json({
        success: false,
        message: 'Coupon code already exists for this course',
      });
    }

    const coupon = new Coupon({
      ...req.body,
      course: id,
      createdAt: new Date(),
    });

    await coupon.save();

    await Course.findByIdAndUpdate(id, {
      $push: { coupons: coupon._id },
    });

    res.status(201).json({
      success: true,
      message: 'Coupon added successfully',
      data: coupon,
    });
  } catch (error) {
    handleError(res, error, 'Failed to add coupon');
  }
};

export const updateCoupon = async (req, res) => {
  try {
    const coupon = await Coupon.findById(req.params.couponId).populate(
      'course'
    );

    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: 'Coupon not found',
      });
    }

    // Check permission
    if (req.user.role === 'teacher') {
      const isTeacherOfCourse = coupon.course.teachers.some(
        (tId) => tId.toString() === req.user._id.toString()
      );
      if (!isTeacherOfCourse) {
        return res.status(403).json({
          success: false,
          message: 'You are not allowed to update this coupon',
        });
      }
    }

    // Check if updating code and if it already exists
    if (req.body.code && req.body.code !== coupon.code) {
      const existingCoupon = await Coupon.findOne({
        code: req.body.code,
        course: coupon.course._id,
        _id: { $ne: coupon._id },
      });

      if (existingCoupon) {
        return res.status(400).json({
          success: false,
          message: 'Coupon code already exists for this course',
        });
      }
    }

    const updatedCoupon = await Coupon.findByIdAndUpdate(
      req.params.couponId,
      req.body,
      { new: true, runValidators: true }
    );

    res.json({
      success: true,
      message: 'Coupon updated successfully',
      data: updatedCoupon,
    });
  } catch (error) {
    handleError(res, error, 'Failed to update coupon');
  }
};

export const deleteCoupon = async (req, res) => {
  try {
    const coupon = await Coupon.findById(req.params.couponId).populate(
      'course'
    );

    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: 'Coupon not found',
      });
    }

    // Check permission
    if (req.user.role === 'teacher') {
      const isTeacherOfCourse = coupon.course.teachers.some(
        (tId) => tId.toString() === req.user._id.toString()
      );
      if (!isTeacherOfCourse) {
        return res.status(403).json({
          success: false,
          message: 'You are not allowed to delete this coupon',
        });
      }
    }

    // Remove coupon from course
    await Course.findByIdAndUpdate(coupon.course._id, {
      $pull: { coupons: coupon._id },
    });

    // Delete coupon
    await Coupon.findByIdAndDelete(req.params.couponId);

    res.json({
      success: true,
      message: 'Coupon deleted successfully',
    });
  } catch (error) {
    handleError(res, error, 'Failed to delete coupon');
  }
};
