const router = require("express").Router();
const allowPositions = require("../utils/misc.util").allowPositions;
// const validateRequest = require("../utils/validation.util").validateRequest;
const Conversation = require("../models/Conversation.model");
const mongoose = require("mongoose");


router.post("/", ...allowPositions("employee"), async (req, res, next) => {
  try {
    const senderId = req.body.senderId;
    const receiverId = req.body.receiverId;
    // Check if conversation with the same members already exists
    const existingConversation = await Conversation.findOne({
      members: { $all: [senderId, receiverId] },
    });

    if (existingConversation) {
      return res.status(400).json({ error: "Conversation already exists." });
    }

    const newConversation = new Conversation({
      members: [senderId, receiverId],
    });

    const savedConversation = await newConversation.save();
    res.status(200).json(savedConversation);
  } catch (error) {
    next(error);
  }
});

router.get("/:userId", ...allowPositions("employee"), async (req, res, next) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.params.userId);
    const results = await Conversation.aggregate([
      {
        $match: {
          members: userId,
        },
      },
      {
        $unwind: "$members",
      },
      {
        $redact: {
          $cond: {
            if: { $eq: ["$members", userId] },
            then: "$$PRUNE",
            else: "$$KEEP",
          },
        },
      },
      {
        $lookup: {
          from: "employees", // Replace with the actual name of the employee collection
          localField: "members",
          foreignField: "_id",
          as: "employeeInfo",
        },
      },
      {
        $lookup: {
          from: "messages", // Replace with the actual name of the message collection
          let: { conversationId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: ["$conversationId", "$$conversationId"],
                },
              },
            },
            { $sort: { createdAt: -1 } },
            { $limit: 1 },
          ],
          as: "lastMessage",
        },
      },
      {
        $unwind: {
          path: "$lastMessage",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          conversationId: "$_id",
          employeeInfo: {
            $map: {
              input: "$employeeInfo",
              as: "emp",
              in: {
                _id: "$$emp._id",
                firstName: "$$emp.firstName",
                lastName: "$$emp.lastName",
                isActive: "$$emp.isActive",
                imageUrl: "$$emp.imageUrl",
              },
            },
          },
          lastMessage: {
            _id: "$lastMessage._id",
            conversationId: "$lastMessage.conversationId",
            sender: "$lastMessage.sender",
            text: "$lastMessage.text",
            createdAt: "$lastMessage.createdAt",
            updatedAt: "$lastMessage.updatedAt",
            __v: "$lastMessage.__v",
          },
        },
      },
      { $unwind: "$employeeInfo" },
    ]);

    res.status(200).json(results);
  } catch (error) {
    next(error);
  }
});

router.get(
  "/find/:firstUserId/:secondUserId",
  ...allowPositions("employee"),
  async (req, res, next) => {
    try {
      const conversation = await Conversation.findOne({
        members: { $all: [req.params.firstUserId, req.params.secondUserId] },
      });
      res.status(200).json(conversation);
    } catch (error) {
      next(error);
    }
  },
);

module.exports = router;
