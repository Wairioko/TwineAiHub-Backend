// utils/s3Config.js
import { S3Client } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import multer from 'multer';
import multerS3 from 'multer-s3';
import { FILE_CONSTANTS } from './constants.mjs';

class S3Service {
    constructor() {
        this.s3Client = new S3Client({
            region: process.env.AWS_REGION,
            credentials: {
                accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
            }
        });
        
        this.upload = this.configureMulter();
    }

    configureMulter() {
        return multer({
            storage: multerS3({
                s3: this.s3Client,
                bucket: process.env.AWS_BUCKET_NAME,
                acl: 'private',
                metadata: (req, file, cb) => {
                    cb(null, { 
                        fieldName: file.fieldname,
                        userId: req.user?._id?.toString()
                    });
                },
                key: (req, file, cb) => {
                    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
                    const sanitizedFilename = this.sanitizeFilename(file.originalname);
                    cb(null, `${FILE_CONSTANTS.UPLOAD_PATH}/${uniqueSuffix}-${sanitizedFilename}`);
                }
            }),
            fileFilter: this.fileFilter,
            limits: {
                fileSize: FILE_CONSTANTS.MAX_FILE_SIZE
            }
        });
    }

    fileFilter(req, file, cb) {
        if (!FILE_CONSTANTS.ALLOWED_TYPES.includes(file.mimetype)) {
            cb(new Error(`Invalid file type. Allowed types: ${FILE_CONSTANTS.ALLOWED_TYPES.join(', ')}`), false);
            return;
        }
        cb(null, true);
    }

    sanitizeFilename(filename) {
        return filename.replace(/[^a-zA-Z0-9.-]/g, '_');
    }

    async uploadFile(fileBuffer, key) {
        try {
            const upload = new Upload({
                client: this.s3Client,
                params: {
                    Bucket: process.env.AWS_BUCKET_NAME,
                    Key: key,
                    Body: fileBuffer
                }
            });

            return await upload.done();
        } catch (error) {
            console.error('Error uploading to S3:', error);
            throw new Error('Failed to upload file to storage');
        }
    }

    async getFile(key) {
        try {
            const { GetObjectCommand } = await import('@aws-sdk/client-s3');
            const command = new GetObjectCommand({
                Bucket: process.env.AWS_BUCKET_NAME,
                Key: key
            });
            const response = await this.s3Client.send(command);
            return response;
        } catch (error) {
            console.error('Error retrieving file from S3:', error);
            throw new Error('Failed to retrieve file from storage');
        }
    }

    async deleteFile(key) {
        try {
            const { DeleteObjectCommand } = await import('@aws-sdk/client-s3');
            const command = new DeleteObjectCommand({
                Bucket: process.env.AWS_BUCKET_NAME,
                Key: key
            });
            await this.s3Client.send(command);
        } catch (error) {
            console.error('Error deleting file from S3:', error);
            throw new Error('Failed to delete file from storage');
        }
    }
}

export const s3Service = new S3Service();
