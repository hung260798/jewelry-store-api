// PP1: Chuyển hướng trực tiếp đến URL công khai của GCS
// server.js
// Route /gcs
const express = require("express");
const {
  GCS_BUCKET_NAME,
  bucket,
  GCS_BASE_URL,
} = require("../services/gcs.service");
const { devLog } = require("../utils/misc.util");
const router = express.Router();
const path = require("path");
const IMAGE_FILE_REGEX = /\.(jpg|png|jpeg|webp)$/i;

function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

router.get("/", async (req, res, next) => {
  try {
    const limit = parsePositiveInt(req.query.limit, 50);
    const pageToken = req.query.pageToken || undefined;
    const shouldFilterImages = req.query.type === "image";

    const [files, queryOptions] = await bucket.getFiles({
      maxResults: limit,
      pageToken,
      autoPaginate: false,
    });

    let listedFiles = files;
    if (shouldFilterImages) {
      listedFiles = listedFiles.filter((file) =>
        IMAGE_FILE_REGEX.test(file.name),
      );
    }

    const fileNames = listedFiles.map((file) => file.name);
    res.json({
      files: fileNames,
      nextPageToken: queryOptions?.pageToken || null,
      hasMore: Boolean(queryOptions?.pageToken),
      limit,
    });
  } catch (error) {
    next(error);
  }
});

router.get("/:filename", (req, res) => {
  const filename = req.params.filename;

  // 1. Xây dựng URL công khai của file trên GCS
  // Giả định file GCS được thiết lập là public.
  const gcsFileUrl = `${GCS_BASE_URL}${GCS_BUCKET_NAME}/${filename}`;

  // 2. Chuyển hướng người dùng tới URL GCS
  // Sử dụng mã 302 Found (tạm thời) hoặc 301 (vĩnh viễn)
  // 302 là an toàn hơn khi file có thể được di chuyển.
  devLog(`Redirecting to: ${gcsFileUrl}`);
  res.redirect(302, gcsFileUrl);
  // Lưu ý: Nếu bạn sử dụng CDN của Google (ví dụ: thông qua Firebase Hosting),
  // URL có thể khác, ví dụ: 'https://cdn-domain.com/filename'.
});

router.delete("/:filename", async (req, res, next) => {
  try {
    const filename = req.params.filename;
    const cloudFile = bucket.file(filename);
    if (!req.query.deleteMany) {
      await cloudFile.delete();
    } else {
      const filenameWithoutExt = path.parse(filename).name;
      const globPattern = `**/${filenameWithoutExt}*`;
      // const [files] = await bucket.getFiles({ matchGlob: globPattern });
      // const promises = files
      //   .filter((file) => {
      //     // Resized files are created as "originalName_WIDTHxHEIGHT.extension".
      //     const originalName = file.name.replace(/_\d+x\d+(\.[^/]+)$/, "$1");
      //     return originalName === filenameWithoutExt;
      //   })
      //   .map((file) => file.delete());
      // await Promise.all(promises);
      await bucket.deleteFiles({ matchGlob: globPattern });
    }
    res.send(`File ${filename} deleted successfully.`);
  } catch (error) {
    next(error);
  }
});

router.post("/bulk-removal", async function bulkRemoveFiles(req, res, next) {
  try {
    const { files } = req.body;
    await Promise.all(
      files.map((filename) => {
        const filenameWithoutExt = path.parse(filename).name;
        const globPattern = `**/${filenameWithoutExt}*`;
        return bucket.deleteFiles({ matchGlob: globPattern });
      }),
    );
    res.status(202).send({ status: "OK" });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
