require("dotenv").config();
const mongoose = require("mongoose");
const { Storage } = require("@google-cloud/storage");
const Product = require("../src/models/Product.model");
const Category = require("../src/models/Category.model");
const Collection = require("../src/models/Collection.model");
const Employee = require("../src/models/Employee.model");
const Customer = require("../src/models/Customer.model");
const mongoConnect = process.env.MONGODB_URI || process.env.MONGODB_URL;

// Configuration
const GCS_BASE_URL = "https://storage.googleapis.com/";
// const GCS_PROJECT_ID = process.env.GCP_PROJECT_ID || "your-project-id";
const GCS_BUCKET_NAME = process.env.GCP_BUCKET_NAME || "your-bucket-name";

const storage = new Storage();

const bucket = storage.bucket(GCS_BUCKET_NAME);

const DELETE_CONCURRENCY = 20;
const GCS_PAGE_SIZE = 1_000;

const imageModels = [
  [Product, "imageUrl images rateInfo.customer.imageUrl"],
  [Category, "imageUrl coverImageUrl"],
  [
    Collection,
    "image coverImage products.imageUrl products.images products.rateInfo.customer.imageUrl",
  ],
  [Employee, "imageUrl"],
  [
    Customer,
    "imageUrl favoriteProducts.imageUrl favoriteProducts.images favoriteProducts.rateInfo.customer.imageUrl",
  ],
];

function collectGcsUrls(value, referencedUrls) {
  if (Array.isArray(value)) {
    value.forEach((item) => collectGcsUrls(item, referencedUrls));
  } else if (value && typeof value === "object") {
    Object.values(value).forEach((item) =>
      collectGcsUrls(item, referencedUrls),
    );
  } else if (typeof value === "string" && value.startsWith(GCS_BASE_URL)) {
    referencedUrls.add(value);
  }
}

function isReferencedFile(file, referencedUrls) {
  const fileUrl = `${GCS_BASE_URL}${GCS_BUCKET_NAME}/${file.name}`;
  if (referencedUrls.has(fileUrl)) {
    return true;
  }

  // Resized files are created as "originalName_WIDTHxHEIGHT.extension".
  const originalName = file.name.replace(/_\d+x\d+(\.[^/]+)$/, "$1");
  return (
    originalName !== file.name &&
    referencedUrls.has(`${GCS_BASE_URL}${GCS_BUCKET_NAME}/${originalName}`)
  );
}

async function removeJunkFilesFromGCS() {
  try {
    const referencedUrls = new Set();
    for (const [Model, projection] of imageModels) {
      const cursor = Model.find({}, projection).lean().cursor();
      for await (const document of cursor) {
        collectGcsUrls(document, referencedUrls);
      }
    }

    let deletedCount = 0;
    let nextQuery = { autoPaginate: false, maxResults: GCS_PAGE_SIZE };

    do {
      const [files, query] = await bucket.getFiles(nextQuery);
      const junkFiles = files.filter(
        (file) => !isReferencedFile(file, referencedUrls),
      );

      for (let index = 0; index < junkFiles.length; index += DELETE_CONCURRENCY) {
        await Promise.all(
          junkFiles
            .slice(index, index + DELETE_CONCURRENCY)
            .map((file) => file.delete()),
        );
      }

      deletedCount += junkFiles.length;
      nextQuery = query;
    } while (nextQuery);

    console.log(`🗑️ Deleted ${deletedCount} unreferenced GCS file(s).`);
  } catch (error) {
    console.error("❌ Failed to clean up GCS files:", error);
  }
}

module.exports = { removeJunkFilesFromGCS };

if (require.main === module) {
  mongoose
    .connect(mongoConnect)
    .then(removeJunkFilesFromGCS)
    .catch((error) => {
      console.error("❌ Failed to clean up GCS files:", error);
      process.exitCode = 1;
    })
    .finally(() => mongoose.disconnect());
}
