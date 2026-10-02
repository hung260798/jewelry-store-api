// require("dotenv").config({"path": "../.env"});
const { Storage } = require('@google-cloud/storage');
const path = require('path');

// Configuration
const GCS_BASE_URL = "https://storage.googleapis.com/";
const GCS_PROJECT_ID = process.env.GCP_PROJECT_ID || 'your-project-id';
const GCS_BUCKET_NAME = process.env.GCP_BUCKET_NAME || 'your-bucket-name';
const KEYFILE_PATH = path.join(__dirname, '../service-account.json');

const storageOpts =  {
  projectId: GCS_PROJECT_ID,
  keyFilename: KEYFILE_PATH, // Ensure this path is correct
}

// Initialize Google Cloud Storage client
const storage = exports.storage = new Storage();

const bucket = exports.bucket = storage.bucket(GCS_BUCKET_NAME);

/**
 * 
 * @param {{originalname: string; mimetype: string}} multerFile multer file
 * @param {(originalname: string) => string} filenameGenerator 
 * @returns 
 */
exports.uploadFileToGCS = (multerFile, filenameGenerator) => {
  return new Promise((resolve, reject) => {
    if (!multerFile) {
      reject();
    }

    // Generate a unique filename for GCS
    // const gcsname = Date.now() + fileInRequest.originalname;
    const gcsname = filenameGenerator(multerFile.originalname);
    const file = bucket.file(gcsname);

    const stream = file.createWriteStream({
      metadata: {
        contentType: multerFile.mimetype,
      },
      resumable: false,
    });

    stream.on('error', (err) => {
      multerFile.cloudStorageError = err;
      reject();
    });

    stream.on('finish', async () => {
      multerFile.cloudStorageObject = gcsname;
      multerFile.cloudStoragePublicUrl = `https://storage.googleapis.com/${GCS_BUCKET_NAME}/${gcsname}`;
      resolve();
    });

    stream.end(multerFile.buffer);
  })

};

/**
 * Xóa một tệp từ bucket Google Cloud Storage
 * @param {string} filename - Tên/đường dẫn của tệp cần xóa trong GCS
 * @returns {Promise<void>}
 */
exports.deleteFileFromGCS = (filename) => {
  return new Promise((resolve, reject) => {
    if (!filename) {
      reject(new Error('Tên tệp là bắt buộc'));
      return;
    }

    const file = bucket.file(filename);

    file.delete()
      .then((res) => {
        resolve(res[0]);
      })
      .catch((err) => {
        reject(err);
      });
  });
};

/**
 * Extract GCS file name from a GCS URL
 * @param {string} gcsUrl - The full GCS URL (e.g., https://storage.googleapis.com/bucket-name/file-path)
 * @returns {string | null} The GCS file name/path
 */
exports.getFileNameFromGCSUrl = (gcsUrl) => {
  if (!gcsUrl) {
    return null;
  }

  // Format: https://storage.googleapis.com/{bucket-name}/{file-name}
  // Remove the base URL and bucket name to get just the file name
  const baseUrl = GCS_BASE_URL; // https://storage.googleapis.com/

  if (!gcsUrl.startsWith(baseUrl)) {
    return null; // Not a valid GCS URL
  }

  // Remove base URL
  let remaining = gcsUrl.substring(baseUrl.length);

  // Find the first slash to separate bucket name from file path
  const slashIndex = remaining.indexOf('/');
  if (slashIndex === -1) {
    return null; // No file path found
  }

  // Extract file path (everything after the bucket name)
  const fileName = remaining.substring(slashIndex + 1);

  if (!fileName) {
    return null; // Invalid GCS URL: file name is empty
  }

  return fileName;
};

exports.GCS_BUCKET_NAME = GCS_BUCKET_NAME;
exports.GCS_BASE_URL = GCS_BASE_URL;

