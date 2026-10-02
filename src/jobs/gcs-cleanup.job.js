const { CronJob } = require("cron");
const mongoose = require("mongoose");
const { removeJunkFilesFromGCS } = require("../../scripts/cleanup-gcs-files");

const cronExpression = process.env.GCS_CLEANUP_CRON || "0 0 3 * * 0";
const timeZone = process.env.TZ || "Asia/Ho_Chi_Minh";
let isRunning = false;

const gcsCleanupJob = new CronJob(
  cronExpression,
  async () => {
    if (isRunning || mongoose.connection.readyState !== 1) {
      return;
    }

    isRunning = true;
    try {
      await removeJunkFilesFromGCS();
    } finally {
      isRunning = false;
    }
  },
  null,
  false,
  timeZone,
);

function startGcsCleanupJob() {
  gcsCleanupJob.start();
  console.log(`🗓️ GCS cleanup scheduled: ${cronExpression} (${timeZone})`);
}

module.exports = { startGcsCleanupJob };
