const assert = require("node:assert");
const http = require("node:http");
const { once } = require("node:events");
const jwt = require("jsonwebtoken");

const app = require("../src/app");
const Product = require("../src/models/Product.model");
const Order = require("../src/models/Order.model");
const Employee = require("../src/models/Employee.model");
const Customer = require("../src/models/Customer.model");
const queriesUtil = require("../src/utils/queries.util");

const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET || "jwt secret key";
const JWT_OPTIONS = {
  audience: "aptech.io",
  issuer: "softech.cloud",
  algorithm: "HS512",
  expiresIn: "1d",
};

const createToken = (id, position) =>
  jwt.sign({ position, sub: id }, ACCESS_TOKEN_SECRET, JWT_OPTIONS);

const startServer = async () => {
  const server = http.createServer(app);
  server.listen(0);
  await once(server, "listening");
  const port = server.address().port;
  return {
    close: async () => {
      server.close();
      await once(server, "close");
    },
    url: `http://127.0.0.1:${port}`,
  };
};

const fetchJson = async (url, options = {}) => {
  const response = await fetch(url, options);
  const body = await response.json();
  return { status: response.status, body };
};

describe("Product visibility", function () {
  const originalEmployeeFindById = Employee.findById;
  const originalCustomerFindById = Customer.findById;
  const originalProductFind = Product.find;
  const originalProductFindOne = Product.findOne;
  const originalOrderAggregate = Order.aggregate;
  const originalGetCollectionCount = queriesUtil.getCollectionCount;

  before(function () {
    Employee.findById = async (id) => ({
      _id: id,
      position: "employee",
      toObject: () => ({ _id: id, position: "employee" }),
    });
    Customer.findById = async (id) => ({
      _id: id,
      position: "customer",
      toObject: () => ({ _id: id, position: "customer" }),
    });
    queriesUtil.getCollectionCount = async () => 1;

    Product.find = () => {
      const products = [
        {
          _id: "product1",
          name: "Active Product",
          active: true,
          isDeleted: false,
        },
      ];
      const chain = {
        populate() {
          return this;
        },
        select() {
          return this;
        },
        lean() {
          return this;
        },
        sort() {
          return this;
        },
        collation() {
          return this;
        },
        skip() {
          return this;
        },
        limit() {
          return this;
        },
        exec: async () => products,
      };
      return chain;
    };

    Product.findOne = (filter) => {
      const chain = {
        populate() {
          return this;
        },
        lean: async () => {
          if (filter._id === "64d100000000000000000010") {
            return {
              _id: "64d100000000000000000010",
              name: "Deleted Product",
              active: false,
              isDeleted: true,
            };
          }
          return {
            _id: filter._id || "product1",
            name: "Active Product",
            active: true,
            isDeleted: false,
          };
        },
      };
      return chain;
    };

    Order.aggregate = () => {
      const chain = {
        unwind() {
          return this;
        },
        lookup() {
          return this;
        },
        group: async () => [],
      };
      return chain;
    };
  });

  after(function () {
    Employee.findById = originalEmployeeFindById;
    Customer.findById = originalCustomerFindById;
    Product.find = originalProductFind;
    Product.findOne = originalProductFindOne;
    Order.aggregate = originalOrderAggregate;
    queriesUtil.getCollectionCount = originalGetCollectionCount;
  });

  it("allows anonymous users to request active non-deleted products", async function () {
    const server = await startServer();
    try {
      const { status, body } = await fetchJson(`${server.url}/products`);
      assert.strictEqual(status, 200);
      assert.ok(Array.isArray(body.results));
      assert.strictEqual(body.results[0].active, true);
      assert.strictEqual(body.results[0].isDeleted, false);
    } finally {
      await server.close();
    }
  });

  it("forbids customers from requesting deleted products", async function () {
    const token = createToken("64d100000000000000000002", "customer");
    const server = await startServer();
    try {
      const { status, body } = await fetchJson(
        `${server.url}/products?isDeleted=true`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );
      assert.strictEqual(status, 403);
      assert.strictEqual(body.ok, false);
    } finally {
      await server.close();
    }
  });

  it("allows employees to request deleted products", async function () {
    const token = createToken("64d100000000000000000001", "employee");
    const server = await startServer();
    try {
      const { status, body } = await fetchJson(
        `${server.url}/products?isDeleted=true`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );
      assert.strictEqual(status, 200);
      assert.ok(Array.isArray(body.results));
    } finally {
      await server.close();
    }
  });

  it("returns 404 for a non-employee accessing a deleted product by id", async function () {
    const token = createToken("64d100000000000000000002", "customer");
    const server = await startServer();
    try {
      const { status } = await fetchJson(
        `${server.url}/products/64d100000000000000000010`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );
      assert.strictEqual(status, 404);
    } finally {
      await server.close();
    }
  });

  it("allows employees to access a deleted product by id", async function () {
    const token = createToken("64d100000000000000000001", "employee");
    const server = await startServer();
    try {
      const { status, body } = await fetchJson(
        `${server.url}/products/64d100000000000000000010`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );
      assert.strictEqual(status, 200);
      assert.strictEqual(body.result._id, "64d100000000000000000010");
      assert.strictEqual(body.result.isDeleted, true);
    } finally {
      await server.close();
    }
  });
});
