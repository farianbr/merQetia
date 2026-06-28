const express = require('express');
const router = express.Router();
const {
  getChannels, getMessages, getMentionables, postMessage, streamChannelFile,
  scheduleMeeting, rescheduleMeeting, cancelMeeting,
} = require('../controllers/teamController');
const { protect } = require('../middlewares/authMiddleware');
const { authorize } = require('../middlewares/roleMiddleware');
const { upload, persistUploads } = require('../middlewares/upload');

// All team-chat routes are staff-only (admins + employees). Channel membership
// is enforced inside the service.
router.use(protect, authorize('admin', 'employee'));

router.get('/channels', getChannels);
router.get('/channels/:id/messages', getMessages);
router.get('/channels/:id/mentionables', getMentionables);
router.post('/channels/:id/messages', upload.array('files', 5), persistUploads((req) => `team/${req.params.id}`), postMessage);
router.get('/channels/:id/files/:filename', streamChannelFile);

router.post('/channels/:id/meetings', scheduleMeeting);
router.patch('/channels/:id/meetings/:messageId', rescheduleMeeting);
router.delete('/channels/:id/meetings/:messageId', cancelMeeting);

module.exports = router;
