const express = require("express");
const http = require("http");
const socketIO = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

// Serve static files
app.use("/public", express.static(path.join(__dirname, "../public")));
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../index.html"));
});

// Store connected players
const players = {};

io.on("connection", (socket) => {
  console.log("New player connected:", socket.id);

  // Create a new player
  players[socket.id] = {
    id: socket.id,
    position: { x: 0, y: 0, z: 0 },
    quaternion: { _x: 0, _y: 0, _z: 0, _w: 1 }, // Default identity quaternion
    velocity: { x: 0, y: 0, z: 0 },
  };

  // Send the current players to the new player
  socket.emit("currentPlayers", players);

  // Broadcast to other players that a new player has joined
  socket.broadcast.emit("newPlayer", players[socket.id]);

  // Handle player movement updates
  socket.on("playerMovement", (movementData) => {
    players[socket.id].position = movementData.position;
    players[socket.id].quaternion = movementData.quaternion;
    players[socket.id].velocity = movementData.velocity;

    // Broadcast updated player position to all other players
    socket.broadcast.emit("playerMoved", players[socket.id]);
  });

  // Handle player disconnection
  socket.on("disconnect", () => {
    console.log("Player disconnected:", socket.id);
    delete players[socket.id];
    io.emit("playerDisconnected", socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
