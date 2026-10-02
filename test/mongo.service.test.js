const assert = require("node:assert");

const { buildMongoOptions } = require("../src/services/mongo.service");

describe("buildMongoOptions()", function () {
  it("returns pooled connection settings with sensible timeouts", function () {
    const options = buildMongoOptions({ maxPoolSize: 25, minPoolSize: 6 });

    assert.strictEqual(options.maxPoolSize, 25);
    assert.strictEqual(options.minPoolSize, 6);
    assert.strictEqual(options.family, 4);
    assert.ok(options.serverSelectionTimeoutMS >= 5000);
    assert.ok(options.connectTimeoutMS >= 10000);
    assert.ok(options.socketTimeoutMS >= 45000);
    assert.ok(options.maxIdleTimeMS >= 300000);
  });
});
