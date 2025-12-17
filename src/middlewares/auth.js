import jwt from 'jsonwebtoken';
import User from '../models/User.js';

export const protect = async (req, res, next) => {
  try {
    const token = req.cookies.token;

    if (!token) {
      return res
        .status(401)
        .json({ message: 'Unauthorize - No Token Provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (!decoded) {
      return res.status(401).json({ message: 'Unauthorize - Invalid Token' });
    }

    const user = await User.findById(decoded.userId).select('-password');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    req.user = user;

    next();
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Allow only Teacher or Admin
export const teacherOrAdmin = (req, res, next) => {

  if (req.user && (req.user.role === 'teacher' || req.user.role === 'admin')) {
    return next();
  }
  return res.status(403).json({ error: 'Teacher or Admin access only' });
};

// Allow only Admin
export const adminOnly = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    return next();
  }
  return res.status(403).json({ error: 'Admin access only' });
};

// Allow only Verified User
export const verifiedOnly = (req, res, next) => {
  if (req.user && req.user.verified) {
    return next();
  }
  return res.status(403).json({ error: 'First verify your email' });
};
