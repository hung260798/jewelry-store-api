const cron = require("cron");
const https = require("https");

const backendUrl = process.env.BACKEND_URL;

const job = new cron.CronJob("*/14 * * * *", () => {
  console.log(`🎶🎶🎶.. Restarting server`);
  // Perform an HTTPS GET request to hit any backend api
  https
    .get(backendUrl, (res) => {
      if (res.statusCode === 200) {
        console.log(`🎶🎶🎶.. server restarted`);
      } else {
        console.log(`⚠️⚠️⚠️!! fail to restart server:  `, res.statusCode);
      }
    })
    .on("error", (err) => {
      console.log(`⚠️⚠️⚠️!! Error during restart `, err.message);
    });
});

module.exports = { job: job };
