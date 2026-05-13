const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const bcrypt = require("bcrypt");
const sqlite3 = require("sqlite3").verbose();
const multer = require("multer");
const fs = require("fs");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// ================= FILES =================
if (!fs.existsSync("./uploads")) fs.mkdirSync("./uploads");

// ================= DB =================
const db = new sqlite3.Database("./txtel.db");

db.run(`CREATE TABLE IF NOT EXISTS users (
id INTEGER PRIMARY KEY AUTOINCREMENT,
username TEXT UNIQUE,
password TEXT
)`);

db.run(`CREATE TABLE IF NOT EXISTS messages (
id INTEGER PRIMARY KEY AUTOINCREMENT,
sender TEXT,
receiver TEXT,
text TEXT,
file TEXT,
time DATETIME DEFAULT CURRENT_TIMESTAMP
)`);

// ================= UPLOAD =================
const storage = multer.diskStorage({
    destination: "./uploads",
    filename: (req,file,cb)=>{
        cb(null, Date.now()+"-"+file.originalname);
    }
});
const upload = multer({ storage });

app.use("/uploads", express.static("uploads"));

// ================= STATE =================
const users = new Map();
const bannedIPs = new Set();

const ADMIN_KEY = "Txtel223";

// ================= FRONTEND =================
app.get("/", (req,res)=>{
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
}

#sidebar{
width:220px;
background:#111;
padding:10px;
}

.user{
padding:8px;
margin:5px 0;
background:#2b2d31;
border-radius:6px;
cursor:pointer;
}

#chat{
flex:1;
display:flex;
flex-direction:column;
}

#messages{
flex:1;
overflow:auto;
padding:10px;
}

.msg{
margin:5px 0;
}

#bar{
display:flex;
gap:5px;
padding:10px;
background:#2b2d31;
}

input,button{
padding:8px;
}

/* mobile */
@media(max-width:768px){
#sidebar{width:120px;font-size:12px;}
#bar{flex-direction:column;}
input,button{width:100%;}
}
</style>
</head>

<body>

<div id="sidebar"></div>

<div id="chat">
<div id="messages"></div>

<div id="bar">
<input id="msg" placeholder="message">
<input type="file" id="file">
<button onclick="send()">Send</button>
<button onclick="upload()">File</button>
<button onclick="joinVoice()">Voice</button>
<button onclick="mute()">Mute</button>
<button onclick="deafen()">Deafen</button>
</div>
</div>

<script src="/socket.io/socket.io.js"></script>
<script src="https://unpkg.com/simple-peer/simplepeer.min.js"></script>

<script>
const socket = io();

let me;
let target;
let stream;
let peers = {};
let muted=false;
let deafened=false;

// ================= LOGIN =================
let u = prompt("username");
let p = prompt("password");

socket.emit("login",{u,p});

// ================= USERS =================
socket.on("users",list=>{
sidebar.innerHTML="";
list.forEach(x=>{
const d=document.createElement("div");
d.className="user";
d.innerText=x;
d.onclick=()=>target=x;
sidebar.appendChild(d);
});
});

// ================= CHAT =================
socket.on("message",m=>{
const div=document.createElement("div");
div.className="msg";

if(m.text){
div.innerHTML="<b>"+m.from+":</b> "+m.text;
}

if(m.file){
div.innerHTML="<b>"+m.from+":</b> <a href='"+m.file+"' target='_blank'>file</a>";
}

messages.appendChild(div);
messages.scrollTop=messages.scrollHeight;
});

// ENTER SEND
document.addEventListener("keydown",e=>{
if(e.key==="Enter") send();
});

function send(){
socket.emit("message",{text:msg.value,to:target});
msg.value="";
}

// ================= FILE UPLOAD =================
async function upload(){
const f=file.files[0];
const form=new FormData();
form.append("file",f);

const res=await fetch("/upload",{method:"POST",body:form});
const data=await res.json();

socket.emit("message",{file:data.url});
}

// ================= VOICE =================
async function joinVoice(){
stream=await navigator.mediaDevices.getUserMedia({audio:true});
createPeer("self",true);

socket.on("voiceSignal",data=>{
if(!peers[data.from]){
createPeer(data.from,false);
}
peers[data.from].signal(data.signal);
});
}

function createPeer(id,init){
const peer=new SimplePeer({
initiator:init,
trickle:false,
stream
});

peer.on("signal",s=>{
socket.emit("voiceSignal",{room:"general",signal:s});
});

peer.on("stream",s=>{
const a=document.createElement("audio");
a.srcObject=s;
a.autoplay=true;
a.muted=deafened;
document.body.appendChild(a);
});

peers[id]=peer;
}

// ================= AUDIO CTRL =================
function mute(){
muted=!muted;
stream.getAudioTracks().forEach(t=>t.enabled=!muted);
}

function deafen(){
deafened=!deafened;
document.querySelectorAll("audio").forEach(a=>a.muted=deafened);
}
</script>

</body>
</html>
`);
});

// ================= UPLOAD =================
app.post("/upload",upload.single("file"),(req,res)=>{
res.json({url:"/uploads/"+req.file.filename});
});

// ================= SOCKET =================
io.on("connection",socket=>{

const ip=socket.handshake.address;
if(bannedIPs.has(ip)) return socket.disconnect();

// LOGIN (simple)
socket.on("login",({u,p})=>{

db.get("SELECT * FROM users WHERE username=?",[u],(err,row)=>{

if(!row){
bcrypt.hash(p,10,(err,h)=>{
db.run("INSERT INTO users VALUES(NULL,?,?)",[u,h]);
});
socket.username=u;
users.set(socket.id,u);
io.emit("users",Array.from(users.values()));
return;
}

bcrypt.compare(p,row.password,(err,ok)=>{
if(!ok) return;

socket.username=u;
users.set(socket.id,u);

io.emit("users",Array.from(users.values()));
});
});
});

// MESSAGE
socket.on("message",data=>{
io.emit("message",{from:socket.username,text:data.text,file:data.file});
});

// VOICE
socket.on("voiceSignal",data=>{
socket.to(data.room).emit("voiceSignal",{from:socket.id,signal:data.signal});
});

// ADMIN COMMANDS
socket.on("admin",(cmd)=>{
if(cmd==="!ipban") bannedIPs.add(ip);
});

socket.on("disconnect",()=>{
users.delete(socket.id);
io.emit("users",Array.from(users.values()));
});
});

// ================= START =================
server.listen(process.env.PORT||3000,()=>{
console.log("TXTEL FINISHED RUNNING");
});
