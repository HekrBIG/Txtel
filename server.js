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

app.get("/", (req, res) => {

res.send(`<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Txtel</title>

<style>
body{margin:0;font-family:Arial;background:#1e1f22;color:white;display:flex;height:100vh}
#sidebar{width:240px;background:#111214;padding:10px;overflow:auto}
.channel,.vc,.user{padding:10px;margin:5px 0;border-radius:8px;cursor:pointer;background:#2b2d31}
.channel:hover,.vc:hover,.user:hover{background:#3a3c41}
.active{background:#5865f2!important}
.vc{background:#1f3f2a}
#chat{flex:1;display:flex;flex-direction:column}
#chatTitle{padding:15px;background:#111214;font-size:20px;border-bottom:1px solid #333}
#messages{flex:1;overflow:auto;padding:15px}
.msg{margin:8px 0;padding:8px;background:#2b2d31;border-radius:8px}
#bar{display:flex;gap:5px;padding:10px;background:#1a1b1e}
input,button{padding:10px;border:none;border-radius:6px}
input{flex:1;background:#2b2d31;color:white}
button{background:#5865f2;color:white;cursor:pointer}
.red{background:red!important}
#voiceList{margin-top:10px;font-size:12px;color:#aaa}
.voiceUser{display:flex;align-items:center;justify-content:space-between;margin:3px 0;font-size:12px}
.voiceLeft{display:flex;align-items:center;gap:6px}
.mic{width:10px;height:10px;border-radius:50%;background:#555}
.mic.speaking{background:#4ea1ff;box-shadow:0 0 6px #4ea1ff}
.levels{display:flex;gap:2px}
.bar{width:4px;height:10px;background:#333;border-radius:2px}
.bar.on.green{background:#2ecc71}
.bar.on.orange{background:#f39c12}
.bar.on.red{background:#e74c3c}
</style>
</head>

<body>

<div id="sidebar">

<div id="generalBtn" class="channel active"># general</div>

<div id="voiceBtn" class="vc" onclick="joinVoice()">🔊 VC: General<div id="voiceList"></div></div>

<hr>

<div id="users"></div>

</div>

<div id="chat">

<div id="chatTitle"># general</div>

<div id="messages"></div>

<div id="bar">

<input id="msg" placeholder="Message">
<input type="file" id="file">

<button onclick="send()">Send</button>
<button onclick="uploadFile()">File</button>

<button id="muteBtn" onclick="mute()">Mute</button>
<button id="deafenBtn" onclick="deafen()">Deafen</button>

</div>

</div>

<script src="/socket.io/socket.io.js"></script>
<script src="https://unpkg.com/simple-peer/simplepeer.min.js"></script>

<script>
const socket = io();

let currentChat="general";
let stream;
let peers={};
let muted=false;
let deafened=false;
let voiceState={};

let username=prompt("Username");
let password=prompt("Password");

socket.emit("login",{u:username,p:password});

let chats=JSON.parse(localStorage.getItem("txtelChats")||"{}");

function saveChats(){
localStorage.setItem("txtelChats",JSON.stringify(chats));
}

function renderChat(){
messages.innerHTML="";
if(!chats[currentChat]) chats[currentChat]=[];
chats[currentChat].forEach(m=>{
let div=document.createElement("div");
div.className="msg";
div.innerHTML=m;
messages.appendChild(div);
});
messages.scrollTop=messages.scrollHeight;
}

socket.on("users",list=>{
users.innerHTML="";
list.forEach(u=>{
if(u===username)return;
let d=document.createElement("div");
d.className="user";
d.innerText=u;
d.onclick=()=>{
currentChat=u;
chatTitle.innerText="@ "+u;
document.querySelectorAll(".channel,.user").forEach(x=>x.classList.remove("active"));
d.classList.add("active");
renderChat();
};
users.appendChild(d);
});
});

generalBtn.onclick=()=>{
currentChat="general";
chatTitle.innerText="# general";
document.querySelectorAll(".channel,.user").forEach(x=>x.classList.remove("active"));
generalBtn.classList.add("active");
renderChat();
};

socket.on("message",m=>{
let room="general";
if(m.to&&(m.to===username||m.from===username)){
room=m.from===username?m.to:m.from;
}
if(!chats[room])chats[room]=[];
let html="";
if(m.text)html="<b>"+m.from+":</b> "+m.text;
if(m.file)html="<b>"+m.from+":</b> <a href='"+m.file+"'>File</a>";
chats[room].push(html);
saveChats();
if(room===currentChat)renderChat();
});

function send(){
if(!msg.value)return;
socket.emit("message",{text:msg.value,to:currentChat==="general"?null:currentChat});
msg.value="";
}

document.addEventListener("keydown",e=>{if(e.key==="Enter")send();});

async function uploadFile(){
let f=file.files[0];
if(!f)return;
let form=new FormData();
form.append("file",f);
let res=await fetch("/upload",{method:"POST",body:form});
let data=await res.json();
socket.emit("message",{file:data.url,to:currentChat==="general"?null:currentChat});
}

async function joinVoice(){
if(stream)return;
stream=await navigator.mediaDevices.getUserMedia({audio:true});
socket.emit("joinVoice");

let ctx=new AudioContext();
let source=ctx.createMediaStreamSource(stream);
let analyser=ctx.createAnalyser();
source.connect(analyser);
analyser.fftSize=512;
let data=new Uint8Array(analyser.frequencyBinCount);

function loop(){
analyser.getByteFrequencyData(data);
let v=0;
for(let i=0;i<data.length;i++)v+=data[i];
v=v/data.length;
let level=Math.min(6,Math.floor(v/15));
socket.emit("voiceSpeaking",{speaking:level>0,level});
setTimeout(loop,200);
}
loop();
}

socket.on("voiceUsers",list=>{
voiceList.innerHTML="";
list.forEach(id=>{
if(!voiceState[id])voiceState[id]={speaking:false,level:0};
let d=voiceState[id];
let name=(id===socket.id?"You":id).slice(0,10);
let div=document.createElement("div");
div.className="voiceUser";
let bars="";
for(let i=1;i<=6;i++){
let c="";
if(d.level>=i){
if(d.level<=2)c="green";
else if(d.level<=4)c="orange";
else c="red";
}
bars+= "<div class='bar " + (c ? "on " + c : "") + "'></div>";
}
div.innerHTML="<div class='voiceLeft'><div class='mic "+(d.speaking?"speaking":"")+"'></div>"+name+"</div><div class='levels'>"+bars+"</div>";
voiceList.appendChild(div);
if(id!==socket.id&&stream&&!peers[id])createPeer(id,true);
});
});

socket.on("voiceSignal",d=>{
if(!peers[d.from])createPeer(d.from,false);
peers[d.from].signal(d.signal);
});

function createPeer(id,init){
let peer=new SimplePeer({initiator:init,trickle:false,stream:stream||undefined});
peer.on("signal",sig=>socket.emit("voiceSignal",{to:id,signal:sig}));
peer.on("stream",s=>{
let a=document.createElement("audio");
a.srcObject=s;
a.autoplay=true;
a.muted=deafened;
document.body.appendChild(a);
});
peers[id]=peer;
}

socket.on("voiceSpeakingUpdate",d=>{
voiceState[d.id]={speaking:d.speaking,level:d.level||0};
socket.emit("voiceUsers",Object.keys(voiceState));
});

function mute(){
muted=!muted;
if(stream)stream.getAudioTracks().forEach(t=>t.enabled=!muted);
muteBtn.classList.toggle("red",muted);
muteBtn.innerText=muted?"Unmute":"Mute";
}

function deafen(){
deafened=!deafened;
document.querySelectorAll("audio").forEach(a=>a.muted=deafened);
deafenBtn.classList.toggle("red",deafened);
deafenBtn.innerText=deafened?"Undeafen":"Deafen";
}

renderChat();
</script>

</body>
</html>`);
});

app.post("/upload",upload.single("file"),(req,res)=>{
res.json({url:"/uploads/"+req.file.filename});
});

io.on("connection",socket=>{

const ip=socket.handshake.address;
if(bannedIPs.has(ip))return socket.disconnect();

socket.on("login",({u,p})=>{
db.get("SELECT * FROM users WHERE username=?",[u],(e,row)=>{
if(!row){
bcrypt.hash(p,10,(e,h)=>{
db.run("INSERT INTO users(username,password) VALUES(?,?)",[u,h]);
});
socket.username=u;
users.set(socket.id,u);
io.emit("users",Array.from(users.values()));
return;
}
bcrypt.compare(p,row.password,(e,ok)=>{
if(!ok)return;
socket.username=u;
users.set(socket.id,u);
io.emit("users",Array.from(users.values()));
});
});
});

socket.on("message",d=>{
io.emit("message",{from:socket.username,text:d.text,file:d.file,to:d.to||null});
});

const room="general";

socket.on("joinVoice",()=>{
if(!voiceRooms[room])voiceRooms[room]=new Set();
voiceRooms[room].add(socket.id);
socket.join(room);
io.to(room).emit("voiceUsers",Array.from(voiceRooms[room]));
});

socket.on("voiceSpeaking",d=>{
io.to(room).emit("voiceSpeakingUpdate",{id:socket.id,speaking:d.speaking,level:d.level||0});
});

socket.on("voiceSignal",d=>{
io.to(d.to).emit("voiceSignal",{from:socket.id,signal:d.signal});
});

socket.on("disconnect",()=>{
users.delete(socket.id);
for(const r in voiceRooms){
voiceRooms[r].delete(socket.id);
io.to(r).emit("voiceUsers",Array.from(voiceRooms[r]));
}
io.emit("users",Array.from(users.values()));
});
});

server.listen(process.env.PORT||3000,()=>{
console.log("TXTEL RUNNING");
});
