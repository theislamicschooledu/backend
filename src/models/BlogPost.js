import mongoose from 'mongoose';
import slugify from 'slugify';

const blogSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    slug: { type: String, unique: true, index: true },
    previousSlugs: [{ type: String }],
    cover: String,
    coverPublicId: String,
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'BlogCategory',
      required: true,
    },
    featured: { type: Boolean, default: false },
    content: { type: String, required: true },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'published', 'rejected'],
      default: 'pending',
    },
  },
  { timestamps: true }
);

// Function to generate unique slug
async function generateUniqueSlug(model, title, docId = null) {
  let baseSlug = slugify(title, { lower: true, strict: true });
  let slug = baseSlug;
  let counter = 1;

  while (
    await model.findOne({
      slug,
      _id: { $ne: docId },
    })
  ) {
    slug = `${baseSlug}-${counter}`;
    counter++;
  }

  return slug;
}

// For new save
blogSchema.pre('save', async function (next) {
  if (this.isModified('title') || this.isNew) {
    const newSlug = await generateUniqueSlug(
      mongoose.models.BlogPost,
      this.title,
      this._id
    );

    if (this.slug && this.slug !== newSlug) {
      this.previousSlugs.push(this.slug);
    }

    this.slug = newSlug;
  }
  next();
});

// For updates
blogSchema.pre('findOneAndUpdate', async function (next) {
  const update = this.getUpdate();

  if (update.title) {
    const docId = this.getQuery()._id;
    const newSlug = await generateUniqueSlug(
      mongoose.models.BlogPost,
      update.title,
      docId
    );

    const doc = await mongoose.models.BlogPost.findById(docId);

    if (doc && doc.slug !== newSlug) {
      update.$push = update.$push || {};
      update.$push.previousSlugs = doc.slug;
      update.slug = newSlug;
    }
  }

  next();
});

export default mongoose.model('BlogPost', blogSchema);
