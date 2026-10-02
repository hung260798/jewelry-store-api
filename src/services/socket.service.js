const socketIO = require("socket.io");
const Message = require("../models/Message.model");
// const { client: redisClient, connectRedis } = require("./redis.service");
// const { devLog } = require("../utils/misc.util");

let io = null;

function initIO(server) {
  if (io) {
    return io;
  }
  const newIO = new socketIO.Server(server, {
    cors: {
      origin: true,
      credentials: true,
    },
  });

  newIO.on("connection", (socket) => {
    socket.on("client-message", async (data) => {
      socket.join(data.conversationId);

      if (data.type === "chat") {
        try {
          const newData = await new Message({
            employee: data.employee,
            text: data.text,
            sender: data.sender,
            conversationId: data.conversationId,
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
          }).save();
          if (newData._id) {
            newData.employee = data.employee;
            newIO.to(data.room).emit("direct-message", {
              newData,
            });
          }
        } catch (err) {
          console.log(err);
        }
      } else if (data.type === "join") {
        newIO.to(data.room).emit("server-message", {
          message: `join room ${data.room} ok`,
        });
      }
    });

    socket.on("disconnect", () => {
      console.log("User disconnected");
    });
  });
  io = newIO;
  return io;
}

exports.initIO = initIO;
exports.io = io;
