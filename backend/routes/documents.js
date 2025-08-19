const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { body, param, validationResult } = require('express-validator');
const DocumentController = require('../controllers/documentController');

const router = express.Router();
const documentController = new DocumentController();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads');
    await fs.mkdir(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `${req.user.id}-${uniqueSuffix}.pdf`);
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
router.get('/', documentController.getAllDocuments.bind(documentController));

router.post('/upload', 
  upload.single('pdf'), 
  documentController.uploadDocument.bind(documentController)
);

router.get('/:uuid', 
  validateUUID, 
  documentController.getDocumentById.bind(documentController)
);

router.get('/:uuid/file', 
  validateUUID, 
  documentController.serveDocumentFile.bind(documentController)
);

router.post('/:uuid/fields', 
  [...validateUUID, ...validateFieldData], 
  documentController.addField.bind(documentController)
);

router.delete('/:uuid/fields/:fieldId', 
  [...validateUUID, ...validateFieldId], 
  documentController.removeField.bind(documentController)
);

router.post('/:uuid/download', 
  validateUUID, 
  documentController.downloadSignedDocument.bind(documentController)
);

router.delete('/:uuid', 
  validateUUID, 
  documentController.deleteDocument.bind(documentController)
);

module.exports = router;
