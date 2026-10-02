const mongoose = require("mongoose");
const { Schema, model } = mongoose;
const mongooseLeanVirtuals = require("mongoose-lean-virtuals");

const MessageSchema = new Schema(
  {
    conversationId: {
      type: Schema.Types.ObjectId,
      ref: "Conversation",
      required: false,
    },
    sender: {
      type: Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
    },
    text: {
      type: String,
      required: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

MessageSchema.virtual("employee", {
  ref: "Employee",
  localField: "sender",
  foreignField: "_id",
  justOne: true,
  options: {
    select: "firstName lastName _id imageUrl",
  },
});

MessageSchema.set("toJSON", { virtuals: true });
MessageSchema.plugin(mongooseLeanVirtuals);

const Message = model("Message", MessageSchema);

module.exports = Message;
