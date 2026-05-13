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

.channel,
.vc,
.user{
    padding:10px;
    margin:5px 0;
    border-radius:8px;
    cursor:pointer;
    background:#2b2d31;
    transition:0.2s;
}

.channel:hover,
.vc:hover,
.user:hover{
    background:#3a3c41;
}

.active{
    background:#5865f2 !important;
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

#chatTitle{
    padding:15px;
    background:#111214;
    font-size:20px;
    border-bottom:1px solid #333;
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

/* ACTIVE BUTTONS */
.red{
    background:red !important;
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

<div id="generalBtn"
class="channel active">
# general
</div>

<div id="voiceBtn"
class="vc"
onclick="joinVoice()">
🔊 VC: General
</div>

<hr>

<div id="users"></div>

</div>

<div id="chat">

<div id="chatTitle">
# general
</div>

<div id="messages"></div>

<div id="bar">

<input id="msg"
placeholder="Message">

<input type="file" id="file">

<button onclick="send()">
Send
</button>

<button onclick="uploadFile()">
File
</button>

<button id="muteBtn"
onclick="mute()">
Mute
</button>

<button id="deafenBtn"
onclick="deafen()">
Deafen
</button>

</div>

</div>

<script src="/socket.io/socket.io.js"></script>
<script src="https://unpkg.com/simple-peer/simplepeer.min.js"></script>

<script>

const socket = io();

let currentChat = "general";

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

// ================= CHAT STORAGE =================
let chats =
JSON.parse(
localStorage.getItem("txtelChats")
|| "{}"
);

function saveChats(){

    localStorage.setItem(
        "txtelChats",
        JSON.stringify(chats)
    );
}

function renderChat(){

    messages.innerHTML = "";

    if(!chats[currentChat]){
        chats[currentChat] = [];
    }

    chats[currentChat].forEach(m=>{

        const div =
            document.createElement("div");

        div.className = "msg";

        div.innerHTML = m;

        messages.appendChild(div);
    });

    messages.scrollTop =
        messages.scrollHeight;
}

// ================= USERS =================
socket.on("users",(list)=>{

    users.innerHTML = "";

    list.forEach(u=>{

        if(u === username) return;

        const d =
            document.createElement("div");

        d.className = "user";

        d.innerText = u;

        d.onclick = ()=>{

            currentChat = u;

            chatTitle.innerText =
                "@ " + u;

            document
            .querySelectorAll(
                ".channel,.user"
            )
            .forEach(x=>{

                x.classList.remove("active");
            });

            d.classList.add("active");

            renderChat();
        };

        users.appendChild(d);
    });
});

// ================= GENERAL =================
generalBtn.onclick = ()=>{

    currentChat = "general";

    chatTitle.innerText =
        "# general";

    document
    .querySelectorAll(
        ".channel,.user"
    )
    .forEach(x=>{

        x.classList.remove("active");
    });

    generalBtn.classList.add("active");

    renderChat();
};

// ================= RECEIVE MESSAGE =================
socket.on("message",(m)=>{

    let room = "general";

    if(
        m.to &&
        (
            m.to === username ||
            m.from === username
        )
    ){
        room =
            m.from === username
            ? m.to
            : m.from;
    }

    if(!chats[room]){
        chats[room] = [];
    }

    let html = "";

    if(m.text){

        html =
        "<b>"+m.from+":</b> "+
        m.text;
    }

    if(m.file){

        html =
        "<b>"+m.from+":</b> "+
        "<a href='"+m.file+
        "' target='_blank'>File</a>";
    }

    chats[room].push(html);

    saveChats();

    if(room === currentChat){

        renderChat();
    }
});

// ================= SEND =================
function send(){

    if(!msg.value) return;

    socket.emit("message",{
        text:msg.value,
        to:
            currentChat === "general"
            ? null
            : currentChat
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

    const res =
        await fetch("/upload",{
            method:"POST",
            body:form
        });

    const data =
        await res.json();

    socket.emit("message",{
        file:data.url,
        to:
            currentChat === "general"
            ? null
            : currentChat
    });
}

// ================= VOICE =================

async function joinVoice(){

    if(stream) return;

    stream =
        await navigator.mediaDevices
        .getUserMedia({
            audio:true
        });

    socket.emit("joinVoice");
}

// users in vc
socket.on("voiceUsers",(users)=>{

    users.forEach(id=>{

        if(id === socket.id) return;

        if(peers[id]) return;

        createPeer(id,true);
    });
});

// incoming signal
socket.on("voiceSignal",(data)=>{

    if(!peers[data.from]){

        createPeer(
            data.from,
            false
        );
    }

    peers[data.from]
    .signal(data.signal);
});

// create peer
function createPeer(
    id,
    initiator
){

    const peer =
        new SimplePeer({

        initiator,

        trickle:false,

        stream
    });

    peer.on("signal",(signal)=>{

        socket.emit(
            "voiceSignal",
            {
                to:id,
                signal
            }
        );
    });

    peer.on("stream",(remoteStream)=>{

        const audio =
            document.createElement(
                "audio"
            );

        audio.srcObject =
            remoteStream;

        audio.autoplay = true;

        audio.muted = deafened;

        document.body
        .appendChild(audio);
    });

    peers[id] = peer;
}

// ================= MUTE =================
function mute(){

    muted = !muted;

    if(stream){

        stream.getAudioTracks()
        .forEach(t=>{

            t.enabled = !muted;
        });
    }

    if(muted){

        muteBtn.classList.add(
            "red"
        );

        muteBtn.innerText =
            "Unmute";

    }else{

        muteBtn.classList.remove(
            "red"
        );

        muteBtn.innerText =
            "Mute";
    }
}

// ================= DEAFEN =================
function deafen(){

    deafened = !deafened;

    document
    .querySelectorAll("audio")
    .forEach(a=>{

        a.muted = deafened;
    });

    if(deafened){

        deafenBtn.classList.add(
            "red"
        );

        deafenBtn.innerText =
            "Undeafen";

    }else{

        deafenBtn.classList.remove(
            "red"
        );

        deafenBtn.innerText =
            "Deafen";
    }
}

// ================= START =================
renderChat();

</script>

</body>
</html>
`);
});

// ================= FILE UPLOAD =================
app.post(
"/upload",
upload.single("file"),
(req,res)=>{

    res.json({
        url:
        "/uploads/" +
        req.file.filename
    });
});

// ================= SOCKET =================
io.on("connection",(socket)=>{

    const ip =
        socket.handshake.address;

    if(bannedIPs.has(ip)){
        return socket.disconnect();
    }

    // LOGIN
    socket.on("login",({u,p})=>{

        db.get(
            "SELECT * FROM users WHERE username=?",
            [u],
            (err,row)=>{

            // REGISTER
            if(!row){

                bcrypt.hash(
                    p,
                    10,
                    (err,hash)=>{

                    db.run(
                        "INSERT INTO users(username,password) VALUES(?,?)",
                        [u,hash]
                    );
                });

                socket.username = u;

                users.set(
                    socket.id,
                    u
                );

                io.emit(
                    "users",
                    Array.from(
                        users.values()
                    )
                );

                return;
            }

            // LOGIN
            bcrypt.compare(
                p,
                row.password,
                (err,ok)=>{

                if(!ok) return;

                socket.username = u;

                users.set(
                    socket.id,
                    u
                );

                io.emit(
                    "users",
                    Array.from(
                        users.values()
                    )
                );
            });
        });
    });

    // MESSAGE
    socket.on("message",(data)=>{

        const msgData = {

            from:
                socket.username,

            text:
                data.text,

            file:
                data.file,

            to:
                data.to || null
        };

        io.emit(
            "message",
            msgData
        );
    });

    // ================= VOICE =================

    socket.on("joinVoice",()=>{

        voiceUsers.add(socket.id);

        io.emit(
            "voiceUsers",
            Array.from(voiceUsers)
        );
    });

    socket.on(
    "voiceSignal",
    (data)=>{

        io.to(data.to).emit(
            "voiceSignal",
            {
                from:socket.id,
                signal:data.signal
            }
        );
    });

    // DISCONNECT
    socket.on("disconnect",()=>{

        users.delete(
            socket.id
        );

        voiceUsers.delete(
            socket.id
        );

        io.emit(
            "users",
            Array.from(
                users.values()
            )
        );
    });
});

// ================= START =================
server.listen(
process.env.PORT || 3000,
()=>{

    console.log(
        "TXTEL RUNNING"
    );
});
