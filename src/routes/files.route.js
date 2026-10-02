const { Router } = require("express");
const { allowPositions } = require("../utils/misc.util");
const { validateByJoi, IdStr2 } = require("../utils/validation.util");

const fs = require("fs");
const { v4: uuidv4 } = require("uuid");
const multer = require("multer");
const { updateDocument } = require("../utils/queries.util");
const {
  resizeMultiple,
  appendToFilename,
} = require("../services/sharp.service");
const { bucket, GCS_BUCKET_NAME } = require("../services/gcs.service");
const Joi = require("joi");

const UPLOAD_DIRECTORY = process.env.UPLOAD_DIR;

function generateFilename(originalName) {
  const timestamp = Date.now(); // milliseconds since 1970
  const random = Math.floor(Math.random() * 1e6); // 0..999999
  const ext = getFileExtension(originalName); // get file extension
  return `${timestamp}-${random}${ext !== "" ? `.${ext}` : ""}`;
}

function generateFilename2(originalName) {
  const uniqueId = uuidv4();
  return `${uniqueId}-${originalName}`;
}

function getFileExtension(filename) {
  const lastDot = filename.lastIndexOf(".");
  if (lastDot > 0 && lastDot < filename.length - 1) {
    return filename.slice(lastDot + 1);
  }
  return "";
}

const uploader = multer({
  storage: multer.diskStorage({
    // contentType: multer.AUTO_CONTENT_TYPE,
    destination: function (req, file, callback) {
      const { id, collectionName } = req.params;
      let containFolder =
        id && collectionName ? `/${collectionName}/${id}` : "/general";
      const PATH = `${UPLOAD_DIRECTORY}${containFolder}`;
      if (!fs.existsSync(PATH)) {
        fs.mkdirSync(PATH, { recursive: true });
      }
      callback(null, PATH);
    },
    filename: function (req, file, callback) {
      const safeFileName = generateFilename(file.originalname);
      callback(null, safeFileName);
    },
  }),
});

const addSingleFile =
  (updateStr = `{ "$set": {"imageUrl": "$value"} }`) =>
  async (req, res, next) => {
    try {
      const { collectionName, id } = req.params;
      const filename = req.file.filename;
      const fileRelativePath = `/uploads/${collectionName}/${id}/${filename}`;
      const updateDoc = JSON.parse(
        updateStr.replace(`"$value"`, `"${fileRelativePath}"`),
      );
      await updateDocument(id, () => updateDoc, collectionName);
      const publicUrl = `${req.protocol}://${req.get("host")}${fileRelativePath}`;
      res.status(200).json({ ok: true, publicUrl: publicUrl });
    } catch (err) {
      next(err);
    }
  };

const memoryMulter = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
    parts: 6
  },
});

/**
 * Upload a single file to Google Cloud Storage
 * @param {Express.Multer.File} multerFile - The file object from multer
 * @param {string} [name] - Optional custom filename. If not provided, generates one.
 */
const uploadFileToGCS = (multerFile, name) => {
  return new Promise((resolve, reject) => {
    if (!multerFile) {
      reject(new Error("'multerFile' is undefined"));
    }
    try {
      const gcsname = name ?? generateFilename2(multerFile.originalname);
      const file = bucket.file(gcsname);

      const stream = file.createWriteStream({
        metadata: {
          contentType: multerFile.mimetype,
        },
        resumable: false,
      });

      stream.on("error", (err) => {
        multerFile.cloudStorageError = err;
        reject(err);
      });

      stream.on("finish", async () => {
        multerFile.cloudStorageObject = gcsname;
        multerFile.cloudStoragePublicUrl = `https://storage.googleapis.com/${GCS_BUCKET_NAME}/${gcsname}`;
        resolve();
      });

      stream.end(multerFile.buffer);
    } catch (error) {
      reject(error);
    }
  });
};

const router = Router();

router.post(
  ["/gcs-upload", "/"],
  memoryMulter.array("file"),
  validateByJoi({
    body: Joi.object({
      sizes: Joi.string(),
    }),
  }),
  async (req, res, next) => {
    try {
      const files = req.files;
      if (!Array.isArray(files) || files.length === 0) {
        return res.status(400).json({ message: "No files uploaded" });
      }
      await Promise.all(files.map((input) => uploadFileToGCS(input)));
      const fileURLs = files.map((file) => file.cloudStoragePublicUrl);
      if (fileURLs.includes(undefined)) {
        throw new Error("Some upload failed");
      }
      const sizes = JSON.parse(req.body.sizes);
      if (!Array.isArray(sizes) || sizes.length === 0) {
        return res.status(200).json({
          message: "File uploaded successfully to GCS",
          ok: true,
          resize: false,
          publicUrls: fileURLs,
        });
      }
      const len = Math.min(sizes.length, 5);
      const bufferArrArr = await Promise.all(
        files.map((input) =>
          resizeMultiple({
            outputType: "buffer",
            sizes: sizes.slice(0, len),
            inputImage: input.buffer,
          }),
        ),
      );
      const bufferArr = bufferArrArr.flat();
      await Promise.all(
        bufferArr.map(async (buffer, i) => {
          const [w, h] = sizes[i % len];
          const file = files[(i - i % len) / len];
          const gcsname = file.cloudStorageObject;
          const filename = appendToFilename(gcsname, `${w}x${h}`);
          await uploadFileToGCS(
            {
              ...file,
              buffer,
              originalname: gcsname,
            },
            filename,
          );
          return filename;
        }),
      );

      res.status(200).json({
        message: "File uploaded successfully to GCS",
        ok: true,
        resize: true,
        publicUrls: fileURLs,
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * Upload a single file to Google Cloud Storage
 * @param {Express.Multer.File} multerFile - The file object from multer
 * @param {string} [name] - Optional custom filename. If not provided, generates one.
 */
const uploadDiskFileToGCS = (multerFile, name) => {
  return new Promise((resolve, reject) => {
    if (!multerFile) {
      reject(new Error("'multerFile' is undefined"));
    }
    const gcsname = name ?? generateFilename2(multerFile.originalname);
    const localFilePath = multerFile.path; // Đường dẫn file tạm trên server
    // Thực hiện upload file tạm lên GCS
    bucket
      .upload(localFilePath, {
        destination: gcsname,
        resumable: false, // Tắt chế độ chia nhỏ file nếu file có dung lượng thấp (<10MB) để tăng tốc độ
      })
      .then((value) => {
        multerFile.cloudStorageObject = gcsname;
        multerFile.cloudStoragePublicUrl = `https://storage.googleapis.com/${GCS_BUCKET_NAME}/${gcsname}`;
        resolve(value);
      })
      .catch((error) => {
        multerFile.cloudStorageError = error;
        reject(error);
      })
      .finally(() => {
        fs.unlink(localFilePath).catch(() => null);
      });
  });
};

const { Queue, Worker } = require("bullmq");
const path = require("path");
const sharp = require("sharp");
const { tmpdir } = require("os");
const { io } = require("../services/socket.service");
const queueName = "image-processing";
const connectionOptions = {
  host: process.env.REDIS_HOST || "127.0.0.1",
  port: process.env.REDIS_PORT || 6379,
};
const imageQueue = new Queue(queueName, {
  connection: connectionOptions,
});

// Khởi tạo Worker lắng nghe hàng đợi queueName
const worker = new Worker(
  queueName,
  async (job) => {
    // const inputs = req.files;
    const multerFiles = job.data.files;
    if (!Array.isArray(multerFiles) || multerFiles.length === 0) {
      throw new Error("Khong co file nao duoc upload");
    }
    await Promise.all(multerFiles.map((file) => uploadDiskFileToGCS(file)));
    // const fileURLs = multerFiles.map((file) => file.cloudStoragePublicUrl);
    const sizes = JSON.parse(job.data.sizes);
    if (!Array.isArray(sizes) || sizes.length === 0) {
      // TODO:Stop, notify client
      return;
    }
    const len = Math.min(sizes.length, 5);
    const localPathArrArr = await Promise.all(
      multerFiles.map((multerFile) =>
        resizeMultiple({
          outputType: "file",
          sizes: sizes.slice(0, len),
          inputImage: multerFile.path,
        }),
      ),
    );
    const localPaths = localPathArrArr.flat();
    await Promise.all(
      localPaths.map(async (path, i) => {
        const [w, h] = sizes[i];
        const file = multerFiles[i / len];
        const gcsname = file.cloudStorageObject;
        const filename = appendToFilename(gcsname, `${w}x${h}`);
        await uploadDiskFileToGCS(
          {
            ...file,
            path: path,
            originalname: gcsname,
          },
          filename,
        );
        return filename;
      }),
    );

    // TODO: Notify client if success or fail, socket ...
  },
  {
    connection: connectionOptions,
    concurrency: 2, // Cho phép xử lý tối đa 2 ảnh đồng thời để tránh nghẽn CPU máy tính
  },
);

worker.on("failed", (job, err) => {
  console.error(`[Worker] Tác vụ ${job.id} bị lỗi:`, err.message);
});

async function pushToQueue(req, res, next) {
  try {
    if (!Array.isArray(req.files)) {
      return res.status(400).json({ message: "Vui lòng chọn một file ảnh." });
    }

    // Ném thông tin file vào hàng đợi (Job)
    // Tác vụ này cực kỳ nhanh (~ vài mili-giây) vì không trực tiếp xử lý ảnh ở đây
    await imageQueue.add("resize-img", {
      files: req.files,
      sizes: req.body.sizes,
    });

    // Trả kết quả ngay lập tức cho người dùng, giải phóng kết nối HTTP
    return res.status(202).json({
      message:
        "Ảnh của bạn đã được tải lên thành công và đang được xử lý ngầm!",
      // fileId: req.file.filename,
    });
  } catch (error) {
    next(error);
  }
}

router.post("gcs-upload-2", pushToQueue);

router.post(
  "/:collectionName/:id/image",
  ...allowPositions("employee", "customer"),
  validateByJoi({
    params: Joi.object({
      id: IdStr2.required(),
      collectionName: Joi.string().required(),
    }),
  }),
  uploader.single("file"),
  addSingleFile(`{ "$set": {"imageUrl": "$value"} }`),
);

module.exports = router;
