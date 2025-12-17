import Course from '../models/Course.js';
import mongoose from 'mongoose';

export const addReview = async (req, res) => {
  try {
    const { courseId } = req.params;
    const { rating, comment } = req.body;
    const userId = req.user.id;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: 'Rating must be between 1 to 5'
      });
    }

    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Cannot get course'
      });
    }

    const existingReviewIndex = course.reviews.findIndex(
      review => review.user.toString() === userId
    );

    if (existingReviewIndex > -1) {
      return res.status(400).json({
        success: false,
        message: 'You have already review on this course'
      });
    }

    const newReview = {
      user: userId,
      rating,
      comment: comment || '',
      createdAt: new Date()
    };

    course.reviews.push(newReview);

    const totalReviews = course.reviews.length;
    const totalRating = course.reviews.reduce((sum, review) => sum + review.rating, 0);
    
    course.ratingCount = totalReviews;
    course.averageRating = totalRating / totalReviews;

    await course.save();

    const populatedCourse = await Course.findById(courseId)
      .populate('reviews.user', 'name email profileImage');

    const addedReview = populatedCourse.reviews[totalReviews - 1];

    res.status(201).json({
      success: true,
      message: 'Review is added successfully',
      data: {
        review: addedReview,
        courseRating: {
          averageRating: course.averageRating,
          ratingCount: course.ratingCount
        }
      }
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'server error',
      error: error.message
    });
  }
};

export const updateReview = async (req, res) => {
  try {
    const { courseId, reviewId } = req.params;
    const { rating, comment } = req.body;
    const userId = req.user.id;

    if (rating && (rating < 1 || rating > 5)) {
      return res.status(400).json({
        success: false,
        message: 'Rating must be on 1 to 5'
      });
    }

    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Cannot find course'
      });
    }

    const reviewIndex = course.reviews.findIndex(
      review => review._id.toString() === reviewId && review.user.toString() === userId
    );

    if (reviewIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Cannot get review or you cannot edit this review'
      });
    }

    if (rating !== undefined) {
      course.reviews[reviewIndex].rating = rating;
    }
    
    if (comment !== undefined) {
      course.reviews[reviewIndex].comment = comment;
    }

    const totalRating = course.reviews.reduce((sum, review) => sum + review.rating, 0);
    course.averageRating = totalRating / course.reviews.length;

    await course.save();

    const populatedCourse = await Course.findById(courseId)
      .populate('reviews.user', 'name email profileImage');

    res.status(200).json({
      success: true,
      message: 'Review updated successfully',
      data: {
        review: populatedCourse.reviews[reviewIndex],
        courseRating: {
          averageRating: course.averageRating,
          ratingCount: course.ratingCount
        }
      }
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'server error',
      error: error.message
    });
  }
};

export const deleteReview = async (req, res) => {
  try {
    const { courseId, reviewId } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role; // Assuming user role is available

    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Cannot get course'
      });
    }

    // Find the review
    const review = course.reviews.find(
      review => review._id.toString() === reviewId
    );

    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Cannot get review'
      });
    }

    // Check authorization
    const isReviewOwner = review.user.toString() === userId;
    const isAdmin = userRole === 'admin' || userRole === 'super-admin'; // Adjust roles as needed

    if (!isReviewOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to delete this review'
      });
    }

    // Find review index
    const reviewIndex = course.reviews.findIndex(
      review => review._id.toString() === reviewId
    );

    course.reviews.splice(reviewIndex, 1);

    if (course.reviews.length > 0) {
      const totalRating = course.reviews.reduce((sum, review) => sum + review.rating, 0);
      course.averageRating = totalRating / course.reviews.length;
      course.ratingCount = course.reviews.length;
    } else {
      course.averageRating = 0;
      course.ratingCount = 0;
    }

    await course.save();

    res.status(200).json({
      success: true,
      message: 'Review has been deleted successfully',
      data: {
        courseRating: {
          averageRating: course.averageRating,
          ratingCount: course.ratingCount
        },
        deletedBy: isAdmin ? 'admin' : 'user'
      }
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

export const getCourseReviews = async (req, res) => {
  try {
    const { courseId } = req.params;
    const { page = 1, limit = 10, sort = 'newest' } = req.query;

    const course = await Course.findById(courseId)
      .select('reviews averageRating ratingCount')
      .populate({
        path: 'reviews.user',
        select: 'name email avatar'
      });

    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Cannot get course'
      });
    }

    let sortedReviews = [...course.reviews];
    
    if (sort === 'newest') {
      sortedReviews.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    } else if (sort === 'oldest') {
      sortedReviews.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    } else if (sort === 'highest') {
      sortedReviews.sort((a, b) => b.rating - a.rating);
    } else if (sort === 'lowest') {
      sortedReviews.sort((a, b) => a.rating - b.rating);
    }

    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    
    const paginatedReviews = sortedReviews.slice(startIndex, endIndex);

    const ratingDistribution = {
      5: course.reviews.filter(r => r.rating === 5).length,
      4: course.reviews.filter(r => r.rating === 4).length,
      3: course.reviews.filter(r => r.rating === 3).length,
      2: course.reviews.filter(r => r.rating === 2).length,
      1: course.reviews.filter(r => r.rating === 1).length
    };

    res.status(200).json({
      success: true,
      data: {
        reviews: paginatedReviews,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(course.reviews.length / limit),
          totalReviews: course.reviews.length,
          hasNextPage: endIndex < course.reviews.length,
          hasPrevPage: startIndex > 0
        },
        summary: {
          averageRating: course.averageRating,
          ratingCount: course.ratingCount,
          ratingDistribution
        }
      }
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'server error',
      error: error.message
    });
  }
};

export const getUserReviewForCourse = async (req, res) => {
  try {
    const { courseId } = req.params;
    const userId = req.user.id;

    const course = await Course.findById(courseId)
      .populate('reviews.user', 'name email profileImage');

    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Cannot get course'
      });
    }

    const userReview = course.reviews.find(
      review => review.user._id.toString() === userId
    );

    res.status(200).json({
      success: true,
      data: {
        review: userReview || null,
        hasReviewed: !!userReview
      }
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Server Error',
      error: error.message
    });
  }
};