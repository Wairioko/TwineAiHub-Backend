import { promisify } from 'util';
import pdf from 'pdf-parse';
import mammoth from 'mammoth';
import textract from 'textract';
import { FILE_CONSTANTS } from '../utils/constants.mjs';
import { s3Service } from './s3Config.mjs';
import xlsx from 'xlsx';

const textractFromBuffer = promisify(textract.fromBufferWithMime);

class FileProcessor {
    async validateFile(file) {
        if (!file) {
            throw new Error('No file provided');
        }

        if (!FILE_CONSTANTS.ALLOWED_TYPES.includes(file.mimetype)) {
            throw new Error(`Unsupported file type: ${file.mimetype}`);
        }

        if (file.size > FILE_CONSTANTS.MAX_FILE_SIZE) {
            throw new Error(`File size exceeds limit of ${FILE_CONSTANTS.MAX_FILE_SIZE / (1024 * 1024)}MB`);
        }
    }

    async extractText(fileBuffer, mimetype) {
        if (!fileBuffer) {
            throw new Error('No file buffer provided');
        }
    
        try {
            switch (mimetype) {
                case 'application/pdf':
                    const pdfData = await pdf(fileBuffer);
                    return pdfData.text;
    
                case 'text/plain':
                    return fileBuffer.toString('utf-8');
    
                case 'application/msword':
                case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
                    const result = await mammoth.extractRawText({ buffer: fileBuffer });
                    return result.value;
    
                case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
                case 'application/vnd.ms-excel':
                    const workbook = xlsx.read(fileBuffer, { type: 'buffer' });
                    let text = '';
                    workbook.SheetNames.forEach(sheetName => {
                        const worksheet = workbook.Sheets[sheetName];
                        text += xlsx.utils.sheet_to_csv(worksheet) + '\n';
                    });
                    return text;
    
                default:
                    // If the file type is supported, use textract
                    if (FILE_CONSTANTS.ALLOWED_TYPES.includes(mimetype)) {
                        try {
                            // Now textractFromBuffer is promisified and can be used with await
                            return await textractFromBuffer(fileBuffer, mimetype);
                        } catch (textractError) {
                            console.error(`Failed to extract text from file of type ${mimetype}:`, textractError);
                            throw new Error(`Failed to extract text using textract: ${textractError.message}`);
                        }
                    }
                    throw new Error(`Unsupported file type: ${mimetype}`);
            }
        } catch (error) {
            console.error('Error in extractText:', error);
            throw new Error(`File processing failed: ${error.message}`);
        }
    }
    
    async handleFileUpload(req) {
        const file = req.file;
    
        if (!file) {
            throw new Error("No file provided for upload");
        }
    
        try {
            // Validate the file (add your specific validation logic here)
            await this.validateFile(file);
    
            // Construct file metadata
            const fileData = {
                key: file.key,
                location: file.location,
                originalname: file.originalname,
                mimetype: file.mimetype,
                size: file.size,
            };
    
            // Extract file buffer, either from memory or via a fallback
            const fileBuffer = file.buffer || (await this.getFileBuffer(file));
            if (!fileBuffer) {
                throw new Error("Unable to retrieve file buffer for processing");
            }
    
            // Extract text content from the file
            const fileContent = await this.extractText(fileBuffer, file.mimetype);
    
            return { fileData, fileContent };
        } catch (error) {
            console.error("Error during file upload handling:", error.message);
    
            // Cleanup: delete the file from S3 if an error occurs
            if (file?.key) {
                try {
                    await s3Service.deleteFile(file.key);
                    console.info(`File with key ${file.key} deleted from S3`);
                } catch (deleteError) {
                    console.error("Failed to delete file from S3:", deleteError);
                }
            }
    
            throw error; // Re-throw the error after cleanup
        }
    }
    
    async getFileBuffer(fileData) {
        if (!fileData || !fileData.key) {
            throw new Error('No file key provided');
        }
    
        try {
            const fileResponse = await s3Service.getFile(fileData.key);
            return this.streamToBuffer(fileResponse.Body);
        } catch (error) {
            throw new Error(`Failed to retrieve file from storage: ${error.message}`);
        }
    }
    

    getMimeType(filename) {
        const extension = filename.split('.').pop().toLowerCase();
        const mimeTypes = {
            'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'xls': 'application/vnd.ms-excel',
            'doc': 'application/msword',
            'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'pdf': 'application/pdf',
            'txt': 'text/plain'
        };
        return mimeTypes[extension] || 'application/octet-stream';
    }

    async getFileContent(fileData) {
        if (!fileData) {
            throw new Error('No file data provided');
        }
    
        // If fileData is a string (just the key), convert it to an object
        if (typeof fileData === 'string') {
            const key = fileData;
            fileData = {
                key: key,
                mimetype: this.getMimeType(key), // Determine mime type from file extension
                originalname: key.split('/').pop()
            };
        }
    
        if (!fileData.key) {
            throw new Error('File key is missing');
        }
    
        if (!fileData.mimetype || fileData.mimetype === 'application/octet-stream') {
            fileData.mimetype = this.getMimeType(fileData.key);
        }
    
        // Retrieve the file buffer either from memory or S3
        const fileBuffer = fileData.buffer || await this.getFileBuffer(fileData);
        
        // Extract the file content as text based on MIME type
        return this.extractText(fileBuffer, fileData.mimetype);
    }

    
    async extractText(fileBuffer, mimetype) {
        if (!fileBuffer) {
            throw new Error('No file buffer provided');
        }
    
        try {
            switch (mimetype) {
                case 'application/pdf':
                    const pdfData = await pdf(fileBuffer);
                    return pdfData.text;
    
                case 'text/plain':
                    return fileBuffer.toString('utf-8');
    
                case 'application/msword':
                case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
                    const result = await mammoth.extractRawText({ buffer: fileBuffer });
                    return result.value;
    
                case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
                case 'application/vnd.ms-excel':
                    const workbook = xlsx.read(fileBuffer, { type: 'buffer' });
                    let text = '';
                    workbook.SheetNames.forEach(sheetName => {
                        const worksheet = workbook.Sheets[sheetName];
                        text += xlsx.utils.sheet_to_csv(worksheet) + '\n';
                    });
                    return text;
    
                default:
                    // If the file type is supported, use textract
                    if (FILE_CONSTANTS.ALLOWED_TYPES.includes(mimetype)) {
                        try {
                            // Ensure textract is using the promisified version
                            return await textractFromBuffer(fileBuffer, mimetype);
                        } catch (textractError) {
                            console.error(`Failed to extract text from file of type ${mimetype}:`, textractError);
                            throw new Error(`Failed to extract text using textract: ${textractError.message}`);
                        }
                    }
                    throw new Error(`Unsupported file type: ${mimetype}`);
            }
        } catch (error) {
            console.error('Error in extractText:', error);
            throw new Error(`File processing failed: ${error.message}`);
        }
    }
    
    async streamToBuffer(stream) {
        return new Promise((resolve, reject) => {
            const chunks = [];
            stream.on('data', chunk => chunks.push(chunk));
            stream.on('end', () => resolve(Buffer.concat(chunks)));
            stream.on('error', reject);
        });
    }
}

export const fileProcessor = new FileProcessor();

