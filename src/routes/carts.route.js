const express = require("express");
const router = express.Router();
const Cart = require("../models/Cart.model");

router.get("/", async (req, res, next) => {
  try {
    const { customerId } = req.query;
    if (typeof customerId === "string") {
      const results = await Cart.findOne({ customerId }).exec();
      res.json({ results, amountResults: 1 });
    } else {
      const results = await Cart.find({});
      const amountResults = await Cart.countDocuments();
      res.json({ results, amountResults });
    }
  } catch (error) {
    next(error);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const cartId = req.params.id;
    const cart = await Cart.findById(cartId);
    if (!cart) {
      return res.status(200).json({ ok: false, cart: [] });
    }
    return res.status(200).json({ ok: true, cart });
  } catch (error) {
    next(error);
  }
});

router.get("/customer/:customerId", async (req, res, next) => {
  try {
    const { customerId } = req.params;
    let cart = await Cart.findOne({ customerId });
    if (!cart) {
      const newCart = new Cart({ customerId: customerId });
      const savedCart = await newCart.save();
      return res
        .status(200)
        .json({ ok: true, type: "New Cart Created", cart: savedCart });
    }
    // const { products } = cart;
    // for (let i = 0; i < products.length; i++) {
    //   products[i] = Product.findById(products[i]._id);
    // }
    return res.status(200).json({ ok: true, cart: cart });
  } catch (error) {
    next(error);
  }
});

router.post(async (req, res, next) => {
  try {
    const { customerId, cart } = req.body;
    // Check if customerId exists
    const existingCart = await Cart.findOne({ customerId });
    if (existingCart) {
      return res
        .status(400)
        .json({ ok: false, message: "Customer already has cart" });
    } else {
      const newCart = new Cart({ customerId: customerId, products: cart });
      const savedCart = await newCart.save();
      return res
        .status(200)
        .json({ ok: true, message: "Cart created", result: savedCart });
    }
  } catch (error) {
    next(error);
  }
});

router.patch("/:id", async (req, res, next) => {
  try {
    const cartId = req.params.id;
    const cartBody = req.body;
    if (cartId) {
      const update = await Cart.findByIdAndUpdate(cartId, cartBody, {
        new: true,
        upsert: true, // Create a new item if it doesn't exist
      });
      if (update) {
        return res
          .status(200)
          .json({ ok: true, message: "Updated successfully", result: update });
      } else {
        return res.status(404).json({ ok: false, message: "Item not found" });
      }
    }
    return res.status(400).json({ ok: false, message: "Cart ID is required" });
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const itemId = req.params.id;
    const found = await Cart.findByIdAndDelete(itemId);
    if (found) {
      return res.json({ message: "Deleted successfully!!", result: found });
    }
    return res.status(410).json({ ok: false, message: "Object not found" });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
