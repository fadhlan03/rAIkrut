import { Storage, StorageOptions, GetSignedUrlConfig } from '@google-cloud/storage';
import { Readable } from 'stream';
import * as path from 'path'; // Import path for potential content type detection

// --- Google Cloud Storage Configuration ---

let storageOptions: StorageOptions = {};

// Check for Base64 encoded key in environment variables (for Vercel/serverless)
if (process.env.GCP_SERVICE_ACCOUNT_KEY_BASE64) {
  try {
    const keyFileContent = Buffer.from(process.env.GCP_SERVICE_ACCOUNT_KEY_BASE64, 'base64').toString('utf-8');
    const credentials = JSON.parse(keyFileContent);
    storageOptions = {
      projectId: credentials.project_id,
      credentials,
    };
    console.log("Using Base64 encoded service account key from ENV.");
  } catch (error) {
    console.error("Failed to parse Base64 encoded service account key:", error);
    // Potentially fall back or throw error depending on requirements
    // If GOOGLE_APPLICATION_CREDENTIALS might still be used locally, you could add that check here.
    throw new Error("Invalid Base64 encoded service account key in environment variable.");
  }
} else {
  // If the Base64 var isn't set, assume local development using
  // GOOGLE_APPLICATION_CREDENTIALS file path or Application Default Credentials.
  // The Storage() constructor handles this automatically.
  console.log("Using Application Default Credentials (or GOOGLE_APPLICATION_CREDENTIALS file path).");
}

// Creates a client
const storage = new Storage(storageOptions);

// Ensure GCS_BUCKET_NAME is set in your environment variables
const bucketName = process.env.GCS_BUCKET_NAME;
if (!bucketName) {
  throw new Error("GCS_BUCKET_NAME environment variable is not set.");
}
const bucket = storage.bucket(bucketName);

// --- End GCS Configuration ---


// --- Upload a file to GCS ---
export const storeFile = async (
  fileBuffer: Buffer,
  fileName: string,
  destinationFolder: string // Changed from fileType
): Promise<string> => {
  if (!bucketName) {
      throw new Error("GCS_BUCKET_NAME environment variable is not set. Cannot store file.");
  }

  // Create unique filename
  const timestamp = new Date().getTime();
  const parsedPath = path.parse(fileName);
  const safeBaseName = parsedPath.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const uniqueFileName = `${timestamp}-${safeBaseName}${parsedPath.ext}`;

  // The GCS object path includes the destinationFolder and the unique filename
  const destinationPath = `${destinationFolder}/${uniqueFileName}`;
  const file = bucket.file(destinationPath);

  let contentType: string | undefined = 'application/octet-stream'; // Default content type
  const ext = parsedPath.ext.toLowerCase();

  // Set content type based on common resume types, especially PDF
  if (ext === '.pdf') contentType = 'application/pdf';
  else if (ext === '.doc') contentType = 'application/msword';
  else if (ext === '.docx') contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  // Add other types if you expect them, e.g., .txt, .rtf

  try {
    await file.save(fileBuffer, {
      metadata: {
        contentType: contentType,
      },
    });
    console.log(`Successfully uploaded ${destinationPath} to gs://${bucketName}`);
    return destinationPath; // Return the full GCS object path relative to the bucket
  } catch (err) {
    console.error("Error uploading to GCS:", err);
    throw new Error(`Failed to upload file to GCS bucket ${bucketName}`);
  }
};
// --- End Upload Function ---

// --- Upload a file Stream to GCS ---
export const storeFileStream = async (
  fileStream: Readable, // Accept a Readable stream
  fileName: string,
  destinationFolder: string // Changed from fileType
): Promise<string> => {
  if (!bucketName) {
      throw new Error("GCS_BUCKET_NAME environment variable is not set. Cannot store file stream.");
  }

  // Reuse logic for unique filename and path
  const timestamp = new Date().getTime();
  const parsedPath = path.parse(fileName);
  const safeBaseName = parsedPath.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const uniqueFileName = `${timestamp}-${safeBaseName}${parsedPath.ext}`;
  const destinationPath = `${destinationFolder}/${uniqueFileName}`;
  const file = bucket.file(destinationPath);

  let contentType: string | undefined = 'application/octet-stream'; // Default content type
  const ext = parsedPath.ext.toLowerCase();
  if (ext === '.pdf') contentType = 'application/pdf';
  else if (ext === '.doc') contentType = 'application/msword';
  else if (ext === '.docx') contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  // Add more types as needed

  // Use stream piping for upload
  return new Promise((resolve, reject) => {
    const writeStream = file.createWriteStream({
        metadata: {
            contentType: contentType,
        },
    });

    fileStream.pipe(writeStream)
        .on('error', (err) => {
            console.error(`Error uploading stream to GCS for ${destinationPath}:`, err);
            reject(new Error(`Failed to upload file stream to GCS bucket ${bucketName}`));
        })
        .on('finish', () => {
            console.log(`Successfully uploaded stream ${destinationPath} to gs://${bucketName}`);
            resolve(destinationPath); // Resolve with the GCS object path
        });
    
    fileStream.on('error', (err) => {
        console.error(`Error reading input file stream for ${destinationPath}:`, err);
        writeStream.end();
        reject(new Error(`Failed to read input file stream`));
    });
  });
};
// --- End Upload Stream Function ---

// --- Get a Readable Stream for a file from GCS ---
export const getFileStream = async (objectPath: string): Promise<Readable> => {
  if (!bucketName) {
      throw new Error("GCS_BUCKET_NAME environment variable is not set. Cannot get file stream.");
  }
  
  // Extract object path from signed URL if needed
  let actualObjectPath = objectPath;
  if (objectPath.startsWith('https://storage.googleapis.com/')) {
    try {
      const url = new URL(objectPath);
      // Extract path after bucket name: /bucket-name/path/to/file
      const pathParts = url.pathname.split('/');
      if (pathParts.length > 2) {
        // Remove empty string and bucket name, join the rest
        actualObjectPath = pathParts.slice(2).join('/');
      }
    } catch (urlError) {
      console.warn(`Failed to parse URL ${objectPath}, using as-is:`, urlError);
    }
  }
  
  const file = bucket.file(actualObjectPath);

  try {
      // Check if file exists first to provide clearer error
      const [exists] = await file.exists();
      if (!exists) {
          throw new Error(`File not found in GCS bucket ${bucketName} at path: ${actualObjectPath}`);
      }
      // Create a readable stream
      return file.createReadStream();
  } catch (err: any) {
      console.error(`Error getting file stream from GCS for ${actualObjectPath}:`, err);
      // Re-throw specific known errors or a generic one
      if (err.message.includes('File not found')) {
          throw err; // Re-throw the specific error
      }
      throw new Error(`Failed to retrieve file stream from GCS for ${actualObjectPath}`);
  }
};
// --- End Get Stream Function ---


// --- Delete a file from GCS ---
export const deleteGcsFile = async (objectPath: string): Promise<boolean> => {
  if (!bucketName) {
      console.error("GCS_BUCKET_NAME environment variable is not set. Cannot delete file.");
      return false; // Or throw error, depending on desired behavior
  }
  const file = bucket.file(objectPath);

  try {
    // Check if file exists before attempting delete for better logging/idempotency
    const [exists] = await file.exists();
    if (!exists) {
        console.log(`File ${objectPath} not found in gs://${bucketName} for deletion.`);
        return false; // Indicate file wasn't found
    }
    await file.delete();
    console.log(`Successfully deleted ${objectPath} from gs://${bucketName}`);
    return true;
  } catch (err: any) {
      // Handle potential errors during deletion (e.g., permissions)
      console.error(`Error deleting file ${objectPath} from GCS:`, err);
      // Check for specific GCS error codes if needed, e.g., err.code === 404
      if (err.code === 404) { // Already deleted or never existed
          console.log(`File ${objectPath} was not found during deletion attempt.`);
          return false;
      }
      throw new Error(`Failed to delete file ${objectPath} from GCS`);
  }
};
// --- End Delete Function ---


// --- Generate a pre-signed URL for GCS access ---
export const getPresignedUrl = async (objectPath: string, expiresInSeconds: number = 3600): Promise<string> => {
    if (!bucketName) {
        throw new Error("GCS_BUCKET_NAME environment variable is not set. Cannot generate signed URL.");
    }
    const file = bucket.file(objectPath);

    // Set the expiration time for the signed URL
    const expires = Date.now() + expiresInSeconds * 1000; // Convert seconds to milliseconds

    // Define configuration for the signed URL
    const config: GetSignedUrlConfig = {
        action: 'read', // We want to allow reading the file
        expires: expires,
        // Optional: Specify version 'v4' for robustness if needed
        // version: 'v4',
    };

    try {
        // Check if file exists before generating URL
        const [exists] = await file.exists();
        if (!exists) {
            throw new Error(`Cannot generate signed URL: File not found in GCS bucket ${bucketName} at path: ${objectPath}`);
        }

        // Generate the signed URL
        const [url] = await file.getSignedUrl(config);
        return url;
    } catch (err: any) {
        console.error(`Error generating GCS pre-signed URL for ${objectPath}:`, err);
        // Re-throw specific known errors or a generic one
        if (err.message.includes('File not found')) {
            throw err; // Re-throw the specific error
        }
        throw new Error(`Failed to generate GCS pre-signed URL for ${objectPath}`);
    }
};
// --- End Signed URL Function ---

// --- Generate a pre-signed URL for GCS Upload --- 
export const getSignedUploadUrl = async (
    objectPath: string, 
    contentType: string, // Require content type for upload URL
    expiresInSeconds: number = 300 // Shorter default expiry for uploads
): Promise<{ signedUrl: string; gcsPath: string }> => {
    if (!bucketName) {
        throw new Error("GCS_BUCKET_NAME environment variable is not set. Cannot generate signed upload URL.");
    }
    const file = bucket.file(objectPath);

    // Set the expiration time for the signed URL
    const expires = Date.now() + expiresInSeconds * 1000; // Convert seconds to milliseconds

    // Define configuration for the signed URL for PUT request
    const config: GetSignedUrlConfig = {
        action: 'write', // Allow writing the file
        contentType: contentType, // Specify the expected content type
        expires: expires,
        version: 'v4', // v4 is generally recommended for uploads
    };

    try {
        // Generate the signed URL
        const [url] = await file.getSignedUrl(config);
        return { signedUrl: url, gcsPath: objectPath }; // Return URL and the path
    } catch (err: any) {
        console.error(`Error generating GCS pre-signed upload URL for ${objectPath}:`, err);
        throw new Error(`Failed to generate GCS pre-signed upload URL for ${objectPath}`);
    }
};
// --- End Signed Upload URL Function ---

// --- Verification Media Upload Functions ---

/**
 * Upload verification video to GCS
 */
export const storeVerificationVideo = async (
  videoBuffer: Buffer,
  candidateId: string,
  originalFileName: string
): Promise<string> => {
  if (!bucketName) {
    throw new Error("GCS_BUCKET_NAME environment variable is not set. Cannot store verification video.");
  }

  const timestamp = new Date().getTime();
  const safeFileName = originalFileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const uniqueFileName = `verification_video_${candidateId}_${timestamp}_${safeFileName}`;
  const destinationPath = `verifications/videos/${uniqueFileName}`;
  const file = bucket.file(destinationPath);

  try {
    await file.save(videoBuffer, {
      metadata: {
        contentType: 'video/webm', // or video/mp4 depending on your format
      },
    });
    console.log(`Successfully uploaded verification video ${destinationPath} to gs://${bucketName}`);
    return destinationPath;
  } catch (err) {
    console.error("Error uploading verification video to GCS:", err);
    throw new Error(`Failed to upload verification video to GCS bucket ${bucketName}`);
  }
};

/**
 * Upload verification photo (extracted from video) to GCS
 */
export const storeVerificationPhoto = async (
  photoBuffer: Buffer,
  candidateId: string,
  fileName: string = 'id_photo.jpg'
): Promise<string> => {
  if (!bucketName) {
    throw new Error("GCS_BUCKET_NAME environment variable is not set. Cannot store verification photo.");
  }

  const timestamp = new Date().getTime();
  const uniqueFileName = `verification_photo_${candidateId}_${timestamp}_${fileName}`;
  const destinationPath = `verifications/photos/${uniqueFileName}`;
  const file = bucket.file(destinationPath);

  try {
    await file.save(photoBuffer, {
      metadata: {
        contentType: 'image/jpeg',
      },
    });
    console.log(`Successfully uploaded verification photo ${destinationPath} to gs://${bucketName}`);
    return destinationPath;
  } catch (err) {
    console.error("Error uploading verification photo to GCS:", err);
    throw new Error(`Failed to upload verification photo to GCS bucket ${bucketName}`);
  }
};

/**
 * Upload verification audio (extracted from video) to GCS
 */
export const storeVerificationAudio = async (
  audioBuffer: Buffer,
  candidateId: string,
  fileName: string = 'voice_sample.wav'
): Promise<string> => {
  if (!bucketName) {
    throw new Error("GCS_BUCKET_NAME environment variable is not set. Cannot store verification audio.");
  }

  const timestamp = new Date().getTime();
  const uniqueFileName = `verification_audio_${candidateId}_${timestamp}_${fileName}`;
  const destinationPath = `verifications/audio/${uniqueFileName}`;
  const file = bucket.file(destinationPath);

  try {
    await file.save(audioBuffer, {
      metadata: {
        contentType: 'audio/wav', // or audio/webm depending on your format
      },
    });
    console.log(`Successfully uploaded verification audio ${destinationPath} to gs://${bucketName}`);
    return destinationPath;
  } catch (err) {
    console.error("Error uploading verification audio to GCS:", err);
    throw new Error(`Failed to upload verification audio to GCS bucket ${bucketName}`);
  }
};

/**
 * Generate signed upload URL for verification media
 */
export const getVerificationUploadUrl = async (
  candidateId: string,
  mediaType: 'video' | 'photo' | 'audio',
  fileName: string,
  expiresInSeconds: number = 300
): Promise<{ signedUrl: string; gcsPath: string }> => {
  if (!bucketName) {
    throw new Error("GCS_BUCKET_NAME environment variable is not set. Cannot generate verification upload URL.");
  }

  const timestamp = new Date().getTime();
  const safeFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const uniqueFileName = `verification_${mediaType}_${candidateId}_${timestamp}_${safeFileName}`;
  
  let destinationPath: string;
  let contentType: string;

  switch (mediaType) {
    case 'video':
      destinationPath = `verifications/videos/${uniqueFileName}`;
      contentType = 'video/webm';
      break;
    case 'photo':
      destinationPath = `verifications/photos/${uniqueFileName}`;
      contentType = 'image/jpeg';
      break;
    case 'audio':
      destinationPath = `verifications/audio/${uniqueFileName}`;
      contentType = 'audio/wav';
      break;
    default:
      throw new Error(`Unsupported media type: ${mediaType}`);
  }

  const file = bucket.file(destinationPath);
  const expires = Date.now() + expiresInSeconds * 1000;

  const config: GetSignedUrlConfig = {
    action: 'write',
    contentType: contentType,
    expires: expires,
    version: 'v4',
  };

  try {
    const [url] = await file.getSignedUrl(config);
    return { signedUrl: url, gcsPath: destinationPath };
  } catch (err: any) {
    console.error(`Error generating verification upload URL for ${destinationPath}:`, err);
    throw new Error(`Failed to generate verification upload URL for ${destinationPath}`);
  }
};

// --- End Verification Upload Functions ---

// --- Remove or comment out old fs-based functions ---
// export const getFile = ... (old function)
// export const deleteFile = ... (old function)