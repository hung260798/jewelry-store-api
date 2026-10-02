const assert = require("node:assert");

function add(args) {
  return args.reduce((prev, curr) => prev + curr, 0);
}

describe("add()", function () {
  const tests = [
    { args: [1, 2], expected: 3 },
    { args: [1, 2, 3], expected: 6 },
    { args: [1, 2, 3, 4], expected: 10 },
  ];

  tests.forEach(({ args, expected }) => {
    it(`correctly adds ${args.length} args`, function () {
      const res = add(args);
      assert.strictEqual(res, expected);
    });
  });
});

describe("Array", function () {
  describe("#indexOf()", function () {
    it.skip("should return -1 unless present", function () {
      assert.equal([1, 2, 3].indexOf(4), -1);
    });

    it("should return the index when present", function () {
      // ...
    });
  });
});
