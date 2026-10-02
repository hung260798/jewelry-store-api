const assert = require("node:assert");
const http = require("node:http");
const { once } = require("node:events");

const app = require("../src/app");
const Collection = require("../src/models/Collection.model");

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

describe("Collection slug route", function () {
  const originalFindOne = Collection.findOne;

  before(function () {
    Collection.findOne = (filter) => {
      const chain = {
        select() {
          return this;
        },
        exec: async () => {
          if (filter.slug === "existing-collection") {
            return {
              _id: "64d100000000000000000011",
              name: "Existing Collection",
              slug: "existing-collection",
              products: [],
            };
          }
          return null;
        },
      };
      return chain;
    };
  });

  after(function () {
    Collection.findOne = originalFindOne;
  });

  it("returns a collection by slug", async function () {
    const server = await startServer();
    try {
      const { status, body } = await fetchJson(
        `${server.url}/collections/slug/existing-collection`,
      );
      assert.strictEqual(status, 200);
      assert.strictEqual(body.result.slug, "existing-collection");
      assert.strictEqual(body.result.name, "Existing Collection");
    } finally {
      await server.close();
    }
  });

  it("returns 404 for an unknown slug", async function () {
    const server = await startServer();
    try {
      const { status, body } = await fetchJson(
        `${server.url}/collections/slug/unknown-collection`,
      );
      assert.strictEqual(status, 404);
      assert.strictEqual(body.ok, false);
      assert.strictEqual(body.message, "Object not found");
    } finally {
      await server.close();
    }
  });
});
