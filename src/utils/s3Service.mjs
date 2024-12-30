import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// Initialize S3 client
const s3Client = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
});

/**
 * Generates a signed URL for accessing a file in S3
 * @param {string} key - The S3 object key
 * @param {number} expiresIn - URL expiration time in seconds (default: 3600)
 * @returns {Promise<string>} Signed URL
 * @throws {Error} If URL generation fails
 */
export const getSignedFileUrl = async (key, expiresIn = 3600) => {
    if (!key) {
        throw new Error('File key is required');
    }

    try {
        const command = new GetObjectCommand({
            Bucket: process.env.AWS_BUCKET_NAME,
            Key: key
        });

        const signedUrl = await getSignedUrl(s3Client, command, {
            expiresIn
        });

        return signedUrl;
    } catch (error) {
        console.error('Error generating signed URL:', error);
        throw new Error(`Failed to generate signed URL: ${error.message}`);
    }
};

/**
 * Validates if a file key exists in S3
 * @param {string} key - The S3 object key
 * @returns {Promise<boolean>} Whether the file exists
 */
export const validateFileExists = async (key) => {
    if (!key) return false;

    try {
        const command = new GetObjectCommand({
            Bucket: process.env.AWS_S3_BUCKET,
            Key: key
        });
        
        await s3Client.send(command);
        return true;
    } catch (error) {
        console.error('Error validating file existence:', error);
        return false;
    }
};