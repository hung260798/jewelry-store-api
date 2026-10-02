const dotenv = require("dotenv");

const createError = require("http-errors");
const express = require("express");
const path = require("path");
const cookieParser = require("cookie-parser");
const morgan = require("morgan");
const cors = require("cors");
const passport = require("passport");
const compression = require("compression");
const pino = require("pino-http")({ autoLogging: false });

dotenv.config({ path: ".env" });

const productsRoute = require("./routes/products.route");
const suppliersRoute = require("./routes/suppliers.route");
const employeesRoute = require("./routes/employees.route");
const customersRoute = require("./routes/customers.route");
const ordersRoute = require("./routes/orders.route");
const questionsRoute = require("./routes/questions.route");
const conversationsRoute = require("./routes/conversations.route");
const messagesRoute = require("./routes/messages.route");
const slidesRoute = require("./routes/slides.route");
const featuresRoute = require("./routes/features.route");
const cartsRoute = require("./routes/carts.route");
const filesRoute = require("./routes/files.route");
const collectionsRoute = require("./routes/collections.route");
const categoriesRoute = require("./routes/categories.route");
const authRoute = require("./routes/auth.route");
const gcsRouter = require("./routes/gcs.route");

const {
  passportConfigJWT,
  createLocalConfig,
} = require("./utils/passport.util");
const { connectWithRetry } = require("./services/mongo.service");
const { connectRedis } = require("./services/redis.service");
const { startGcsCleanupJob } = require("./jobs/gcs-cleanup.job");

/** @type {import('express').Express} */
var app = express();
app.use(
  cors({
    origin: "*",
  }),
);

if (process.env.NODE_ENV !== "test") {
  Promise.all([connectWithRetry(), connectRedis()]).then(() => {
    startGcsCleanupJob();
    // app.use(pino);
    app.use(compression());
    app.set("views", path.join(__dirname, "views"));
    app.set("view engine", "jade");
    app.use(morgan("dev"));
    app.use(express.json()); //khả năng xử lý với Json ( cần thiết)
    app.use(express.urlencoded({ extended: false })); //Làm cho đường dẫn trở nên an toàn ( ví dụ dấu cách chuyển thành % vd: NGUYEN VAN -> NGUYEN%VAN)
    app.use(cookieParser());
    app.use(express.static(path.join(__dirname, "..", "public")));

    // DKy Passport
    passport.use(passportConfigJWT);
    passport.use(createLocalConfig);

    // Routes
    app.use("/products", productsRoute);
    app.use("/suppliers", suppliersRoute);
    app.use("/employees", employeesRoute);
    app.use("/customers", customersRoute);
    app.use("/orders", ordersRoute);
    app.use("/questions", questionsRoute);
    app.use("/conversations", conversationsRoute);
    app.use("/messages", messagesRoute);
    app.use("/slides", slidesRoute);
    app.use("/features", featuresRoute);
    app.use("/carts", cartsRoute);
    app.use("/upload", filesRoute);
    app.use("/collections", collectionsRoute);
    app.use("/categories", categoriesRoute);
    app.use(["/gcp", "/gcs"], gcsRouter);
    app.use("/auth", authRoute);

    app.get("/chat", (req, res) => {
      res.sendFile(__dirname + "../public/index.html");
    });

    app.use(function (req, res, next) {
      next(createError(404));
    });

    // error handler
    // eslint-disable-next-line no-unused-vars
    app.use(function (err, req, res, next) {
      res.locals.message = err.message; // set locals, only providing error in development
      res.locals.error = req.app.get("env") === "development" ? err : {};
      const statusCode = err.status || err.statusCode || 500;
      const clientMessage = err.clientMessage || err.message || "Lỗi máy chủ";
      res.status(statusCode).json({
        ok: false,
        message: clientMessage,
      });
      // // devLog(err);
      // req.log.info(err);
    });
  });
}

module.exports = app;
