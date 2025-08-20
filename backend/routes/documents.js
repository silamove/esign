const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { body, param, validationResult } = require('express-validator');
const documentController = require('../controllers/documentController');
const { authenticateFileAccess } = require('../middleware/fileAuth');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads');
    await fs.mkdir(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const originalNameWithoutExt = path.parse(file.originalname).name;
    cb(null, `${originalNameWithoutExt}-${uniqueSuffix}.pdf`);
  }
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'));
    }
  },
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit
  }
});

// Validation middleware
const validateUUID = [
  param('uuid').isUUID().withMessage('Invalid document UUID')
];

const validateFieldData = [
  body('fieldType').isIn(['signature', 'initials', 'text', 'date', 'checkbox']).withMessage('Invalid field type'),
  body('data').isObject().withMessage('Field data must be an object'),
  body('x').isNumeric().withMessage('X coordinate must be a number'),
  body('y').isNumeric().withMessage('Y coordinate must be a number'),
  body('width').isNumeric().withMessage('Width must be a number'),
  body('height').isNumeric().withMessage('Height must be a number'),
  body('page').isInt({ min: 0 }).withMessage('Page must be a non-negative integer')
];

const validateFieldId = [
  param('fieldId').isInt().withMessage('Invalid field ID')
];

// Routes using controller methods
router.get('/', (req, res, next) => documentController.getAllDocuments(req, res, next));

router.post('/upload', 
  upload.single('pdf'), 
  (req, res, next) => documentController.uploadDocument(req, res, next)
);

router.get('/:uuid', 
  validateUUID, 
  (req, res, next) => documentController.getDocument(req, res, next)
);

router.get('/:uuid/file', 
  validateUUID,
  authenticateFileAccess,
  (req, res, next) => documentController.serveFile(req, res, next)
);

router.post('/:uuid/fields', 
  [...validateUUID, ...validateFieldData], 
  (req, res, next) => documentController.addField(req, res, next)
);

router.get('/:uuid/fields', 
  validateUUID, 
  (req, res, next) => documentController.getFields(req, res, next)
);

router.delete('/:uuid/fields/:fieldId', 
  [...validateUUID, ...validateFieldId], 
  (req, res, next) => documentController.removeField(req, res, next)
);

router.post('/:uuid/download', 
  validateUUID, 
  (req, res, next) => documentController.downloadSignedPdf(req, res, next)
);

router.delete('/:uuid', 
  validateUUID, 
  (req, res, next) => documentController.deleteDocument(req, res, next)
);

router.post('/:uuid/view-url',
  validateUUID,
  (req, res, next) => documentController.generateViewUrl(req, res, next)
);

router.get('/view/:token',
  (req, res, next) => documentController.serveFileWithTempToken(req, res, next)
);

module.exports = router;
