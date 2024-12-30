// utils/fileUpload.mjs
import multer from 'multer';
import multerS3 from 'multer-s3';
import { s3Client } from './s3Config.mjs';
import { FILE_CONSTANTS } from '../constants/fileConstants.mjs';
import path from 'path';
import crypto from 'crypto';


// File filter function to validate file types
const fileFilter = (req, file, cb) => {
    if (!FILE_CONSTANTS.ALLOWED_TYPES.includes(file.mimetype)) {
        return cb(new Error(`File type ${file.mimetype} is not supported. Supported types: ${FILE_CONSTANTS.ALLOWED_TYPES.join(', ')}`), false);
    }

    if (file.size > FILE_CONSTANTS.MAX_FILE_SIZE) {
        return cb(new Error(`File size exceeds ${FILE_CONSTANTS.MAX_FILE_SIZE / (1024 * 1024)}MB limit`), false);
    }

    cb(null, true);
};

// Generate unique filename
const generateFileName = (file) => {
    const fileExtension = path.extname(file.originalname);
    const randomName = crypto.randomBytes(16).toString('hex');
    return `${randomName}${fileExtension}`;
};

// Configure S3 storage
const s3Storage = multerS3({
    s3: s3Client,
    bucket: process.env.AWS_BUCKET_NAME,
    metadata: (req, file, cb) => {
        cb(null, { fieldName: file.fieldname });
    },
    key: (req, file, cb) => {
        const fileName = generateFileName(file);
        const filePath = `${FILE_CONSTANTS.UPLOAD_PATH}/${fileName}`;
        cb(null, filePath);
    }
});


// Create multer instances for different scenarios
const createMulterInstance = (storage) => {
    return multer({
        storage: storage,
        fileFilter: fileFilter,
        limits: {
            fileSize: FILE_CONSTANTS.MAX_FILE_SIZE
        }
    });
};

// Export different upload configurations
export const uploadToS3 = createMulterInstance(s3Storage);

// Single file upload middlewares
export const singleFileUploadS3 = uploadToS3.single('file');

// Multiple files upload middlewares (if needed)
export const multipleFilesUploadS3 = uploadToS3.array('files', 5); // max 5 files


// Error handling middleware for multer
export const handleMulterError = (err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
                message: `File size exceeds ${FILE_CONSTANTS.MAX_FILE_SIZE / (1024 * 1024)}MB limit`
            });
        }
        return res.status(400).json({ message: err.message });
    }
    
    if (err) {
        return res.status(400).json({ message: err.message });
    }
    
    next();
};

