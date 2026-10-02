// src/utils/validation.util.test.js
const assert = require("node:assert");
const { SortOrderSchema } = require("../src/utils/validation.util");

describe("SortOrderSchema", function () {
  const tests = [
    { input: "1", expected: 1 },
    { input: "asc", expected: 1 },
    { input: "0", expected: undefined },
    { input: undefined, expected: undefined },
    { input: "foo", expected: undefined },
  ];

  tests.forEach(({ input, expected }) => {
    it(`should transform ${JSON.stringify(input)} -> ${String(
      expected,
    )}`, function () {
      const res = SortOrderSchema.validateSync(input);
      // thông báo kết quả
      console.log(`input: ${JSON.stringify(input)} => result:`, res);
      assert.strictEqual(res, expected);
      if (typeof expected === "number") {
        assert.strictEqual(typeof res, "number");
      }
    });
  });
});
