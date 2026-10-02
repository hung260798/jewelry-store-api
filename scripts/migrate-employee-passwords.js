/**
 * Migration script: Hash all employees' passwords with plaintext "Qwerty123"
 *
 * Usage: node scripts/migrate-employee-passwords.js
 */

require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const Employee = require("../src/models/Employee.model");

const mongoConnect = process.env.MONGODB_URI || process.env.MONGODB_URL;

if (!mongoConnect) {
  console.error(
    "❌ Error: Neither MONGODB_URI nor MONGODB_URL environment variable is set"
  );
  console.error("ℹ️  Please configure one of these variables in your .env file");
  process.exit(1);
}

async function migrateEmployeePasswords() {
  try {
    console.log("🔗 Connecting to MongoDB...");
    await mongoose.connect(mongoConnect, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("✅ Connected to MongoDB");

    const plaintext = "Qwerty123";
    const saltRound = 10;

    console.log(`\n🔐 Hashing password with plaintext: "${plaintext}" (saltRound: ${saltRound})...`);
    const hashedPassword = await bcrypt.hash(plaintext, saltRound);
    console.log(`✅ Password hashed successfully`);

    console.log("\n📋 Fetching all employees...");
    const employees = await Employee.find({}, { _id: 1 });
    console.log(`✅ Found ${employees.length} employee(s)`);

    if (employees.length === 0) {
      console.log("⚠️  No employees found to update");
      await mongoose.connection.close();
      return;
    }

    console.log("\n📝 Updating all employees' passwords...");
    const result = await Employee.updateMany(
      {},
      { $set: { password: hashedPassword } }
    );

    const matched = result.matchedCount ?? result.n ?? 0;
    const modified = result.modifiedCount ?? result.nModified ?? 0;

    console.log(`✅ Employees matched: ${matched}`);
    console.log(`✅ Employees updated: ${modified}`);
    console.log("\n✨ Migration completed successfully!");
  } catch (error) {
    console.error("❌ Migration failed:", error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.connection.close();
  }
}

migrateEmployeePasswords();
