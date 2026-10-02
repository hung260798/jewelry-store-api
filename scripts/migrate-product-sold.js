/**
 * Migration script to calculate and fill the 'sold' field for products
 * based on completed/delivered orders
 *
 * Usage: node scripts/migrate-product-sold.js
 */

require("dotenv").config();
const mongoose = require("mongoose");
const Product = require("../src/models/Product.model");
const Order = require("../src/models/Order.model");

const MONGO_URI = process.env.MONGODB_URL || "mongodb://localhost:27017/ecommerce";

async function migrateProductSold() {
  try {
    console.log("🔄 Connecting to MongoDB...");
    await mongoose.connect(MONGO_URI);
    console.log("✅ Connected to MongoDB");

    console.log("\n📊 Fetching all products...");
    const products = await Product.find({});
    console.log(`Found ${products.length} products`);

    console.log("\n⏳ Calculating sold amounts...");
    let updatedCount = 0;
    let skippedCount = 0;

    for (const product of products) {
      try {
        // Get completed and delivered orders only
        const orders = await Order.find({
          "orderDetails.productId": product._id,
          status: { $in: ["COMPLETED", "DELIVERING"] },
        });

        // Calculate total sold quantity
        let totalSold = 0;
        orders.forEach((order) => {
          order.orderDetails.forEach((detail) => {
            if (detail.productId.toString() === product._id.toString()) {
              totalSold += detail.quantity;
            }
          });
        });

        // Update product if sold is 0 or missing
        if (!product.sold || product.sold === 0) {
          await Product.updateOne(
            { _id: product._id },
            { $set: { sold: totalSold } }
          );
          updatedCount++;
          if (totalSold > 0) {
            console.log(
              `  ✓ ${product.name} (${product._id}): sold = ${totalSold}`
            );
          }
        } else {
          skippedCount++;
        }
      } catch (err) {
        console.error(`  ✗ Error processing product ${product._id}:`, err.message);
      }
    }

    console.log("\n✅ Migration completed!");
    console.log(`  Updated: ${updatedCount} products`);
    console.log(`  Skipped: ${skippedCount} products (already have sold data)`);

    await mongoose.disconnect();
    console.log("\n🔌 Disconnected from MongoDB");
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  }
}

migrateProductSold();
