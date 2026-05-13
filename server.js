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

if (!fs.existsSync("./uploads")) fs.mkdirSync("./uploads");

const db = new sqlite3.Database("./txtel.db");

db.run(`
CREATE TABLE IF NOT EXISTS users (
id INTEGER PRIMARY KEY AUTOINCREMENT,
username TEXT UNIQUE,
password TEXT
)
`);

const upload = multer({
    storage: multer.diskStorage({
        destination: "./uploads",
        filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname)
    })
});

app.use("/uploads", express.static("uploads"));

const users = new Map();
const voiceUsers = new Set();

function dmKey(a, b) {
    return [a, b].sort().join("__");
}

/* ================= FRONTEND ================= */
app.get("/", (req, res) => {

res.send(`
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>TXTEL</title>
<style>
body{margin:0;font-family:Arial;background:#1e1f22;color:white;display:flex;height:100vh}
#sidebar{width:220px;background:#111;padding:10px;overflow:auto}
#chat{flex:1;display:flex;flex-direction:column}
#messages{flex:1;overflow:auto;padding:10px}
.msg{background:#2b2d31;margin:5px;padding:6px;border-radius:6px}
.user{padding:6px;background:#2b2d31;margin:4px;cursor:pointer}
.vc{padding:6px;background:#1f3f2a;margin:4px;cursor:pointer}
#bar{display:flex}
input{flex:1;padding:8px}
button{padding:8px}
</style>
</head>
<body>

<div id="sidebar">
<div id="generalBtn" class="vc"># general voice</div>
<hr>
<div id="users"></div>
</div>

<div id="chat">
<div id="messages"></div>
<div id="bar">
<input id="msg">
<button onclick="send()">Send</button>
</div>
</div>

<script src="/socket.io/socket.io.js"></script>
<script src="https://unpkg.com/simple-peer/simplepeer.min.js"></script>

<script>
const socket = io();

let username = prompt("username");
let password = prompt("password");

let currentChat = "general";
let chats = JSON.parse(localStorage.getItem("txtel")||"{}");

let stream;
let peers = {};

socket.emit("login",{u:username,p:password});

function render(){
messages.innerHTML="";
if(!chats[currentChat]) chats[currentChat]=[];
chats[currentChat].forEach(m=>{
let d=document.createElement("div");
d.className="msg";
d.innerHTML=m;
messages.appendChild(d);
});
}

socket.on("users",list=>{
users.innerHTML="";
list.forEach(u=>{
if(u===username)return;
let d=document.createElement("div");
d.className="user";
d.innerText=u;

d.onclick=()=>{
currentChat=[username,u].sort().join("__");
render();
};

users.appendChild(d);
});
});

generalBtn.onclick=()=>{
currentChat="general";
render();
};

socket.on("message",m=>{
let room=m.room;
if(!chats[room]) chats[room]=[];
let html="";
if(m.text) html="<b>"+m.from+":</b> "+m.text;
chats[room].push(html);
localStorage.setItem("txtel",JSON.stringify(chats));
if(room===currentChat) render();
});

function send(){
if(!msg.value)return;

socket.emit("message",{
text:msg.value,
to:currentChat==="general"?null:currentChat.split("__").find(x=>x!==username)
});

msg.value="";
}

document.addEventListener("keydown",e=>{
if(e.key==="Enter")send();
});

/* ================= VOICE ================= */

async function joinVoice(){

stream = await navigator.mediaDevices.getUserMedia({audio:true});
socket.emit("joinVoice");

const ctx = new AudioContext();
const src = ctx.createMediaStreamSource(stream);
const analyser = ctx.createAnalyser();

src.connect(analyser);
analyser.fftSize = 512;

const data = new Uint8Array(analyser.frequencyBinCount);

function loop(){
analyser.getByteFrequencyData(data);

let v=0;
for(let i=0;i<data.length;i++)v+=data[i];
v/=data.length;

let level=0;
if(v>5)level=1;
if(v>15)level=2;
if(v>30)level=3;
if(v>50)level=4;
if(v>70)level=5;

socket.emit("voiceSpeaking",{speaking:level>0,level});
setTimeout(loop,200);
}

loop();
}

socket.on("voiceUsers",list=>{
console.log("voice:",list);
});

socket.on("voiceSignal",d=>{
if(!peers[d.from])createPeer(d.from,false);
peers[d.from].signal(d.signal);
});

function createPeer(id,initiator){

const peer=new SimplePeer({
initiator,
trickle:false,
stream
});

peer.on("signal",sig=>{
socket.emit("voiceSignal",{to:id,signal:sig});
});

peer.on("stream",s=>{
const a=document.createElement("audio");
a.srcObject=s;
a.autoplay=true;
document.body.appendChild(a);
});

peers[id]=peer;
}

</script>

</body>
</html>
`);
});

/* ================= UPLOAD ================= */
app.post("/upload", upload.single("file"), (req,res)=>{
res.json({url:"/uploads/"+req.file.filename});
});

/* ================= SOCKET ================= */
io.on("connection",(socket)=>{

socket.on("login",({u,p})=>{

db.get("SELECT * FROM users WHERE username=?",[u],(e,r)=>{

if(!r){
db.run("INSERT INTO users(username,password) VALUES(?,?)",[u,p]);
socket.username=u;
users.set(socket.id,u);
io.emit("users",[...users.values()]);
return;
}

socket.username=u;
users.set(socket.id,u);
io.emit("users",[...users.values()]);
});
});

socket.on("message",(d)=>{

let room=d.to?dmKey(socket.username,d.to):"general";

io.emit("message",{
from:socket.username,
text:d.text,
room
});
});

socket.on("joinVoice",()=>{
voiceUsers.add(socket.id);
io.emit("voiceUsers",[...voiceUsers]);
});

socket.on("voiceSignal",(d)=>{
io.to(d.to).emit("voiceSignal",{from:socket.id,signal:d.signal});
});

socket.on("disconnect",()=>{
users.delete(socket.id);
voiceUsers.delete(socket.id);
io.emit("users",[...users.values()]);
});
});

server.listen(process.env.PORT||3000,()=>{
console.log("TXTEL RUNNING");
});
