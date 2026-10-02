const mongoose = require("mongoose");
const { Schema, model } = mongoose;

const membersSchema = new Schema({
  [0]: { type: Schema.Types.ObjectId, ref: "Employee", required: false },
  [1]: { type: Schema.Types.ObjectId, ref: "Employee", required: false },
});
const ConversationSchema = new Schema(
  {
    members: {
      type: [membersSchema],
    },
  },
  { timestamps: true }
);

const Conversation = model("Conversation", ConversationSchema);
module.exports = Conversation;
