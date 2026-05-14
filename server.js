const express=require("express");
const http=require("http");
const {Server}=require("socket.io");
const multer=require("multer");
const path=require("path");
const fs=require("fs");

const app=express();
const server=http.createServer(app);

const io=new Server(server,{
cors:{origin:"*"}
});

/* ================= FILES ================= */

if(!fs.existsSync("uploads")){
fs.mkdirSync("uploads");
}

app.use("/uploads",express.static("uploads"));

const storage=multer.diskStorage({

destination:(req,file,cb)=>{
cb(null,"uploads/");
},

filename:(req,file,cb)=>{

cb(
null,
Date.now()+
path.extname(file.originalname)
);

}

});

const upload=multer({storage});

app.post("/upload",upload.single("file"),(req,res)=>{

res.json({
url:"/uploads/"+req.file.filename
});

});

/* ================= STATE ================= */

const users=new Map();
const vcStates=new Map();

let globalChats=["general"];
let globalVCs=["General VC"];

/* ================= APP ================= */

app.get("/",(req,res)=>{

res.send(`<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>TXTEL</title>

<style>

body{
margin:0;
font-family:Arial;
background:#1e1f22;
color:white;
display:flex;
height:100vh;
overflow:hidden;
}

#sidebar{
width:280px;
background:#0f1012;
padding:10px;
box-sizing:border-box;
border-right:1px solid #222;
overflow:auto;
}

.section{
margin-bottom:20px;
}

.title{
font-size:12px;
opacity:0.7;
margin-bottom:8px;
}

.item{
background:#232428;
padding:10px;
border-radius:10px;
margin:5px 0;
cursor:pointer;
transition:0.15s;
}

.item:hover{
background:#313338;
}

.active{
background:#4aa3ff!important;
}

#chat{
flex:1;
display:flex;
flex-direction:column;
}

#top{
padding:15px;
background:#111214;
font-size:20px;
border-bottom:1px solid #222;
}

#messages{
flex:1;
overflow:auto;
padding:10px;
}

.msg{
background:#2b2d31;
padding:8px;
border-radius:8px;
margin:5px 0;
word-break:break-word;
}

.msg img{
max-width:300px;
border-radius:10px;
margin-top:6px;
}

#bar{
display:flex;
gap:6px;
padding:10px;
background:#111214;
}

input{
flex:1;
padding:10px;
border:none;
border-radius:8px;
background:#2b2d31;
color:white;
}

button{
padding:10px;
border:none;
border-radius:8px;
background:#5865f2;
color:white;
cursor:pointer;
}

.vcMember{
background:#232428;
padding:8px;
border-radius:10px;
margin:5px 0;
display:flex;
justify-content:space-between;
align-items:center;
}

.speaking{
box-shadow:0 0 10px #4aa3ff;
}

.iconRow{
display:flex;
gap:4px;
}

#userPanel{
position:fixed;
bottom:0;
left:0;
width:280px;
background:#111214;
border-top:1px solid #222;
padding:10px;
box-sizing:border-box;
}

#controls{
display:flex;
gap:6px;
}

#controls button{
flex:1;
}

video{
width:250px;
border-radius:10px;
margin:10px;
background:black;
}

audio{
display:none;
}

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

<div id="vcUsers"></div>

<button onclick="addVC()">+ VC</button>

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

<input id="msgInput" placeholder="message">

<input type="file" id="fileInput" hidden>

<button onclick="fileInput.click()">📎</button>

<button onclick="send()">Send</button>

<button onclick="startScreen()">🖥</button>

</div>

</div>

<div id="userPanel">

<div id="vcNameSmall">Not connected</div>

<div id="controls">

<button id="muteBtn" onclick="muteMic()">🎤</button>

<button id="deafBtn" onclick="deafen()">🎧</button>

<button onclick="leaveVC()" style="background:red;">
Leave
</button>

</div>

</div>

<script src="/socket.io/socket.io.js"></script>

<script>

const socket=io();

let username=localStorage.getItem("txtelUser");

if(!username){

username=prompt("Username");

if(!username){
username="user"+Math.floor(Math.random()*9999);
}

localStorage.setItem("txtelUser",username);

}

socket.emit("login",username);

/* ================= STATE ================= */

let currentRoom="general";
let currentVC=null;

let chats={};

let textChannels=[];
let vcChannels=[];

let peers={};

let localStream=null;

let muted=false;
let deafened=false;

/* ================= CHAT ================= */

socket.on("chatList",list=>{

textChannels=list;

renderChats();

});

function renderChats(){

channels.innerHTML="";

textChannels.forEach(c=>{

let d=document.createElement("div");

d.className="item";

if(c===currentRoom){
d.classList.add("active");
}

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

function addChat(){

let n=prompt("Chat name");

if(!n) return;

socket.emit("createChat",n);

}

/* ================= VC ================= */

socket.on("vcList",list=>{

vcChannels=list;

renderVCs();

});

function renderVCs(){

voiceChannels.innerHTML="";

vcChannels.forEach(v=>{

let d=document.createElement("div");

d.className="item";

if(v===currentVC){
d.classList.add("active");
}

d.innerText="🔊 "+v;

d.onclick=()=>joinVC(v);

voiceChannels.appendChild(d);

});

}

function addVC(){

let n=prompt("VC name");

if(!n) return;

socket.emit("createVC",n);

}

/* ================= SEND ================= */

function send(){

let text=msgInput.value.trim();

if(!text) return;

socket.emit("message",{
room:currentRoom,
text
});

msgInput.value="";

}

msgInput.addEventListener("keydown",e=>{

if(e.key==="Enter"){
send();
}

});

/* ================= FILES ================= */

document.addEventListener("dragover",e=>{
e.preventDefault();
});

document.addEventListener("drop",async e=>{

e.preventDefault();

const file=e.dataTransfer.files[0];

uploadFile(file);

});

fileInput.onchange=()=>{

const file=fileInput.files[0];

uploadFile(file);

};

async function uploadFile(file){

const form=new FormData();

form.append("file",file);

const res=await fetch("/upload",{
method:"POST",
body:form
});

const data=await res.json();

socket.emit("message",{
room:currentRoom,
file:data.url,
text:file.name
});

}

/* ================= RECEIVE ================= */

socket.on("message",m=>{

if(!chats[m.room]){
chats[m.room]=[];
}

chats[m.room].push(m);

if(m.room===currentRoom){
renderMessages();
}

});

function renderMessages(){

messages.innerHTML="";

(chats[currentRoom]||[]).forEach(m=>{

let d=document.createElement("div");

d.className="msg";

let html="<b>"+m.from+":</b> ";

if(m.file){

if(
m.file.endsWith(".png")||
m.file.endsWith(".jpg")||
m.file.endsWith(".jpeg")||
m.file.endsWith(".gif")||
m.file.endsWith(".webp")
){

html+=\`
<br>
<img src="\${m.file}">
\`;

}else{

html+=\`
<br>
<a href="\${m.file}" target="_blank">
📎 \${m.text}
</a>
\`;

}

}else{

html+=m.text;

}

d.innerHTML=html;

messages.appendChild(d);

});

messages.scrollTop=messages.scrollHeight;

}

/* ================= USERS ================= */

socket.on("users",list=>{

users.innerHTML="";

list.forEach(u=>{

let d=document.createElement("div");

d.className="item";

d.innerText=u;

users.appendChild(d);

});

});

/* ================= VC USERS ================= */

socket.on("vcUsers",list=>{

vcUsers.innerHTML="";

list.forEach(u=>{

if(u.room!==currentVC) return;

let div=document.createElement("div");

div.className="vcMember";

if(u.speaking){
div.classList.add("speaking");
}

let mic=u.muted?"🔇":"🎤";
let deaf=u.deafened?"🎧":"";

div.innerHTML=\`
<div>
<b>\${u.name}</b>
</div>

<div class="iconRow">
<span>\${mic}</span>
<span>\${deaf}</span>
<span>\${u.speaking?"📶":""}</span>
</div>
\`;

vcUsers.appendChild(div);

});

});

/* ================= JOIN VC ================= */

async function joinVC(room){

currentVC=room;

renderVCs();

vcNameSmall.innerText="🔊 "+room;

if(!localStream){

localStream=
await navigator.mediaDevices.getUserMedia({
audio:true
});

startSpeakingDetect();

}

socket.emit("joinVC",room);

}

/* ================= LEAVE VC ================= */

function leaveVC(){

currentVC=null;

renderVCs();

vcNameSmall.innerText="Not connected";

Object.values(peers).forEach(p=>{
p.close();
});

peers={};

socket.emit("leaveVC");

}

/* ================= WEBRTC ================= */

socket.on("allUsers",list=>{

list.forEach(id=>{
createPeer(id,true);
});

});

socket.on("userJoined",id=>{
createPeer(id,false);
});

function createPeer(id,initiator){

if(peers[id]){
return peers[id];
}

const pc=new RTCPeerConnection({
iceServers:[
{
urls:"stun:stun.l.google.com:19302"
}
]
});

pc.onconnectionstatechange=()=>{

if(
pc.connectionState==="failed"||
pc.connectionState==="disconnected"
){
pc.restartIce();
}

};

peers[id]=pc;

if(localStream){

localStream.getTracks().forEach(track=>{
pc.addTrack(track,localStream);
});

}

pc.ontrack=e=>{

let media=
document.getElementById("media-"+id);

if(!media){

if(e.track.kind==="video"){

media=document.createElement("video");

media.autoplay=true;
media.playsInline=true;

}else{

media=document.createElement("audio");

media.autoplay=true;

}

media.id="media-"+id;

document.body.appendChild(media);

}

media.srcObject=e.streams[0];

};

pc.onicecandidate=e=>{

if(e.candidate){

socket.emit("iceCandidate",{
to:id,
candidate:e.candidate
});

}

};

if(initiator){

pc.createOffer()
.then(o=>pc.setLocalDescription(o))
.then(()=>{

socket.emit("offer",{
to:id,
offer:pc.localDescription
});

});

}

return pc;

}

/* ================= SIGNAL ================= */

socket.on("offer",async data=>{

const pc=createPeer(data.from,false);

await pc.setRemoteDescription(data.offer);

const answer=await pc.createAnswer();

await pc.setLocalDescription(answer);

socket.emit("answer",{
to:data.from,
answer
});

});

socket.on("answer",data=>{

if(peers[data.from]){

peers[data.from]
.setRemoteDescription(data.answer);

}

});

socket.on("iceCandidate",data=>{

if(peers[data.from]){

peers[data.from]
.addIceCandidate(data.candidate);

}

});

/* ================= MUTE ================= */

function muteMic(){

if(!localStream) return;

muted=!muted;

localStream.getAudioTracks().forEach(t=>{
t.enabled=!muted;
});

muteBtn.style.background=
muted?"red":"#5865f2";

socket.emit("vcState",{
type:"mute",
state:muted
});

}

/* ================= DEAFEN ================= */

function deafen(){

deafened=!deafened;

document.querySelectorAll("audio")
.forEach(a=>{
a.muted=deafened;
});

deafBtn.style.background=
deafened?"red":"#5865f2";

socket.emit("vcState",{
type:"deafen",
state:deafened
});

}

/* ================= SPEAK ================= */

function startSpeakingDetect(){

const ctx=new AudioContext();

const src=
ctx.createMediaStreamSource(localStream);

const analyser=
ctx.createAnalyser();

src.connect(analyser);

const data=
new Uint8Array(analyser.fftSize);

function loop(){

analyser.getByteTimeDomainData(data);

let sum=0;

for(let i=0;i<data.length;i++){
sum+=Math.abs(data[i]-128);
}

socket.emit("speaking",sum>900);

requestAnimationFrame(loop);

}

loop();

}

/* ================= SCREEN SHARE ================= */

async function startScreen(){

const screen=
await navigator.mediaDevices.getDisplayMedia({
video:true
});

const track=screen.getVideoTracks()[0];

Object.values(peers).forEach(pc=>{

const sender=
pc.getSenders()
.find(s=>
s.track &&
s.track.kind==="video"
);

if(sender){

sender.replaceTrack(track);

}else{

pc.addTrack(track,screen);

}

});

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

socket.emit("chatList",globalChats);
socket.emit("vcList",globalVCs);

io.emit(
"users",
Array.from(users.values())
);

});

socket.on("createChat",name=>{

if(!globalChats.includes(name)){

globalChats.push(name);

io.emit("chatList",globalChats);

}

});

socket.on("createVC",name=>{

if(!globalVCs.includes(name)){

globalVCs.push(name);

io.emit("vcList",globalVCs);

}

});

socket.on("message",m=>{

io.emit("message",{
from:socket.username,
room:m.room,
text:m.text||"",
file:m.file||null
});

});

socket.on("joinVC",room=>{

socket.join(room);

vcStates.set(socket.id,{
name:socket.username,
room,
muted:false,
deafened:false,
speaking:false
});

const usersInRoom=
[...(io.sockets.adapter.rooms.get(room)||[])]
.filter(id=>id!==socket.id);

socket.emit("allUsers",usersInRoom);

socket.to(room)
.emit("userJoined",socket.id);

io.emit(
"vcUsers",
Array.from(vcStates.values())
);

});

socket.on("vcState",data=>{

if(!vcStates.has(socket.id)) return;

let u=vcStates.get(socket.id);

if(data.type==="mute"){
u.muted=data.state;
}

if(data.type==="deafen"){
u.deafened=data.state;
}

vcStates.set(socket.id,u);

io.emit(
"vcUsers",
Array.from(vcStates.values())
);

});

socket.on("speaking",state=>{

if(!vcStates.has(socket.id)) return;

let u=vcStates.get(socket.id);

u.speaking=state;

vcStates.set(socket.id,u);

io.emit(
"vcUsers",
Array.from(vcStates.values())
);

});

socket.on("leaveVC",()=>{

vcStates.delete(socket.id);

io.emit(
"vcUsers",
Array.from(vcStates.values())
);

});

socket.on("offer",data=>{

io.to(data.to).emit("offer",{
from:socket.id,
offer:data.offer
});

});

socket.on("answer",data=>{

io.to(data.to).emit("answer",{
from:socket.id,
answer:data.answer
});

});

socket.on("iceCandidate",data=>{

io.to(data.to).emit("iceCandidate",{
from:socket.id,
candidate:data.candidate
});

});

socket.on("disconnect",()=>{

users.delete(socket.id);

vcStates.delete(socket.id);

io.emit(
"users",
Array.from(users.values())
);

io.emit(
"vcUsers",
Array.from(vcStates.values())
);

});

});

server.listen(process.env.PORT||3000,()=>{
console.log("TXTEL RUNNING");
});
