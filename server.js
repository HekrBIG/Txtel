const express=require("express");
const http=require("http");
const {Server}=require("socket.io");

const app=express();
const server=http.createServer(app);

const io=new Server(server,{cors:{origin:"*"}});

/* ================= STATE ================= */

const users=new Map();
const vcUsers=new Map();
const profiles=new Map();

let globalVCs=["General VC"];
let globalChats=["general"];

/* ================= FRONTEND ================= */

app.get("/",(req,res)=>{

res.send(`<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>TXTEL</title>

<style>

body{margin:0;font-family:Arial;background:#1e1f22;color:white;display:flex;height:100vh;overflow:hidden;}

#sidebar{width:300px;background:#0f1012;padding:12px;overflow:auto;border-right:1px solid #222;}

.section{margin-bottom:15px;}

.title{font-size:13px;opacity:0.7;margin-bottom:8px;}

.item{background:#232428;padding:10px;border-radius:10px;margin:5px 0;cursor:pointer;}

.item:hover{background:#313338;}

.active{background:#4aa3ff!important;}

.badge{background:red;padding:2px 6px;border-radius:10px;font-size:10px;float:right;}

#chat{flex:1;display:flex;flex-direction:column;}

#top{padding:14px;background:#111214;font-size:18px;}

#messages{flex:1;overflow:auto;padding:10px;}

.msg{background:#2b2d31;padding:8px;margin:5px 0;border-radius:8px;}

#bar{display:flex;gap:6px;padding:10px;background:#111214;}

input{flex:1;padding:10px;border:none;border-radius:8px;background:#2b2d31;color:white;}

button{padding:10px;border:none;border-radius:8px;background:#5865f2;color:white;cursor:pointer;}

.vcUser{
background:#232428;
padding:8px;
border-radius:10px;
margin:6px 0;
display:flex;
justify-content:space-between;
align-items:center;
}

.pfp{width:35px;height:35px;border-radius:50%;}

.small{font-size:10px;opacity:0.7;}

audio{display:none;}

</style>
</head>

<body>

<div id="sidebar">

<div class="section">
<div class="title">TEXT CHANNELS</div>
<div id="channels"></div>
<button onclick="addChat()">+ Chat</button>
</div>

<div class="section">
<div class="title">VOICE CHANNELS</div>
<div id="voiceChannels"></div>
<div id="vcPanel"></div>
<button onclick="addVC()">+ VC</button>
</div>

<div class="section">
<div class="title">PROFILE</div>

<img id="myPfp" style="width:50px;height:50px;border-radius:50%;margin-bottom:6px;">

<input id="pfpInput" placeholder="PFP URL">
<input id="descInput" placeholder="Status">

<button onclick="saveProfile()">Save</button>
</div>

<div class="section">
<div class="title">USERS</div>
<div id="users"></div>
</div>

</div>

<div id="chat">

<div id="top"># general</div>
<div id="messages"></div>

<div id="bar">
<input id="msgInput">
<button onclick="send()">Send</button>
<button id="muteBtn" onclick="muteMic()">🎤</button>
<button id="deafBtn" onclick="deafen()">🎧</button>
</div>

</div>

<script src="/socket.io/socket.io.js"></script>

<script>

const socket=io();

/* ================= LOGIN ================= */

let username=localStorage.getItem("txtelUser");
if(!username){
username=prompt("Username")||("user"+Math.floor(Math.random()*9999));
localStorage.setItem("txtelUser",username);
}
socket.emit("login",username);

/* ================= STATE ================= */

let currentRoom="general";
let currentVC=null;

let chats={};
let unread={};

let textChannels=[];
let vcList=[];

let localStream=null;
let peers={};

let muted=false;
let deafened=false;

/* ================= SEND ================= */

function send(){
const t=msgInput.value.trim();
if(!t) return;

socket.emit("message",{room:currentRoom,text:t});
msgInput.value="";
}

msgInput.addEventListener("keydown",e=>{
if(e.key==="Enter") send();
});

/* ================= CHAT ================= */

socket.on("chatList",list=>{
textChannels=list;
renderChats();
});

function renderChats(){
channels.innerHTML="";
textChannels.forEach(c=>{
const d=document.createElement("div");
d.className="item";
if(c===currentRoom)d.classList.add("active");

d.innerText="# "+c;

d.onclick=()=>{
currentRoom=c;
top.innerText="# "+c;
renderChats();
renderMessages();
};

channels.appendChild(d);
});
}

/* ================= VC ================= */

socket.on("vcList",list=>{
vcList=list;
renderVC();
});

function renderVC(){
voiceChannels.innerHTML="";
vcList.forEach(v=>{
const d=document.createElement("div");
d.className="item";
if(v===currentVC)d.classList.add("active");

d.innerText="🔊 "+v;

d.onclick=()=>joinVC(v);

voiceChannels.appendChild(d);
});
}

function addVC(){
const n=prompt("VC name");
if(!n) return;
socket.emit("createVC",n);
}

/* ================= MESSAGES ================= */

socket.on("message",m=>{
if(!chats[m.room]) chats[m.room]=[];
chats[m.room].push(m);
if(m.room===currentRoom) renderMessages();
});

function renderMessages(){
messages.innerHTML="";
(chats[currentRoom]||[]).forEach(m=>{
const d=document.createElement("div");
d.className="msg";
d.innerHTML="<b>"+m.from+":</b> "+m.text;
messages.appendChild(d);
});
}

/* ================= USERS ================= */

socket.on("users",list=>{
users.innerHTML="";
list.forEach(u=>{
const d=document.createElement("div");
d.className="item";
d.innerText=u;
users.appendChild(d);
});
});

/* ================= PROFILE ================= */

function saveProfile(){
socket.emit("updateProfile",{
pfp:pfpInput.value,
desc:descInput.value
});
}

socket.on("profiles",data=>{
const p=data.find(x=>x[0]===socket.id);
if(!p) return;
myPfp.src=p[1].pfp;
});

/* ================= VC JOIN ================= */

async function joinVC(room){
currentVC=room;
renderVC();

if(!localStream){
localStream=await navigator.mediaDevices.getUserMedia({audio:true});
startSpeak();
}

socket.emit("joinVC",room);
}

/* ================= WEBRTC ================= */

socket.on("allUsers",list=>{
list.forEach(id=>createPeer(id,true));
});

socket.on("userJoined",id=>{
createPeer(id,false);
});

function createPeer(id,init){

if(peers[id]) return peers[id];

const pc=new RTCPeerConnection({
iceServers:[{urls:"stun:stun.l.google.com:19302"}]
});

peers[id]=pc;

localStream?.getTracks().forEach(t=>pc.addTrack(t,localStream));

pc.ontrack=e=>{
let a=document.getElementById("a-"+id);
if(!a){
a=document.createElement("audio");
a.id="a-"+id;
a.autoplay=true;
document.body.appendChild(a);
}
a.srcObject=e.streams[0];
};

pc.onicecandidate=e=>{
if(e.candidate){
socket.emit("iceCandidate",{to:id,candidate:e.candidate});
}
};

if(init){
pc.createOffer().then(o=>pc.setLocalDescription(o)).then(()=>{
socket.emit("offer",{to:id,offer:pc.localDescription});
});
}

return pc;
}

/* ================= SIGNAL ================= */

socket.on("offer",async d=>{
const pc=createPeer(d.from,false);
await pc.setRemoteDescription(d.offer);
const ans=await pc.createAnswer();
await pc.setLocalDescription(ans);
socket.emit("answer",{to:d.from,answer:ans});
});

socket.on("answer",d=>{
peers[d.from]?.setRemoteDescription(d.answer);
});

socket.on("iceCandidate",d=>{
peers[d.from]?.addIceCandidate(d.candidate);
});

/* ================= MUTE ================= */

function muteMic(){

if(!localStream) return;

muted=!muted;

localStream.getAudioTracks().forEach(t=>{
t.enabled=!muted;
});

muteBtn.style.background=muted?"red":"#5865f2";
muteBtn.innerText=muted?"🔇":"🎤";

socket.emit("vcState",{type:"mute",state:muted});
}

function deafen(){

deafened=!deafened;

document.querySelectorAll("audio").forEach(a=>{
a.muted=deafened;
});

deafBtn.style.background=deafened?"red":"#5865f2";
deafBtn.innerText=deafened?"🔇":"🎧";

socket.emit("vcState",{type:"deafen",state:deafened});
}

/* ================= SPEAK ================= */

function startSpeak(){
const ctx=new AudioContext();
const src=ctx.createMediaStreamSource(localStream);
const a=new AnalyserNode(ctx);
src.connect(a);

const data=new Uint8Array(a.fftSize);

function loop(){
a.getByteTimeDomainData(data);
let s=0;
for(let i=0;i<data.length;i++) s+=Math.abs(data[i]-128);
socket.emit("speaking",s>900);
requestAnimationFrame(loop);
}
loop();
}

</script>

</body>
</html>`);
});

/* ================= SOCKET ================= */

io.on("connection",socket=>{

socket.on("login",name=>{
socket.username=name;
users.set(socket.id,name);

if(!profiles.has(socket.id)){
profiles.set(socket.id,{
name,
pfp:"https://i.imgur.com/1X4Q9.png",
desc:"No status"
});
}

socket.emit("vcList",globalVCs);
socket.emit("chatList",globalChats);

io.emit("users",Array.from(users.values()));
});

/* CHAT */

socket.on("message",m=>{
io.emit("message",{from:socket.username,room:m.room,text:m.text});
});

/* VC */

socket.on("createVC",n=>{
if(!globalVCs.includes(n)) globalVCs.push(n);
io.emit("vcList",globalVCs);
});

/* PROFILE */

socket.on("updateProfile",data=>{
const p=profiles.get(socket.id);
if(!p) return;

p.pfp=data.pfp||p.pfp;
p.desc=data.desc||p.desc;

profiles.set(socket.id,p);

io.emit("profiles",Array.from(profiles.entries()));
});

/* VC JOIN */

socket.on("joinVC",room=>{
socket.join(room);

vcUsers.set(socket.id,{
name:socket.username,
room,
muted:false,
deafened:false,
speaking:false
});

const list=[...(io.sockets.adapter.rooms.get(room)||[])].filter(x=>x!==socket.id);

socket.emit("allUsers",list);
socket.to(room).emit("userJoined",socket.id);
});

/* SIGNAL */

socket.on("offer",d=>{
io.to(d.to).emit("offer",{from:socket.id,offer:d.offer});
});

socket.on("answer",d=>{
io.to(d.to).emit("answer",{from:socket.id,answer:d.answer});
});

socket.on("iceCandidate",d=>{
io.to(d.to).emit("iceCandidate",{from:socket.id,candidate:d.candidate});
});

/* VC STATE */

socket.on("vcState",d=>{
const u=vcUsers.get(socket.id);
if(!u) return;

if(d.type==="mute") u.muted=d.state;
if(d.type==="deafen") u.deafened=d.state;

vcUsers.set(socket.id,u);
});

/* DISCONNECT */

socket.on("disconnect",()=>{
users.delete(socket.id);
vcUsers.delete(socket.id);
io.emit("users",Array.from(users.values()));
});
});

server.listen(process.env.PORT||3000,()=>{
console.log("TXTEL RUNNING");
});
