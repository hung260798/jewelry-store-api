/**
 * Migration script:
 * - Set random createdDate for customers missing it
 * - Re-assign createdDate for customers earlier than 2022-01-01
 *
 * Usage: node scripts/migrate-customer-created-date-random.js
 */

require("dotenv").config();
const mongoose = require("mongoose");
const Customer = require("../src/models/Customer.model");

const mongoConnect = process.env.MONGODB_URI || process.env.MONGODB_URL;

if (!mongoConnect) {
  console.error(
    "❌ Error: Neither MONGODB_URI nor MONGODB_URL environment variable is set",
  );
  console.error("ℹ️  Please configure one of these variables in your .env file");
  process.exit(1);
}

const MIN_DATE = new Date("2000-01-01T00:00:00.000Z");
const CUTOFF_2022 = new Date("2022-01-01T00:00:00.000Z");
const END_2023 = new Date("2023-12-31T23:59:59.999Z");

function getRandomDateBetween(startDate, endDate) {
  const start = startDate.getTime();
  const end = endDate.getTime();
  const randomTime = Math.floor(Math.random() * (end - start + 1)) + start;
  return new Date(randomTime);
}

async function migrateCustomerCreatedDateRandom() {
  try {
    console.log("🔗 Connecting to MongoDB...");
    await mongoose.connect(mongoConnect, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("✅ Connected to MongoDB");

    const filter = {
      $or: [
        { createdDate: { $exists: false } },
        { createdDate: null },
        { createdDate: { $lt: CUTOFF_2022 } },
      ],
    };

    console.log("\n📋 Fetching customers that need createdDate migration...");
    const customers = await Customer.find(filter).select("_id createdDate").lean();
    console.log(`📊 Found ${customers.length} customers to update`);

    if (customers.length === 0) {
      console.log("ℹ️  No customers need migration");
      return;
    }

    let updatedCount = 0;
    let missingDateCount = 0;
    let before2022Count = 0;

    for (let index = 0; index < customers.length; index++) {
      const customer = customers[index];
      const isMissingCreatedDate =
        customer.createdDate === undefined || customer.createdDate === null;

      const randomCreatedDate = isMissingCreatedDate
        ? getRandomDateBetween(MIN_DATE, END_2023)
        : getRandomDateBetween(CUTOFF_2022, END_2023);

      const result = await Customer.updateOne(
        { _id: customer._id },
        { $set: { createdDate: randomCreatedDate } },
      );

      const modified = result.modifiedCount ?? result.nModified ?? 0;
      if (modified > 0) {
        updatedCount += 1;
        if (isMissingCreatedDate) {
          missingDateCount += 1;
        } else {
          before2022Count += 1;
        }
      }

      const updateType = isMissingCreatedDate ? "MISSING" : "BEFORE_2022";
      console.log(
        `✅ ${index + 1}/${customers.length} [${updateType}] Updated ${customer._id} -> ${randomCreatedDate.toISOString()}`,
      );
    }

    console.log("\n" + "=".repeat(60));
    console.log("📈 MIGRATION COMPLETE");
    console.log("=".repeat(60));
    console.log(`✅ Customers matched: ${customers.length}`);
    console.log(`✅ Customers updated: ${updatedCount}`);
    console.log(`✅ Updated from missing createdDate: ${missingDateCount}`);
    console.log(`✅ Updated from createdDate < 2022-01-01: ${before2022Count}`);
    console.log("=".repeat(60));
  } catch (error) {
    console.error("❌ Migration failed:", error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.connection.close();
    console.log("🔌 MongoDB connection closed");
  }
}

migrateCustomerCreatedDateRandom();
