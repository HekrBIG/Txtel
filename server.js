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

// ================= FILES =================
if (!fs.existsSync("./uploads")) {
    fs.mkdirSync("./uploads");
}

// ================= DATABASE =================
const db = new sqlite3.Database("./txtel.db");

db.run(`
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password TEXT
)
`);

db.run(`
CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sender TEXT,
    receiver TEXT,
    text TEXT,
    file TEXT,
    time DATETIME DEFAULT CURRENT_TIMESTAMP
)
`);

// ================= UPLOAD =================
const storage = multer.diskStorage({
    destination: "./uploads",
    filename: (req, file, cb) => {
        cb(null, Date.now() + "-" + file.originalname);
    }
});

const upload = multer({ storage });

app.use("/uploads", express.static("uploads"));

// ================= STATE =================
const users = new Map();
const bannedIPs = new Set();
const voiceUsers = new Set();
const messageHistory = [];

const ADMIN_KEY = "Txtel223";

// ================= FRONTEND =================
app.get("/", (req, res) => {

res.send(`
<!DOCTYPE html>
<html>
<head>

<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">

<title>Txtel</title>

<style>

body{
    margin:0;
    font-family:Arial;
    background:#1e1f22;
    color:white;
    display:flex;
    height:100vh;
}

/* SIDEBAR */
#sidebar{
    width:240px;
    background:#111214;
    padding:10px;
    overflow:auto;
}

.channel,.vc,.user{
    padding:10px;
    margin:5px 0;
    border-radius:8px;
    cursor:pointer;
    background:#2b2d31;
}

.channel:hover,
.vc:hover,
.user:hover{
    background:#3a3c41;
}

.vc{
    background:#1f3f2a;
}

/* CHAT */
#chat{
    flex:1;
    display:flex;
    flex-direction:column;
}

#messages{
    flex:1;
    overflow:auto;
    padding:15px;
}

.msg{
    margin:8px 0;
    padding:8px;
    background:#2b2d31;
    border-radius:8px;
}

#bar{
    display:flex;
    gap:5px;
    padding:10px;
    background:#1a1b1e;
}

input,button{
    padding:10px;
    border:none;
    border-radius:6px;
}

input{
    flex:1;
    background:#2b2d31;
    color:white;
}

button{
    background:#5865f2;
    color:white;
    cursor:pointer;
}

/* ADMIN CONSOLE */
#adminConsole{
    position:fixed;
    bottom:0;
    left:0;
    width:100%;
    height:250px;
    background:black;
    color:#0f0;
    font-family:monospace;
    display:none;
    z-index:9999;
    padding:10px;
}

#admincmd{
    width:100%;
    background:black;
    color:#0f0;
    border:none;
    outline:none;
    margin-top:10px;
}

#adminlog{
    height:160px;
    overflow:auto;
    margin-top:10px;
}

/* MOBILE */
@media(max-width:768px){

    #sidebar{
        width:120px;
        font-size:12px;
    }

    #bar{
        flex-direction:column;
    }

    input,button{
        width:100%;
    }
}

</style>
</head>

<body>

<div id="sidebar">

<div class="channel"># general</div>

<div class="vc" onclick="joinVoice()">
🔊 VC: General
</div>

<hr>

<div id="users"></div>

</div>

<div id="chat">

<div id="messages"></div>

<div id="bar">

<input id="msg" placeholder="Message">

<input type="file" id="file">

<button onclick="send()">Send</button>

<button onclick="uploadFile()">File</button>

<button onclick="mute()">Mute</button>

<button onclick="deafen()">Deafen</button>

</div>

</div>

<!-- ADMIN -->
<div id="adminConsole">

<div>TXTEL ADMIN CONSOLE</div>

<div id="adminlog"></div>

<input id="admincmd" placeholder="command">

</div>

<script src="/socket.io/socket.io.js"></script>
<script src="https://unpkg.com/simple-peer/simplepeer.min.js"></script>

<script>

const socket = io();

let target = null;

let stream;
let peers = {};

let muted = false;
let deafened = false;

// ================= LOGIN =================
let username = prompt("Username");
let password = prompt("Password");

socket.emit("login",{
    u:username,
    p:password
});

// ================= USERS =================
socket.on("users",(list)=>{

    users.innerHTML = "";

    list.forEach(u=>{

        const d = document.createElement("div");

        d.className = "user";

        d.innerText = u;

        d.onclick = ()=>{
            target = u;
        };

        users.appendChild(d);
    });
});

// ================= CHAT =================
socket.on("message",(m)=>{

    const div = document.createElement("div");

    div.className = "msg";

    div.id = "msg-" + m.id;

    if(m.text){
        div.innerHTML =
            "<b>"+m.from+":</b> "+m.text;
    }

    if(m.file){
        div.innerHTML =
            "<b>"+m.from+":</b> <a href='"+m.file+"' target='_blank'>Download File</a>";
    }

    messages.appendChild(div);

    messages.scrollTop =
        messages.scrollHeight;
});

// DELETE MESSAGE
socket.on("deleteMessage",(id)=>{

    const el =
        document.getElementById("msg-" + id);

    if(el){
        el.remove();
    }
});

// CHAT LOG
socket.on("chatlog",(m)=>{

    adminlog.innerHTML +=
        "<div>"+m+"</div>";

    adminlog.scrollTop =
        adminlog.scrollHeight;
});

// ================= SEND =================
function send(){

    socket.emit("message",{
        text:msg.value,
        to:target
    });

    msg.value = "";
}

// ENTER SEND
document.addEventListener("keydown",(e)=>{

    if(e.key === "Enter"){
        send();
    }
});

// ================= FILE =================
async function uploadFile(){

    const f = file.files[0];

    if(!f) return;

    const form = new FormData();

    form.append("file",f);

    const res = await fetch("/upload",{
        method:"POST",
        body:form
    });

    const data = await res.json();

    socket.emit("message",{
        file:data.url
    });
}

// ================= VOICE =================
async function joinVoice(){

    stream =
        await navigator.mediaDevices.getUserMedia({
            audio:true
        });

    socket.emit("joinVoice","general");
}

// users in voice
socket.on("voiceUsers",(ids)=>{

    ids.forEach(id=>{

        if(id === socket.id) return;

        if(peers[id]) return;

        createPeer(id,true);
    });
});

// signals
socket.on("voiceSignal",(data)=>{

    if(!peers[data.from]){
        createPeer(data.from,false);
    }

    peers[data.from].signal(data.signal);
});

// create peer
function createPeer(id,initiator){

    const peer = new SimplePeer({

        initiator,

        trickle:false,

        stream
    });

    peer.on("signal",(signal)=>{

        socket.emit("voiceSignal",{

            room:"general",

            signal
        });
    });

    peer.on("stream",(s)=>{

        const audio =
            document.createElement("audio");

        audio.srcObject = s;

        audio.autoplay = true;

        audio.muted = deafened;

        document.body.appendChild(audio);
    });

    peers[id] = peer;
}

// ================= AUDIO =================
function mute(){

    muted = !muted;

    if(stream){

        stream.getAudioTracks().forEach(t=>{

            t.enabled = !muted;
        });
    }
}

function deafen(){

    deafened = !deafened;

    document.querySelectorAll("audio")
    .forEach(a=>{

        a.muted = deafened;
    });
}

// ================= ADMIN CONSOLE =================
let adminOpen = false;

// ;
document.addEventListener("keydown",(e)=>{

    if(e.key === ";"){

        adminOpen = !adminOpen;

        adminConsole.style.display =
            adminOpen ? "block" : "none";
    }
});

// commands
admincmd.addEventListener("keydown",(e)=>{

    if(e.key !== "Enter") return;

    socket.emit("admin",admincmd.value);

    admincmd.value = "";
});

</script>

</body>
</html>
`);
});

// ================= FILE UPLOAD =================
app.post("/upload",
upload.single("file"),
(req,res)=>{

    res.json({
        url:"/uploads/"+req.file.filename
    });
});

// ================= SOCKET =================
io.on("connection",(socket)=>{

    const ip =
        socket.handshake.address;

    if(bannedIPs.has(ip)){
        return socket.disconnect();
    }

    // LOGIN / REGISTER
    socket.on("login",({u,p})=>{

        db.get(
            "SELECT * FROM users WHERE username=?",
            [u],
            (err,row)=>{

            // register
            if(!row){

                bcrypt.hash(p,10,(err,hash)=>{

                    db.run(
                        "INSERT INTO users(username,password) VALUES(?,?)",
                        [u,hash]
                    );
                });

                socket.username = u;

                users.set(socket.id,u);

                io.emit(
                    "users",
                    Array.from(users.values())
                );

                return;
            }

            // login
            bcrypt.compare(
                p,
                row.password,
                (err,ok)=>{

                if(!ok) return;

                socket.username = u;

                users.set(socket.id,u);

                io.emit(
                    "users",
                    Array.from(users.values())
                );
            });
        });
    });

    // CHAT
    socket.on("message",(data)=>{

        const msgData = {
            id: Date.now(),
            from: socket.username,
            text: data.text,
            file: data.file
        };

        messageHistory.push(msgData);

        io.emit("message",msgData);

        // live admin chat log
        for(let [id,s] of io.sockets.sockets){

            if(s.chatLogging){

                s.emit(
                    "chatlog",
                    msgData.from +
                    ": " +
                    (msgData.text || "[FILE]")
                );
            }
        }
    });

    // ================= VOICE =================
    socket.on("joinVoice",(room)=>{

        voiceUsers.add(socket.id);

        io.emit(
            "voiceUsers",
            Array.from(voiceUsers)
        );
    });

    socket.on("voiceSignal",(data)=>{

        socket.broadcast.emit(
            "voiceSignal",
            {
                from:socket.id,
                signal:data.signal
            }
        );
    });

    // ================= ADMIN =================
    socket.on("admin",(cmd)=>{

        const args = cmd.split(" ");

        // enable chatlog
        if(args[0] === "!chatlog"){

            socket.chatLogging = true;
        }

        // delete messages
        if(args[0] === "!delete"){

            const index =
                messageHistory.length -
                parseInt(args[1]);

            const msg =
                messageHistory[index];

            if(msg){

                io.emit(
                    "deleteMessage",
                    msg.id
                );
            }
        }

        // ip ban
        if(args[0] === "!ipban"){

            bannedIPs.add(ip);

            socket.disconnect();
        }

        // kick
        if(args[0] === "!kick"){

            const target = args[1];

            for(let [id,u] of users){

                if(u === target){

                    io.sockets.sockets
                    .get(id)
                    ?.disconnect();
                }
            }
        }
    });

    // disconnect
    socket.on("disconnect",()=>{

        users.delete(socket.id);

        voiceUsers.delete(socket.id);

        io.emit(
            "users",
            Array.from(users.values())
        );
    });
});

// ================= START =================
server.listen(
process.env.PORT || 3000,
()=>{

    console.log("TXTEL RUNNING");
});
