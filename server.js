const express=require("express");
const http=require("http");
const {Server}=require("socket.io");

const app=express();
const server=http.createServer(app);

const io=new Server(server,{
cors:{origin:"*"}
});

/* ================= STATE ================= */

const users=new Map();

const vcUsers=new Map();

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

body{
margin:0;
font-family:Arial;
background:#1e1f22;
color:white;
display:flex;
height:100vh;
overflow:hidden;
}

/* SIDEBAR */

#sidebar{
width:300px;
background:#0f1012;
padding:12px;
overflow:auto;
box-sizing:border-box;
border-right:1px solid #222;
}

.section{
margin-bottom:20px;
}

.title{
font-weight:bold;
margin-bottom:10px;
font-size:14px;
opacity:0.8;
}

/* ITEMS */

.item{
background:#232428;
padding:10px;
border-radius:10px;
margin:6px 0;
cursor:pointer;
transition:0.15s;
font-size:15px;
}

.item:hover{
background:#313338;
}

.active{
background:#4aa3ff!important;
}

.badge{
background:red;
padding:2px 6px;
border-radius:999px;
font-size:11px;
float:right;
}

/* CHAT */

#chat{
flex:1;
display:flex;
flex-direction:column;
}

#top{
padding:14px;
background:#111214;
border-bottom:1px solid #333;
font-size:20px;
}

#messages{
flex:1;
padding:10px;
overflow:auto;
}

.msg{
background:#2b2d31;
padding:10px;
border-radius:10px;
margin:5px 0;
word-break:break-word;
}

/* BAR */

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
border-radius:10px;
background:#2b2d31;
color:white;
font-size:14px;
}

button{
border:none;
padding:10px 12px;
border-radius:10px;
background:#5865f2;
color:white;
cursor:pointer;
font-weight:bold;
}

/* VC */

.vcUser{
background:#232428;
padding:8px;
border-radius:8px;
margin:5px 0;
display:flex;
justify-content:space-between;
align-items:center;
font-size:14px;
}

.small{
font-size:10px;
opacity:0.7;
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

<div id="vcPanel"></div>

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

<button onclick="send()">Send</button>

<button id="muteBtn" onclick="muteMic()">🎤</button>

<button id="deafBtn" onclick="deafen()">🎧</button>

</div>

</div>

<script src="/socket.io/socket.io.js"></script>

<script>

/* ================= SOCKET ================= */

const socket=io();

/* ================= LOGIN ================= */

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

let unread={};

let textChannels=[];

let voiceChannels=[];

let localStream=null;

let peers={};

let muted=false;

let deafened=false;

/* ================= NOTIFICATIONS ================= */

if(Notification.permission!=="granted"){

Notification.requestPermission();
}

/* ================= SEND ================= */

function send(){

const text=msgInput.value.trim();

if(!text) return;

socket.emit("message",{
room:currentRoom,
text:text
});

msgInput.value="";
}

/* ENTER SEND */

msgInput.addEventListener("keydown",e=>{

if(e.key==="Enter"){

send();
}
});

/* ================= RECEIVE ================= */

socket.on("message",m=>{

if(!chats[m.room]){

chats[m.room]=[];
}

chats[m.room].push(m);

if(m.room!==currentRoom){

unread[m.room]=(unread[m.room]||0)+1;

renderChats();

if(Notification.permission==="granted"){

new Notification(m.from,{
body:m.text
});
}
}

if(m.room===currentRoom){

renderMessages();
}
});

/* ================= RENDER MESSAGES ================= */

function renderMessages(){

messages.innerHTML="";

(chats[currentRoom]||[]).forEach(m=>{

const div=document.createElement("div");

div.className="msg";

div.innerHTML="<b>"+m.from+":</b> "+m.text;

messages.appendChild(div);
});

messages.scrollTop=messages.scrollHeight;
}

/* ================= TEXT CHANNELS ================= */

socket.on("chatList",list=>{

textChannels=list;

renderChats();
});

function renderChats(){

channels.innerHTML="";

textChannels.forEach(c=>{

const div=document.createElement("div");

div.className="item";

if(currentRoom===c){

div.classList.add("active");
}

div.innerHTML=
"# "+c+
(unread[c]
? " <span class='badge'>"+unread[c]+"</span>"
: "");

div.onclick=()=>{

currentRoom=c;

top.innerText="# "+c;

unread[c]=0;

renderMessages();

renderChats();
};

channels.appendChild(div);
});
}

function addChat(){

const name=prompt("Chat name");

if(!name) return;

socket.emit("createChat",name);
}

/* ================= USERS ================= */

socket.on("users",list=>{

users.innerHTML="";

list.forEach(u=>{

if(u===username) return;

const div=document.createElement("div");

div.className="item";

div.innerText=u;

div.onclick=()=>{

currentRoom=u;

top.innerText="@ "+u;

renderMessages();

renderChats();
};

users.appendChild(div);
});
});

/* ================= VC ================= */

socket.on("vcList",list=>{

voiceChannels=list;

renderVC();
});

function renderVC(){

voiceChannels.innerHTML="";

voiceChannels.forEach(v=>{

const div=document.createElement("div");

div.className="item";

if(currentVC===v){

div.classList.add("active");
}

div.innerText="🔊 "+v;

div.onclick=()=>joinVC(v);

voiceChannels.appendChild(div);
});
}

function addVC(){

const name=prompt("VC name");

if(!name) return;

socket.emit("createVC",name);
}

/* ================= JOIN VC ================= */

async function joinVC(room){

currentVC=room;

renderVC();

if(!localStream){

try{

localStream=await navigator.mediaDevices.getUserMedia({
audio:true
});

startSpeakingDetect();

}
catch(err){

alert("Mic denied");

return;
}
}

socket.emit("joinVC",room);
}

/* ================= WEBRTC ================= */

socket.on("allUsers",users=>{

users.forEach(id=>{

createPeer(id,true);
});
});

socket.on("userJoined",id=>{

createPeer(id,false);
});

socket.on("offer",async data=>{

const pc=createPeer(data.from,false);

await pc.setRemoteDescription(
new RTCSessionDescription(data.offer)
);

const answer=await pc.createAnswer();

await pc.setLocalDescription(answer);

socket.emit("answer",{
to:data.from,
answer:answer
});
});

socket.on("answer",async data=>{

const pc=peers[data.from];

if(pc){

await pc.setRemoteDescription(
new RTCSessionDescription(data.answer)
);
}
});

socket.on("iceCandidate",async data=>{

const pc=peers[data.from];

if(pc){

try{

await pc.addIceCandidate(
new RTCIceCandidate(data.candidate)
);

}catch{}
}
});

/* ================= PEER ================= */

function createPeer(id,initiator){

if(peers[id]) return peers[id];

const pc=new RTCPeerConnection({
iceServers:[
{
urls:"stun:stun.l.google.com:19302"
}
]
});

peers[id]=pc;

if(localStream){

localStream.getTracks().forEach(track=>{

pc.addTrack(track,localStream);
});
}

pc.ontrack=e=>{

let audio=document.getElementById("audio-"+id);

if(!audio){

audio=document.createElement("audio");

audio.id="audio-"+id;

audio.autoplay=true;

document.body.appendChild(audio);
}

audio.srcObject=e.streams[0];
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

/* ================= VC PANEL ================= */

socket.on("vcUpdate",list=>{

vcPanel.innerHTML="";

list.forEach(u=>{

if(u.room!==currentVC) return;

const div=document.createElement("div");

div.className="vcUser";

const mic=u.muted?"🔇":"🎤";

const deaf=u.deafened?"🎧":"";

const speak=u.speaking?"📶":"";

div.innerHTML=
"<span>"+mic+" "+deaf+" "+u.name+"</span>"+
"<span class='small'>"+speak+"</span>";

vcPanel.appendChild(div);
});
});

/* ================= SPEAKING ================= */

function startSpeakingDetect(){

const ctx=new AudioContext();

const src=ctx.createMediaStreamSource(localStream);

const analyser=ctx.createAnalyser();

src.connect(analyser);

const data=new Uint8Array(analyser.fftSize);

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

/* ================= MUTE ================= */

function muteMic(){

if(!localStream) return;

muted=!muted;

localStream.getAudioTracks().forEach(t=>{

t.enabled=!muted;
});

muteBtn.style.background=
muted?"red":"#5865f2";

socket.emit("mute",muted);
}

/* ================= DEAFEN ================= */

function deafen(){

deafened=!deafened;

document.querySelectorAll("audio").forEach(a=>{

a.muted=deafened;
});

deafBtn.style.background=
deafened?"red":"#5865f2";

socket.emit("deafen",deafened);
}

/* ================= CHANGE NAME ================= */

document.addEventListener("keydown",e=>{

if(e.key===";"){

const newName=prompt("New username");

if(!newName) return;

username=newName;

localStorage.setItem(
"txtelUser",
newName
);

socket.emit("changeName",newName);
}
});

</script>

</body>
</html>`);
});

/* ================= SOCKET ================= */

io.on("connection",socket=>{

/* LOGIN */

socket.on("login",name=>{

socket.username=name;

users.set(socket.id,name);

socket.emit("vcList",globalVCs);

socket.emit("chatList",globalChats);

io.emit("users",Array.from(users.values()));
});

/* CHANGE NAME */

socket.on("changeName",name=>{

socket.username=name;

users.set(socket.id,name);

io.emit("users",Array.from(users.values()));
});

/* CHAT */

socket.on("message",m=>{

io.emit("message",{
from:socket.username,
room:m.room,
text:m.text
});
});

/* CREATE CHAT */

socket.on("createChat",name=>{

if(!globalChats.includes(name)){

globalChats.push(name);
}

io.emit("chatList",globalChats);
});

/* CREATE VC */

socket.on("createVC",name=>{

if(!globalVCs.includes(name)){

globalVCs.push(name);
}

io.emit("vcList",globalVCs);
});

/* JOIN VC */

socket.on("joinVC",room=>{

socket.join(room);

vcUsers.set(socket.id,{
name:socket.username,
room:room,
muted:false,
deafened:false,
speaking:false
});

const others=[
...(io.sockets.adapter.rooms.get(room)||[])
].filter(id=>id!==socket.id);

socket.emit("allUsers",others);

socket.to(room).emit("userJoined",socket.id);

io.emit("vcUpdate",
Array.from(vcUsers.values())
);
});

/* WEBRTC */

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

/* VC STATES */

socket.on("mute",state=>{

if(!vcUsers.has(socket.id)) return;

vcUsers.get(socket.id).muted=state;

io.emit("vcUpdate",
Array.from(vcUsers.values())
);
});

socket.on("deafen",state=>{

if(!vcUsers.has(socket.id)) return;

vcUsers.get(socket.id).deafened=state;

io.emit("vcUpdate",
Array.from(vcUsers.values())
);
});

socket.on("speaking",state=>{

if(!vcUsers.has(socket.id)) return;

vcUsers.get(socket.id).speaking=state;

io.emit("vcUpdate",
Array.from(vcUsers.values())
);
});

/* DISCONNECT */

socket.on("disconnect",()=>{

users.delete(socket.id);

vcUsers.delete(socket.id);

io.emit("users",
Array.from(users.values())
);

io.emit("vcUpdate",
Array.from(vcUsers.values())
);
});
});

/* ================= START ================= */

server.listen(process.env.PORT||3000,()=>{

console.log("TXTEL RUNNING");
});
