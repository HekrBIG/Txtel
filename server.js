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
const voiceRooms = new Map(); // room -> Set(socket.id)
const dmRooms = new Map();    // key -> Set(socket.id)
const admins = new Set();

function dmKey(a,b){return [a,b].sort().join("__");}

/* ================= FRONTEND ================= */
app.get("/",(req,res)=>{

res.send(`
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>TXTEL DISCORD</title>
<style>
body{margin:0;font-family:Arial;background:#1e1f22;color:white;display:flex;height:100vh}
#sidebar{width:240px;background:#111;padding:10px;overflow:auto}
#chat{flex:1;display:flex;flex-direction:column}
#messages{flex:1;overflow:auto;padding:10px}
.msg{background:#2b2d31;margin:5px;padding:6px;border-radius:6px}
.user{padding:6px;background:#2b2d31;margin:4px;cursor:pointer}
.room{padding:6px;background:#1f3f2a;margin:4px;cursor:pointer}
.mic{width:10px;height:10px;border-radius:50%;background:#666;display:inline-block}
.mic.speaking{background:#00bfff}
#adminMenu{position:fixed;display:none;background:#222;padding:10px;border:1px solid #444}
</style>
</head>
<body>

<div id="sidebar">
<div class="room" onclick="joinRoom('general')"># general</div>
<div class="room" onclick="joinVoice('vc1')">🔊 VC1</div>
<div class="room" onclick="joinVoice('vc2')">🔊 VC2</div>
<hr>
<div id="users"></div>
</div>

<div id="chat">
<div id="messages"></div>
<input id="msg"><button onclick="send()">Send</button>
</div>

<div id="adminMenu">
<button onclick="kick()">Kick</button>
<button onclick="ban()">Ban</button>
<button onclick="rename()">Rename</button>
</div>

<script src="/socket.io/socket.io.js"></script>
<script src="https://unpkg.com/simple-peer/simplepeer.min.js"></script>

<script>
const socket=io();

let username=prompt("username");
let currentRoom="general";
let selectedUser=null;
let stream;
let peers={};

socket.emit("login",{u:username});

/* CHAT */
function render(){
messages.innerHTML="";
if(!window.chat)window.chat={};
if(!chat[currentRoom])chat[currentRoom]=[];
chat[currentRoom].forEach(m=>{
let d=document.createElement("div");
d.className="msg";
d.innerHTML=m;
messages.appendChild(d);
});
}

socket.on("message",m=>{
let r=m.room;
if(!chat[r])chat[r]=[];
chat[r].push("<b>"+m.from+":</b> "+m.text);
render();
});

/* USERS */
socket.on("users",list=>{
users.innerHTML="";
list.forEach(u=>{
let d=document.createElement("div");
d.className="user";
d.innerText=u;

d.onclick=()=>{
selectedUser=u;
currentRoom=[username,u].sort().join("__");
render();
};

users.appendChild(d);
});
});

/* SEND */
function send(){
socket.emit("message",{text:msg.value,to:currentRoom==="general"?null:currentRoom.split("__").find(x=>x!==username)});
msg.value="";
}

/* ROOMS */
function joinRoom(r){
currentRoom=r;
render();
}

/* VOICE */
async function joinVoice(room){

stream=await navigator.mediaDevices.getUserMedia({audio:true});
socket.emit("joinVoice",room);

const ctx=new AudioContext();
const src=ctx.createMediaStreamSource(stream);
const ana=ctx.createAnalyser();
src.connect(ana);

ana.fftSize=512;
let data=new Uint8Array(ana.frequencyBinCount);

function loop(){
ana.getByteFrequencyData(data);

let v=0;
for(let i=0;i<data.length;i++)v+=data[i];
v/=data.length;

let level=v>60?3:v>30?2:v>10?1:0;

socket.emit("voiceLevel",{room,level});

setTimeout(loop,200);
}
loop();
}

/* SIGNAL */
socket.on("voiceSignal",d=>{
if(!peers[d.from])createPeer(d.from);
peers[d.from].signal(d.signal);
});

function createPeer(id){
let peer=new SimplePeer({initiator:true,trickle:false,stream});
peer.on("signal",sig=>{
socket.emit("voiceSignal",{to:id,signal:sig});
});
peer.on("stream",s=>{
let a=document.createElement("audio");
a.srcObject=s;
a.autoplay=true;
document.body.appendChild(a);
});
peers[id]=peer;
}

/* ADMIN */
document.addEventListener("keydown",e=>{
if(e.key===";")socket.emit("adminOn");
});

document.addEventListener("contextmenu",e=>{
e.preventDefault();
adminMenu.style.display="block";
adminMenu.style.left=e.pageX+"px";
adminMenu.style.top=e.pageY+"px";
});

function kick(){socket.emit("admin",{type:"kick",target:selectedUser});}
function ban(){socket.emit("admin",{type:"ban",target:selectedUser});}
function rename(){socket.emit("admin",{type:"rename",target:selectedUser,newName:prompt("name")});}

render();
</script>

</body>
</html>
`);
});

/* ================= UPLOAD ================= */
app.post("/upload",upload.single("file"),(req,res)=>{
res.json({url:"/uploads/"+req.file.filename});
});

/* ================= SOCKET ================= */
io.on("connection",(socket)=>{

socket.on("login",({u})=>{
socket.username=u;
users.set(socket.id,u);
io.emit("users",[...users.values()]);
});

/* CHAT */
socket.on("message",d=>{
let room=d.to||"general";
io.emit("message",{from:socket.username,text:d.text,room});
});

/* VOICE ROOMS */
socket.on("joinVoice",room=>{
socket.join(room);
if(!voiceRooms.has(room))voiceRooms.set(room,new Set());
voiceRooms.get(room).add(socket.id);
});

socket.on("voiceSignal",d=>{
io.to(d.to).emit("voiceSignal",{from:socket.id,signal:d.signal});
});

/* ADMIN */
socket.on("adminOn",()=>{
admins.add(socket.id);
});

socket.on("admin",d=>{
if(!admins.has(socket.id))return;

for(let [id,name] of users){
if(name===d.target){

if(d.type==="kick"){
io.sockets.sockets.get(id)?.disconnect();
}

if(d.type==="ban"){
users.delete(id);
}

if(d.type==="rename"){
users.set(id,d.newName);
}

io.emit("users",[...users.values()]);
}
}
});

/* DISCONNECT */
socket.on("disconnect",()=>{
users.delete(socket.id);
io.emit("users",[...users.values()]);
});
});

server.listen(process.env.PORT||3000,()=>{
console.log("TXTEL DISCORD RUNNING");
});
