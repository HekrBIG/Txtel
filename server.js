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

/* SIDEBAR */

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

/* CHAT */

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

/* BOTTOM PANEL */

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

#vcStatus{
font-size:12px;
opacity:0.8;
margin-bottom:8px;
}

#controls{
display:flex;
gap:6px;
}

#controls button{
flex:1;
}

audio{
display:none;
}

</style>
</head>

<body>

<!-- SIDEBAR -->

<div id="sidebar">

<div class="section">
<div class="title">TEXT CHANNELS</div>

<div id="channels"></div>

<button onclick="addChat()">+ Chat</button>
</div>

<div class="section">
<div class="title">VOICE CHANNELS</div>

<div id="voiceChannels"></div>

<button onclick="addVC()">+ VC</button>
</div>

<div class="section">
<div class="title">USERS</div>

<div id="users"></div>
</div>

</div>

<!-- CHAT -->

<div id="chat">

<div id="top"># general</div>

<div id="messages"></div>

<div id="bar">
<input id="msgInput" placeholder="message">
<button onclick="send()">Send</button>
</div>

</div>

<!-- BOTTOM LEFT PANEL -->

<div id="userPanel">

<div id="vcStatus">
<div id="vcNameSmall">Not connected</div>
<div id="vcTimeSmall">00:00</div>
</div>

<div id="controls">
<button id="muteBtn" onclick="muteMic()">🎤</button>
<button id="deafBtn" onclick="deafen()">🎧</button>
<button onclick="leaveVC()" style="background:red;">Leave</button>
</div>

</div>

<script src="/socket.io/socket.io.js"></script>

<script>

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

let textChannels=[];
let vcChannels=[];

let peers={};

let localStream=null;

let muted=false;
let deafened=false;

/* ================= VC TIMER ================= */

let vcStart=0;
let vcInterval=null;

function startTimer(){

vcStart=Date.now();

if(vcInterval){
clearInterval(vcInterval);
}

vcInterval=setInterval(()=>{

const diff=Math.floor((Date.now()-vcStart)/1000);

const m=Math.floor(diff/60);
const s=diff%60;

vcTimeSmall.innerText=
String(m).padStart(2,"0")+":"+
String(s).padStart(2,"0");

},1000);
}

function stopTimer(){

if(vcInterval){
clearInterval(vcInterval);
}

vcTimeSmall.innerText="00:00";
}

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

/* ================= VOICE CHANNELS ================= */

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

d.innerHTML="<b>"+m.from+":</b> "+m.text;

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

/* ================= VC JOIN ================= */

async function joinVC(room){

currentVC=room;

renderVCs();

vcNameSmall.innerText="🔊 "+room;

startTimer();

if(!localStream){

localStream=await navigator.mediaDevices.getUserMedia({
audio:true
});

}

socket.emit("joinVC",room);
}

/* ================= LEAVE VC ================= */

function leaveVC(){

currentVC=null;

renderVCs();

vcNameSmall.innerText="Not connected";

stopTimer();

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
muted ? "red" : "#5865f2";
}

/* ================= DEAFEN ================= */

function deafen(){

deafened=!deafened;

document.querySelectorAll("audio")
.forEach(a=>{
a.muted=deafened;
});

deafBtn.style.background=
deafened ? "red" : "#5865f2";
}

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

socket.emit("chatList",globalChats);
socket.emit("vcList",globalVCs);

io.emit("users",
Array.from(users.values())
);

});

/* CREATE CHAT */

socket.on("createChat",name=>{

if(!globalChats.includes(name)){

globalChats.push(name);

io.emit("chatList",globalChats);

}

});

/* CREATE VC */

socket.on("createVC",name=>{

if(!globalVCs.includes(name)){

globalVCs.push(name);

io.emit("vcList",globalVCs);

}

});

/* MESSAGE */

socket.on("message",m=>{

io.emit("message",{
from:socket.username,
room:m.room,
text:m.text
});

});

/* VC JOIN */

socket.on("joinVC",room=>{

socket.join(room);

const usersInRoom=
[...(io.sockets.adapter.rooms.get(room)||[])]
.filter(id=>id!==socket.id);

socket.emit("allUsers",usersInRoom);

socket.to(room)
.emit("userJoined",socket.id);

});

/* LEAVE VC */

socket.on("leaveVC",()=>{

});

/* SIGNAL */

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

/* DISCONNECT */

socket.on("disconnect",()=>{

users.delete(socket.id);

io.emit("users",
Array.from(users.values())
);

});

});

/* ================= START ================= */

server.listen(process.env.PORT||3000,()=>{
console.log("TXTEL RUNNING");
});
