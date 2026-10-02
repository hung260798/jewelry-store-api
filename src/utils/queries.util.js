"use strict";
const { MongoClient, ObjectId } = require("mongodb");
const { client } = require("../services/redis.service");
const crypto = require("crypto");
const CONNECTION_STRING = process.env.MONGODB_URL;
const DATABASE_NAME = process.env.DB_NAME;


// ----------------------------------------------------------------------------
// UPDATE: Sửa
/**
 * @param {string} id
 * @param {*} data
 * @param {string} collectionName
 */
function updateDocument(id, data, collectionName) {
  return new Promise((resolve, reject) => {
    MongoClient.connect(CONNECTION_STRING, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    })
      .then((client) => {
        const dbo = client.db(DATABASE_NAME);
        const collection = dbo.collection(collectionName);
        const query = { _id: new ObjectId(id) };
        let updateDoc = null;
        if (typeof data === "function") {
          updateDoc = data();
        } else {
          updateDoc = data;
        }
        collection
          .findOneAndUpdate(query, updateDoc)
          .then((result) => {
            resolve(result);
          })
          .catch((err) => {
            reject(err);
          })
          .finally(() => {
            client.close();
          });
      })
      .catch((err) => {
        reject(err);
      });
  });
}

// ----------------------------------------------------------------------------
// FIND: Tìm kiếm (id)
function findDocument(id, collectionName) {
  console.log(
    process.env.MONGODB_URL || CONNECTION_STRING,
    process.env.DB_NAME || DATABASE_NAME,
  );
  return new Promise((resolve, reject) => {
    MongoClient.connect(process.env.MONGODB_URL || CONNECTION_STRING, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    })
      .then((client) => {
        const dbo = client.db(process.env.DB_NAME || DATABASE_NAME);
        const collection = dbo.collection(collectionName);
        const query = { _id: new ObjectId(id) };
        collection
          .findOne(query)
          .then((result) => {
            console.log(
              "collection:",
              collectionName,
              "\nid:",
              id,
              "\nresult:",
              result,
            );
            resolve(result);
          })
          .catch((err) => {
            reject(err);
          })
          .finally(() => {
            client.close();
          });
      })
      .catch((err) => {
        reject(err);
      });
  });
}
// ----------------------------------------------------------------------------
// FIND: Tìm kiếm (nhiều)

async function getCollectionCount({
  key,
  model,
  filter = {},
  ttl = 60, // seconds
}) {
  const cached = await client.get(key);
  if (cached !== null) {
    return Number(cached);
  }
  const count = await model.countDocuments(filter);
  await client.set(key, count, {
    EX: ttl
  });
  return count;
}

function normalizeQuery(obj) {
  if (Array.isArray(obj)) {
    return obj.map(normalizeQuery).sort();
  }

  if (obj && typeof obj === "object") {
    return Object.keys(obj)
      .sort()
      .reduce((acc, key) => {
        acc[key] = normalizeQuery(obj[key]);
        return acc;
      }, {});
  }

  return obj;
}

function hashQuery(query) {
  const normalized = normalizeQuery(query);
  const str = JSON.stringify(normalized);

  return crypto
    .createHash("sha1") // đủ dùng cho cache
    .update(str)
    .digest("hex");
}

function buildCountKey({ collection, query, version = "v1" }) {
  const hash = hashQuery(query);
  return `${collection}:count:${version}:${hash}`;
}

// need fix
// function buildUserCountSignature(params) {
//   return {
//     status: params.status ?? "all",
//     roles: (params.roles ?? []).sort(),
//     year: params.from?.slice(0, 4) ?? "any",
//   };
// }

module.exports = {
  updateDocument: updateDocument,
  findDocument: findDocument,
  getCollectionCount: getCollectionCount,
  buildCountKey: buildCountKey,
};

// function main() {
//   const q1 = normalizeQuery({ a: 1, b: 2, c: 3 });
//   const q2 = normalizeQuery({ z: 99, c: 3, b: 2, a: 1 });
//   const q3 = normalizeQuery([
//     { z: 99, c: 3, b: 2, a: 1 },
//     { u: 9, v: 10 },
//     { m: 100, n: -20,j:33 },
//   ]);
//   console.log("q1", q1);
//   console.log("q2", q2);
//   console.log("q3", q3);
// }
// main();
