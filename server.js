const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

/* ================= FRONTEND FIX ================= */

// OPTION 1: simple response for "/"
app.get("/", (req, res) => {
  res.send("TXTEL Server is running 🚀");
});

// OPTION 2 (recommended): serve frontend if you have it
// app.use(express.static("public"));

/* ================= FILES ================= */

if (!fs.existsSync("uploads")) {
  fs.mkdirSync("uploads");
}

app.use("/uploads", express.static("uploads"));

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({ storage });

app.post("/upload", upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "no file" });

  res.json({
    url: "/uploads/" + req.file.filename
  });
});

/* ================= STATE ================= */

const users = new Map();
const vcStates = new Map();

let chats = ["general"];
let vcs = ["General VC"];

/* ================= SOCKET ================= */

io.on("connection", socket => {

  socket.on("login", name => {
    socket.username = name || "user";

    users.set(socket.id, socket.username);

    socket.emit("chatList", chats);
    socket.emit("vcList", vcs);

    io.emit("users", Array.from(users.values()));
  });

  socket.on("createChat", name => {
    if (!name) return;
    if (!chats.includes(name)) {
      chats.push(name);
      io.emit("chatList", chats);
    }
  });

  socket.on("createVC", name => {
    if (!name) return;
    if (!vcs.includes(name)) {
      vcs.push(name);
      io.emit("vcList", vcs);
    }
  });

  socket.on("message", m => {
    if (!m) return;

    io.emit("message", {
      id: Date.now() + Math.random(),
      from: socket.username,
      room: m.room,
      text: m.text || "",
      file: m.file || null,
      time: Date.now()
    });
  });

  socket.on("joinVC", room => {
    vcStates.set(socket.id, {
      id: socket.id,
      name: socket.username,
      room,
      muted: false,
      deafened: false,
      speaking: false,
      volume: 0
    });

    io.emit("vcUsers", Array.from(vcStates.values()));
  });

  socket.on("speaking", state => {
    if (!vcStates.has(socket.id)) return;

    let u = vcStates.get(socket.id);
    u.speaking = !!state;

    vcStates.set(socket.id, u);

    io.emit("vcUsers", Array.from(vcStates.values()));
  });

  socket.on("vcState", data => {
    if (!vcStates.has(socket.id)) return;

    let u = vcStates.get(socket.id);

    if (data.type === "mute") u.muted = !!data.state;
    if (data.type === "deafen") u.deafened = !!data.state;

    vcStates.set(socket.id, u);

    io.emit("vcUsers", Array.from(vcStates.values()));
  });

  socket.on("disconnect", () => {
    users.delete(socket.id);
    vcStates.delete(socket.id);

    io.emit("users", Array.from(users.values()));
    io.emit("vcUsers", Array.from(vcStates.values()));
  });
});

/* ================= START ================= */

server.listen(process.env.PORT || 3000, () => {
  console.log("TXTEL READY - DEPLOY OK");
});
