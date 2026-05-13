const express = require("express");
const http = require("http");
const fs = require("fs");
const path = require("path");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// 🔐 FIXED ADMIN KEY
const ADMIN_KEY = "Txtel223";
console.log("ADMIN KEY:", ADMIN_KEY);

// USERS + BAN
const users = new Map(); // socket.id -> name
const banned = new Set();

// LOGS (admin feed)
const logs = [];

// ================= FRONTEND =================
app.get("/", (req, res) => {
res.send(`
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Txtel</title>

<style>
body {
    margin:0;
    font-family:Arial;
    background:#2b2d31;
    color:white;
    display:flex;
}

/* USERS */
#users {
    width:200px;
    background:#1e1f22;
    height:100vh;
    overflow:auto;
    padding:10px;
}

.user {
    padding:8px;
    margin:4px 0;
    background:#2b2d31;
    border-radius:5px;
    cursor:pointer;
}

/* CHAT */
#chat {
    flex:1;
    display:flex;
    flex-direction:column;
}

#topbar {
    background:#1e1f22;
    padding:10px;
    display:flex;
    justify-content:space-between;
}

#messages {
    flex:1;
    overflow:auto;
    padding:10px;
}

#bar {
    background:#1e1f22;
    padding:10px;
}

input { padding:8px; }
button { padding:8px; }

/* ADMIN */
#admin {
    width:280px;
    background:#111;
    height:100vh;
    overflow:auto;
    padding:10px;
    font-size:12px;
}

.log {
    border-bottom:1px solid #333;
    padding:6px 0;
}
</style>

</head>

<body>

<div id="users"></div>

<div id="chat">
    <div id="topbar">
        <div id="room">#general</div>
        <div>
            <input id="adminkey" placeholder="admin key">
            <button onclick="admin()">Admin</button>
        </div>
    </div>

    <div id="messages"></div>

    <div id="bar">
        <input id="msg" placeholder="message">
        <button onclick="send()">Send</button>
    </div>
</div>

<div id="admin">
<h3>ADMIN LIVE FEED</h3>
<div id="logs"></div>

<h3>USERS</h3>
<div id="userlist"></div>
</div>

<script src="/socket.io/socket.io.js"></script>
<script>
const socket = io();

let name = prompt("Jméno:");
socket.emit("join", name);

let selected = null;

// ADMIN LOGIN
function admin(){
    socket.emit("adminLogin", adminkey.value);
}

// USERS LIST
socket.on("users", list => {
    users.innerHTML = "";
    userlist.innerHTML = "";

    const gen = document.createElement("div");
    gen.className = "user";
    gen.innerText = "#general";
    gen.onclick = () => {
        selected = null;
        room.innerText = "#general";
        messages.innerHTML = "";
    };
    users.appendChild(gen);

    list.forEach(u => {
        if(u === name) return;

        const d = document.createElement("div");
        d.className = "user";
        d.innerText = u;

        d.onclick = () => {
            selected = u;
            room.innerText = "@" + u;
            messages.innerHTML = "";
        };

        users.appendChild(d);

        const a = document.createElement("div");
        a.innerText = u;
        userlist.appendChild(a);
    });
});

// MESSAGES
socket.on("message", m => {
    messages.innerHTML += "<div><b>" + m.from + ":</b> " + m.text + "</div>";
});

// ADMIN LOGS
socket.on("adminLog", log => {
    logs.innerHTML +=
        "<div class='log'><b>" + log.from + "</b> → <b>" +
        log.to + "</b><br>" + log.text + "</div>";
});

// SEND
function send(){
    socket.emit("message", {
        text: msg.value,
        to: selected
    });
    msg.value = "";
}
</script>

</body>
</html>
`);
});

// ================= BACKEND =================
io.on("connection", (socket) => {

    socket.on("join", (name) => {

        if (banned.has(name)) {
            socket.disconnect();
            return;
        }

        socket.username = name || "anon";
        users.set(socket.id, socket.username);

        io.emit("users", Array.from(users.values()));
    });

    socket.isAdmin = false;

    // 👑 ADMIN LOGIN
    socket.on("adminLogin", (key) => {
        socket.isAdmin = (key === ADMIN_KEY);
    });

    // 💬 CHAT + DM
    socket.on("message", (data) => {

        const from = socket.username;
        const text = data.text;
        const to = data.to || "general";

        const log = { from, to, text, time: Date.now() };
        logs.push(log);

        // 👑 admin live feed
        if (socket.isAdmin) {
            socket.emit("adminLog", log);
        }

        // 💌 DM
        if (data.to) {
            for (let [id, name] of users) {
                if (name === data.to) {
                    io.to(id).emit("message", log);
                }
            }
            socket.emit("message", log);
            return;
        }

        // 🌍 GLOBAL
        io.emit("message", log);
    });

    // 👢 KICK
    socket.on("kick", (target) => {
        if (!socket.isAdmin) return;

        for (let [id, name] of users) {
            if (name === target) {
                io.sockets.sockets.get(id)?.disconnect();
            }
        }
    });

    // 🚫 BAN
    socket.on("ban", (target) => {
        if (!socket.isAdmin) return;
        banned.add(target);
    });

    socket.on("disconnect", () => {
        users.delete(socket.id);
        io.emit("users", Array.from(users.values()));
    });
});

// ================= START =================
const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
    console.log("Txtel running on", PORT);
});