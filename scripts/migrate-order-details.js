/**
 * Migration script: Update orders with missing price and discount in orderDetails
 * 
 * Usage: node scripts/migrate-order-details.js
 * 
 * This script:
 * 1. Connects to MongoDB
 * 2. Fetches all orders
 * 3. For each order, checks if orderDetails items have price and discount
 * 4. If missing, fetches the product and uses its price and discount
 * 5. Updates the order
 * 6. Logs progress and closes the connection
 */

require("dotenv").config();
const mongoose = require("mongoose");
const Order = require("../src/models/Order.model");
const Product = require("../src/models/Product.model");

// Support both MONGODB_URI and MONGODB_URL environment variables
const mongoConnect = process.env.MONGODB_URI || process.env.MONGODB_URL;

if (!mongoConnect) {
  console.error("❌ Error: Neither MONGODB_URI nor MONGODB_URL environment variable is set");
  console.error("ℹ️  Please configure one of these variables in your .env file");
  process.exit(1);
}

async function migrateOrderDetails() {
  try {
    // Connect to MongoDB
    console.log("🔗 Connecting to MongoDB...");
    await mongoose.connect(mongoConnect, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("✅ Connected to MongoDB");

    // Fetch all orders
    console.log("\n📋 Fetching all orders...");
    const orders = await Order.find().lean();
    console.log(`📊 Found ${orders.length} orders`);

    if (orders.length === 0) {
      console.log("ℹ️  No orders found in database");
      await mongoose.connection.close();
      return;
    }

    let updatedCount = 0;
    let totalDetailUpdated = 0;
    const errors = [];

    // Process each order
    for (let i = 0; i < orders.length; i++) {
      const order = orders[i];
      let orderUpdated = false;
      const updatedOrderDetails = [...(order.orderDetails || [])];

      // Process each orderDetail item
      for (let j = 0; j < updatedOrderDetails.length; j++) {
        const detail = updatedOrderDetails[j];

        // Check if price or discount are missing
        if (detail.price === undefined || detail.price === null || 
            detail.discount === undefined || detail.discount === null) {
          
          try {
            // Fetch the product
            const product = await Product.findById(detail.productId).lean();

            if (!product) {
              errors.push(`Order ${order._id}: Product ${detail.productId} not found`);
              continue;
            }

            // Update price and discount if missing
            if (detail.price === undefined || detail.price === null) {
              updatedOrderDetails[j].price = product.price;
              orderUpdated = true;
              totalDetailUpdated++;
            }

            if (detail.discount === undefined || detail.discount === null) {
              updatedOrderDetails[j].discount = product.discount;
              orderUpdated = true;
              totalDetailUpdated++;
            }

            console.log(
              `  ✏️  Updated item ${j + 1}: price=${updatedOrderDetails[j].price}, discount=${updatedOrderDetails[j].discount}`
            );
          } catch (error) {
            errors.push(`Order ${order._id}: Error fetching product: ${error.message}`);
          }
        }
      }

      // Update the order if any details were changed
      if (orderUpdated) {
        try {
          await Order.findByIdAndUpdate(
            order._id,
            { orderDetails: updatedOrderDetails },
            { new: true }
          );
          updatedCount++;
          console.log(`✅ Order ${i + 1}/${orders.length}: ${order._id} updated`);
        } catch (error) {
          errors.push(`Order ${order._id}: Error updating order: ${error.message}`);
          console.log(`❌ Order ${i + 1}/${orders.length}: ${order._id} failed`);
        }
      } else {
        console.log(`⏭️  Order ${i + 1}/${orders.length}: ${order._id} skipped (no updates needed)`);
      }
    }

    // Print summary
    console.log("\n" + "=".repeat(60));
    console.log("📈 MIGRATION COMPLETE");
    console.log("=".repeat(60));
    console.log(`✅ Orders updated: ${updatedCount}/${orders.length}`);
    console.log(`📝 Total items updated: ${totalDetailUpdated}`);
    
    if (errors.length > 0) {
      console.log(`\n⚠️  Errors encountered (${errors.length}):`);
      errors.forEach((error) => console.log(`  - ${error}`));
    } else {
      console.log(`\n✨ No errors encountered!`);
    }

    console.log("=".repeat(60) + "\n");

  } catch (error) {
    console.error("❌ Migration failed:", error.message);
    process.exit(1);
  } finally {
    // Close MongoDB connection
    await mongoose.connection.close();
    console.log("🔌 MongoDB connection closed");
  }
}

// Run the migration
migrateOrderDetails();
