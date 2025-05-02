const { Server } = require("socket.io");

let io;

// Function to emit new lead events
const emitNewLead = (lead) => {
  if (io) {
    io.emit("new_lead", lead);
  }
};

const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: process.env.FRONTEND_URL,
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  io.on("connection", (socket) => {
    console.log("⚡ New client connected:", socket.id);
  
    socket.on("disconnect", () => {
      console.log("👋 Client disconnected:", socket.id);
    });
  });

  return io;
};

const getIO = () => {
  if (!io) throw new Error("Socket.io not initialized");
  return io;
};

module.exports = { initSocket, getIO, emitNewLead };