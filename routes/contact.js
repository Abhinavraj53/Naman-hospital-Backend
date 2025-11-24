const express = require('express');
const router = express.Router();
const { createContact, getContacts, updateContact } = require('../controllers/contact');
const { protect, authorize } = require('../middleware/auth');

router.post('/', createContact);
router.get('/', protect, authorize('ADMIN'), getContacts);
router.patch('/:id', protect, authorize('ADMIN'), updateContact);

module.exports = router;

