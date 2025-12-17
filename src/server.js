import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
import cookieParser from 'cookie-parser';
import cors from 'cors';
import { connectDB } from './config/db.js';
import authRouter from './routes/authRoutes.js';
import adminRouter from './routes/adminRoutes.js';
import blogRouter from './routes/blogRoutes.js';
import questionRouter from './routes/questionRoutes.js';
import courseRouter from './routes/courseRoutes.js';
import enrollmentRouter from './routes/enrollmentRoutes.js';
import couponRouter from './routes/couponRoutes.js';
import paymentRouter from './routes/paymentRoutes.js';
import documentationRouter from './routes/documentationRoutes.js';

const app = express();

app.use(
  cors({
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

app.use('/api/auth', authRouter);
app.use('/api/admin', adminRouter);
app.use('/api/blogs', blogRouter);
app.use('/api/qna', questionRouter);
app.use('/api/courses', courseRouter);
app.use('/api/coupons', couponRouter);
app.use('/api/enrollment', enrollmentRouter);
app.use('/api/payments', paymentRouter);
app.use('/api/documentation', documentationRouter);

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await connectDB();
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to connect DB:', error.message);
    process.exit(1);
  }
};

startServer();
