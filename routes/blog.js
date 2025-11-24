const express = require('express');
const router = express.Router();
const { getBlogs, getBlog, createBlog, updateBlog, deleteBlog } = require('../controllers/blog');
const { protect, authorize } = require('../middleware/auth');

router.get('/', getBlogs);
router.get('/:slug', getBlog);
router.post('/', protect, authorize('ADMIN'), createBlog);
router.put('/:id', protect, authorize('ADMIN'), updateBlog);
router.delete('/:id', protect, authorize('ADMIN'), deleteBlog);

module.exports = router;

