const express = require("express");
const http = require("http");
const fs = require("fs");
const path = require("path");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// ===== HOMEPAGE (HTML přímo v serveru) =====
app.get("/", (req, res) => {
    res.send(`
<!DOCTYPE html>
<html>
<head>
    <title>Textel Chat</title>
    <style>
        body {
            margin: 0;
            font-family: Arial;
            background: #36393f;
            color: white;
        }
        #chat {
            height: 85vh;
            overflow-y: auto;
            padding: 10px;
        }
        input {
            width: 80%;
            padding: 10px;
        }
        button {
            padding: 10px;
        }
    </style>
</head>
<body>

<h2 style="padding:10px;">Textel Chat</h2>

<div id="chat"></div>

<div style="position:fixed;bottom:0;width:100%;background:#2f3136;padding:10px;">
    <input id="msg" placeholder="Zpráva..." />
    <button onclick="send()">Send</button>
</div>

<script src="/socket.io/socket.io.js"></script>
<script>
const socket = io();

let name = prompt("Zadej jméno:");
socket.emit("join", name);

socket.on("message", (msg) => {
    document.getElementById("chat").innerHTML += msg + "<br>";
});

socket.on("system", (msg) => {
    document.getElementById("chat").innerHTML += "<i>" + msg + "</i><br>";
});

function send() {
    const input = document.getElementById("msg");
    socket.emit("message", input.value);
    input.value = "";
}
</script>

</body>
</html>
    `);
});

// ===== CHAT STORAGE =====
const chatDir = path.join(__dirname, "chats");
const chatFile = path.join(chatDir, "chat.txt");

if (!fs.existsSync(chatDir)) {
    fs.mkdirSync(chatDir);
}
if (!fs.existsSync(chatFile)) {
    fs.writeFileSync(chatFile, "");
}

// ===== SOCKET =====
io.on("connection", (socket) => {
    socket.on("join", (name) => {
        socket.username = name || "anon";
        io.emit("system", `${socket.username} se připojil`);
    });

    socket.on("message", (msg) => {
        if (!socket.username) return;

        const line = `${socket.username}: ${msg}`;
        fs.appendFileSync(chatFile, line + "\n");

        io.emit("message", line);
    });

    socket.on("disconnect", () => {
        if (socket.username) {
            io.emit("system", `${socket.username} se odpojil`);
        }
    });
});

// ===== PORT (Render fix) =====
const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
    console.log("Server běží na " + PORT);
});