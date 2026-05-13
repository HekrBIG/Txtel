const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const bcrypt = require("bcryptjs");
const sqlite3 = require("sqlite3").verbose();
const multer = require("multer");
const fs = require("fs");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

if (!fs.existsSync("./uploads")) {
    fs.mkdirSync("./uploads");
}

const db = new sqlite3.Database("./txtel.db");

db.run(`
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password TEXT
)
`);

const storage = multer.diskStorage({
    destination: "./uploads",
    filename: (req, file, cb) => {
        cb(null, Date.now() + "-" + file.originalname);
    }
});

const upload = multer({ storage });

app.use("/uploads", express.static("uploads"));

const users = new Map();
const bannedIPs = new Set();

const voiceRooms = {
    general: new Set()
};

function chatKey(a, b) {
    return [a, b].sort().join("__");
}

app.get("/", (req, res) => {
    res.send("TXTEL RUNNING");
});

app.post("/upload", upload.single("file"), (req, res) => {
    res.json({ url: "/uploads/" + req.file.filename });
});

io.on("connection", (socket) => {

    const ip = socket.handshake.address;
    if (bannedIPs.has(ip)) return socket.disconnect();

    socket.on("login", ({ u, p }) => {

        db.get("SELECT * FROM users WHERE username=?", [u], (err, row) => {

            if (!row) {

                bcrypt.hash(p, 10, (err, hash) => {
                    db.run("INSERT INTO users(username,password) VALUES(?,?)", [u, hash]);
                });

                socket.username = u;
                users.set(socket.id, u);
                io.emit("users", Array.from(users.values()));
                return;
            }

            bcrypt.compare(p, row.password, (err, ok) => {
                if (!ok) return;

                socket.username = u;
                users.set(socket.id, u);

                io.emit("users", Array.from(users.values()));
            });
        });
    });

    socket.on("message", (data) => {

        let room = "general";

        if (data.to) {
            room = chatKey(socket.username, data.to);
        }

        io.emit("message", {
            from: socket.username,
            text: data.text,
            file: data.file,
            room,
            to: data.to || null
        });
    });

    socket.on("joinVoice", () => {

        const room = "general";

        voiceRooms[room].add(socket.id);
        socket.join(room);

        io.to(room).emit(
            "voiceUsers",
            Array.from(voiceRooms[room])
        );
    });

    socket.on("voiceSpeaking", (data) => {
        io.to("general").emit("voiceSpeakingUpdate", {
            id: socket.id,
            speaking: data.speaking,
            level: data.level
        });
    });

    socket.on("voiceSignal", (data) => {
        io.to(data.to).emit("voiceSignal", {
            from: socket.id,
            signal: data.signal
        });
    });

    socket.on("disconnect", () => {

        users.delete(socket.id);

        for (const r in voiceRooms) {
            voiceRooms[r].delete(socket.id);

            io.to(r).emit(
                "voiceUsers",
                Array.from(voiceRooms[r])
            );
        }

        io.emit("users", Array.from(users.values()));
    });
});

server.listen(process.env.PORT || 3000, () => {
    console.log("TXTEL RUNNING");
});
