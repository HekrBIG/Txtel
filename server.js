const express=require("express");
const http=require("http");
const {Server}=require("socket.io");
const sqlite3=require("sqlite3").verbose();

const app=express();
const server=http.createServer(app);
const io=new Server(server);

const db=new sqlite3.Database("txtel.db");

const users=new Map();
const vcUsers=new Map();

/* DB */
db.run("CREATE TABLE IF NOT EXISTS messages(id INTEGER PRIMARY KEY,room TEXT,fromUser TEXT,text TEXT,time DATETIME DEFAULT CURRENT_TIMESTAMP)");
db.run("CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY,username TEXT UNIQUE)");

/* ================= FRONTEND ================= */
app.get("/",(req,res)=>{
res.send(`<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>TXTEL</title>
<style>
body{margin:0;font-family:Arial;background:#1e1f22;color:#fff;display:flex;height:100vh}
#sidebar{width:260px;background:#111;padding:10px;overflow:auto}
.section{margin-bottom:10px}
.title{font-weight:bold;margin:10px 0}
.item{padding:6px;background:#2b2d31;margin:4px;border-radius:6px;cursor:pointer}
.item.active{background:#4aa3ff}
.badge{background:red;border-radius:999px;padding:2px 6px;font-size:12px;float:right}
#chat{flex:1;display:flex;flex-direction:column}
#top{padding:10px;background:#111}
#messages{flex:1;overflow:auto;padding:10px}
.msg{background:#2b2d31;margin:5px;padding:6px;border-radius:6px}
#bar{display:flex;gap:6px;padding:10px;background:#111}
input{flex:1;padding:8px;border:none;border-radius:6px;background:#2b2d31;color:#fff}
button{padding:8px;border:none;border-radius:6px;background:#5865f2;color:#fff}
.vcUser{padding:6px;margin:4px;background:#2b2d31;border-radius:6px;font-size:13px}
.small{font-size:10px;opacity:0.7}
</style>
</head>

<body>

<div id="sidebar">

<div class="section">
<div class="title">Chats</div>
<div id="channels"></div>
<button onclick="addChat()">+ Chat</button>
</div>

<div class="section">
<div class="title">Voice</div>
<div id="voiceChannels"></div>
<div id="vcPanel"></div>
<button onclick="addVC()">+ VC</button>
</div>

<div class="section">
<div class="title">Users</div>
<div id="users"></div>
</div>

</div>

<div id="chat">
<div id="top">TXTEL</div>
<div id="messages"></div>

<div id="bar">
<input id="i">
<button onclick="send()">Send</button>
<button id="muteBtn" onclick="muteMic()">🎤</button>
<button id="deafBtn" onclick="deafen()">🎧</button>
</div>
</div>

<script src="/socket.io/socket.io.js"></script>
<script>

const socket=io();

/* LOGIN */
let user=localStorage.getItem("u");
if(!user){
user=prompt("name");
localStorage.setItem("u",user);
}
socket.emit("login",user);

/* STATE */
let room="general";
let chats={};
let unread={};

let stream;
let muted=false;
let deaf=false;
let peers={};

let chatsList=["general"];
let vcList=["General VC"];

/* SEND */
function send(){
socket.emit("msg",{room,text:i.value});
i.value="";
}

/* RECEIVE */
socket.on("msg",d=>{
if(!chats[d.room])chats[d.room]=[];
chats[d.room].push(d);

if(d.room!==room){
unread[d.room]=(unread[d.room]||0)+1;
renderChats();
}

if(d.room===room)render();
});

/* CHAT RENDER */
function render(){
messages.innerHTML="";
(chats[room]||[]).forEach(x=>{
let d=document.createElement("div");
d.className="msg";
d.innerHTML="<b>"+x.from+":</b> "+x.text;
messages.appendChild(d);
});
}

/* CHANNELS */
function renderChats(){
channels.innerHTML="";
chatsList.forEach(c=>{
let d=document.createElement("div");
d.className="item"+(room===c?" active":"");
d.innerHTML=c+(unread[c]?" <span class='badge'>"+unread[c]+"</span>":"");
d.onclick=()=>{room=c;render();renderChats();};
channels.appendChild(d);
});
}

function addChat(){
let n=prompt("chat name");
if(n)chatsList.push(n);
renderChats();
}

/* USERS */
socket.on("users",list=>{
users.innerHTML="";
list.forEach(u=>{
let d=document.createElement("div");
d.className="item";
d.innerText=u;
d.onclick=()=>{room=u;render();};
users.appendChild(d);
});
});

/* VC */
function renderVC(){
voiceChannels.innerHTML="";
vcList.forEach(v=>{
let d=document.createElement("div");
d.className="item";
d.innerText="🔊 "+v;
d.onclick=()=>joinVC(v);
voiceChannels.appendChild(d);
});
}

function addVC(){
let n=prompt("vc name");
if(n)vcList.push(n);
renderVC();
}

/* JOIN VC */
function joinVC(r){
socket.emit("joinVoice",r);

navigator.mediaDevices.getUserMedia({audio:true}).then(s=>{
stream=s;
startSpeak();
});
}

/* VC UPDATE */
socket.on("vcUpdate",list=>{
vcPanel.innerHTML="";

list.forEach(u=>{
let div=document.createElement("div");
div.className="vcUser";

let mic=u.mute?"🔇":"🎤";
let deaf=u.deaf?"🎧":"";
let speak=u.speaking?"📶":"";

div.innerHTML =
"<span>"+mic+" "+deaf+" "+u.name+"</span>"+
"<span class='small'>"+speak+"</span>";

vcPanel.appendChild(div);
});
});

/* SPEAK DETECT */
function startSpeak(){
const ctx=new AudioContext();
const src=ctx.createMediaStreamSource(stream);
const analyser=ctx.createAnalyser();
src.connect(analyser);

const data=new Uint8Array(analyser.fftSize);

function loop(){
analyser.getByteTimeDomainData(data);

let sum=0;
for(let i=0;i<data.length;i++){
sum+=Math.abs(data[i]-128);
}

socket.emit("vcSpeaking",sum>900);
requestAnimationFrame(loop);
}
loop();
}

/* MUTE */
function muteMic(){
muted=!muted;
stream.getAudioTracks().forEach(t=>t.enabled=!muted);
socket.emit("vcMute",muted);
muteBtn.style.background=muted?"red":"#5865f2";
}

/* DEAF */
function deafen(){
deaf=!deaf;
document.querySelectorAll("audio").forEach(a=>a.muted=deaf);
socket.emit("vcDeaf",deaf);
deafBtn.style.background=deaf?"red":"#5865f2";
}

/* INIT */
renderChats();
renderVC();

</script>
</body></html>`);
});

/* ================= SOCKET ================= */
io.on("connection",socket=>{

socket.on("login",u=>{
socket.user=u;
users.set(socket.id,u);
io.emit("users",Array.from(users.values()));
});

socket.on("msg",d=>{
io.emit("msg",{from:socket.user,room:d.room,text:d.text});
});

/* VC JOIN */
socket.on("joinVoice",()=>{
vcUsers.set(socket.id,{
name:socket.user,
mute:false,
deaf:false,
speaking:false
});
io.emit("vcUpdate",Array.from(vcUsers.values()));
});

/* VC STATES */
socket.on("vcMute",v=>{
if(vcUsers.has(socket.id)){
vcUsers.get(socket.id).mute=v;
io.emit("vcUpdate",Array.from(vcUsers.values()));
}
});

socket.on("vcDeaf",v=>{
if(vcUsers.has(socket.id)){
vcUsers.get(socket.id).deaf=v;
io.emit("vcUpdate",Array.from(vcUsers.values()));
}
});

socket.on("vcSpeaking",v=>{
if(vcUsers.has(socket.id)){
vcUsers.get(socket.id).speaking=v;
io.emit("vcUpdate",Array.from(vcUsers.values()));
}
});

socket.on("disconnect",()=>{
users.delete(socket.id);
vcUsers.delete(socket.id);
io.emit("users",Array.from(users.values()));
io.emit("vcUpdate",Array.from(vcUsers.values()));
});
});

server.listen(process.env.PORT||3000,()=>console.log("TXTEL RUNNING"));
