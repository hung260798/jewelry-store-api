const mongoose = require("mongoose");
const Product = require("../src/models/Product.model");
require("dotenv").config();


// =========================
// MongoDB connection config
// =========================
// const username = "YOUR_USERNAME";
// const password = "YOUR_PASSWORD";
// const host = "YOUR_HOST";
// const dbname = "YOUR_DATABASE_NAME";

const mongoConnect = process.env.MONGODB_URI || process.env.MONGODB_URL;
// const mongoUri = `mongodb+srv://${username}:${password}@${host}/${dbname}`;
const mongoUri = mongoConnect;



// =========================
// Data
// =========================

const categoryIds = [
  "68204341e5881589f5346267",
  "68a6711968eb0458eb372ba7",
  "691005044c1fc7a36135ed24",
  "68204341e5881589f5346268",
  "68908a3c91d8484158aa8fe3",
  "68204341e5881589f5346264",
  "68204341e5881589f5346265",
  "68204341e5881589f5346266",
  "68413a2ed7a9110b865cc250",
  "68413d58d7a9110b865cc3dd",
];

const supplierIds = [
  "682043738f4f0261d000bbfc",
  "682043738f4f0261d000bbfd",
  "682043738f4f0261d000bc00",
  "682043738f4f0261d000bc01",
  "682043738f4f0261d000bbfa",
  "682043738f4f0261d000bbfb",
  "682043738f4f0261d000bbff",
  "6826a5671c67d55baf9a8bfa",
  "682043738f4f0261d000bbf9",
  "682043738f4f0261d000bbfe",
];

const imageUrl =
  "https://storage.googleapis.com/civic-shell-481002-c2-bucket2/821cdefe-1147-4c64-8c4e-cf310d40d12f-sp-gbqt00y000019-bong-tai-cuoi-vang-24k-dinh-da-aventurine-pnj-la-ngoc-canh-vang-10.png";

const images = [
  "https://storage.googleapis.com/civic-shell-481002-c2-bucket2/18c19d67-de55-48f3-bff3-65079c835e0d-ne-ncrop-83.webp",
];

const promotionTypes = ["TOP-MONTH", "DEAL"];

const productNames = [
  "White Gold Plated Princess",
  "Classic Diamond Solitaire Ring",
  "Elegant Gold Wedding Ring",
  "Luxury Diamond Promise Ring",
  "Premium Gold Engagement Ring",
  "Classic Silver Diamond Necklace",
  "Elegant Pearl Wedding Earrings",
  "Luxury Gold Pendant",
  "Princess Cut Diamond Ring",
  "Modern Gold Jewelry Set",
  "Classic Wedding Diamond Ring",
  "Elegant Rose Gold Bracelet",
  "Premium Diamond Earrings",
  "Luxury White Gold Necklace",
  "Classic Gold Anniversary Ring",
];

const productDescriptions = [
  "Classic created wedding engagement solitaire diamond promise ring for her.",
  "Elegant jewelry designed for special occasions, weddings, anniversaries and unforgettable moments.",
  "A timeless piece featuring a beautiful design that combines elegance, luxury and modern style.",
  "Perfect for engagement, wedding, anniversary, Valentine's Day or as a meaningful gift for someone special.",
  "Premium jewelry crafted with a classic appearance and sophisticated details for everyday elegance.",
  "A beautiful addition to any jewelry collection, suitable for celebrations and memorable occasions.",
];

// =========================
// Random helpers
// =========================

function randomItem(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomObjectId(array) {
  return new mongoose.Types.ObjectId(randomItem(array));
}

function randomPromotionPosition() {
  const count = randomInt(0, 2);

  if (count === 0) {
    return [];
  }

  if (count === 1) {
    return [randomItem(promotionTypes)];
  }

  // count === 2
  return [...promotionTypes];
}

// =========================
// Generate products
// =========================

function generateProduct() {
  // Price > 1,000,000
  const price = randomInt(1_000_001, 100_000_000);

  return {
    name: randomItem(productNames),

    price,

    description: randomItem(productDescriptions),

    // 0 -> 100
    discount: randomInt(0, 100),

    // 0 -> 5000
    stock: randomInt(0, 5000),

    categoryId: randomObjectId(categoryIds),

    supplierId: randomObjectId(supplierIds),

    active: true,

    isDeleted: false,

    imageUrl,

    images: [...images],

    promotionPosition: randomPromotionPosition(),

    note: "",

    rateInfo: [],

    // 0 -> 10000
    sold: randomInt(0, 10000),
  };
}

// =========================
// Main
// =========================

async function main() {
  try {
    console.log("Connecting to MongoDB...");

    await mongoose.connect(mongoUri);

    console.log("Connected.");

    const TOTAL = 10_000;

    const products = Array.from({ length: TOTAL }, generateProduct);

    console.log(`Generated ${products.length} products.`);

    await Product.insertMany(products, {
      ordered: false,
    });

    console.log(`Successfully inserted ${TOTAL} products.`);
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected.");
  }
}

main();
