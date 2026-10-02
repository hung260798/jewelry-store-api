/**
 * Images module.
 * @module my/images
 */

const sharp = require("sharp");
const path = require("path");

/**
 * @typedef {(string|Buffer)} SharpInput
 * @typedef {[number, number]} Size
 * @param {object} options
 * @param {Size} options.size
 * @param {string} [options.toFile]
 * @param {SharpInput} options.inputImage
 * @returns
 */
async function resize({ size, toFile, inputImage }) {
  const [width, height] = size;
  const sharpInstance = sharp(inputImage).resize({
    width: width,
    height: height,
  });
  if (toFile) {
    return sharpInstance.toFile(toFile);
  } else if (inputImage instanceof Buffer) {
    return sharpInstance.toBuffer();
  } else {
    throw new Error("Invalid input image");
  }
}

/**
 *
 * @param {object} options
 * @param {Array.<Size>} options.sizes
 * @param {("file"|"buffer")} [options.outputType]
 * @param {SharpInput} options.inputImage
 */
async function resizeToSizes({ sizes, inputImage, outputType }) {
  /**
   * @type {(Promise<Buffer> | Promise<string>)[]}
   */
  const promises = sizes.map((size) => {
    const [width, height] = size;
    if (!outputType || outputType === "file") {
      const newpath = appendToFilename(inputImage, `${width}x${height}`);
      return resize({ size, inputImage, toFile: newpath }).then(() => newpath);
    }
    return resize({ size, inputImage });
  });
  const result = await Promise.all(promises);
  return result;
}

/**
 *
 * @param {string} str1
 * @param {string} str2
 * @returns
 */
function appendWithUnderscore(str1, str2) {
  if (typeof str1 != "string" || typeof str2 != "string") {
    throw TypeError("Invalid string");
  }
  return `${str1}_${str2}`;
}

function appendToFilename(filename, str = "", appendFn = appendWithUnderscore) {
  const parentDir = path.dirname(filename);
  const ext = path.extname(filename);
  const oldBasename = path.basename(filename, ext);
  const newBasename = appendFn(oldBasename, str);
  const newpath = path.join(parentDir, newBasename + ext);
  return newpath;
}

function transform(elem, fn) {
  if (Array.isArray(elem)) {
    return elem.map((e) => fn(e));
  }
  return fn(elem);
}

module.exports = {
  resize: resize,
  resizeMultiple: resizeToSizes,
  transform: transform,
  appendToFilename: appendToFilename,
};
