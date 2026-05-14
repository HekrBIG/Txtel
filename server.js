const express=require("express");
const http=require("http");
const {Server}=require("socket.io");

const app=express();
const server=http.createServer(app);
const io=new Server(server,{cors:{origin:"*"}});

/* ================= STATE ================= */

let chats=["general"];
let vcs=["General VC"];

let messages={};      // channel messages
let dmMessages={};    // private messages

let msgId=0;

const users=new Map();

/* ================= FRONTEND ================= */

app.get("/",(req,res)=>{
res.send(`<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>TXTEL FULL</title>

<style>

body{
margin:0;
font-family:Arial;
display:flex;
height:100vh;
overflow:hidden;
background:#1e1f22;
color:white;
}

/* SIDEBAR */
#sidebar{
width:300px;
background:#0f1012;
padding:12px;
overflow:auto;
border-right:1px solid #222;
}

.section{margin-bottom:15px;}
.title{font-size:12px;opacity:0.7;margin-bottom:8px;}

.item{
background:#232428;
padding:10px;
border-radius:8px;
margin:5px 0;
cursor:pointer;
}

.item:hover{background:#313338;}
.active{background:#4aa3ff!important;}

/* CHAT */
#chat{
flex:1;
display:flex;
flex-direction:column;
}

#top{
padding:12px;
background:#111214;
display:flex;
justify-content:space-between;
align-items:center;
border-bottom:1px solid #222;
}

#messages{
flex:1;
padding:10px;
overflow:auto;
}

.msg{
background:#2b2d31;
padding:8px;
margin:5px 0;
border-radius:8px;
position:relative;
}

.actions button{
margin-left:5px;
font-size:11px;
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

/* SETTINGS */
#settings{
position:fixed;
bottom:120px;
left:10px;
width:260px;
background:#111214;
border:1px solid #222;
border-radius:10px;
padding:10px;
display:none;
}

.smallBtn{
width:100%;
margin:5px 0;
background:#2b2d31;
}

/* USER PANEL */
#userPanel{
position:fixed;
bottom:0;
left:0;
width:300px;
background:#111214;
border-top:1px solid #222;
padding:10px;
}

#controls{
display:flex;
gap:6px;
}

#controls button{
flex:1;
}

audio{display:none;}

</style>
</head>

<body>

<div id="sidebar">

<div class="section">
<div class="title">TEXT</div>
<div id="channels"></div>
<button onclick="createChat()">+ Chat</button>
</div>

<div class="section">
<div class="title">VOICE</div>
<div id="voiceChannels"></div>
<button onclick="createVC()">+ VC</button>
</div>

<div class="section">
<div class="title">DM</div>
<button onclick="openDM()">+ DM</button>
</div>

</div>

<div id="chat">

<div id="top">
<div id="room"># general</div>
<button onclick="toggleSettings()">⚙</button>
</div>

<div id="messages"></div>

<div id="bar">
<input id="msg">
<button onclick="send()">Send</button>
</div>

</div>

<!-- SETTINGS -->
<div id="settings">

<button class="smallBtn" onclick="toggleTheme()">🌗 Theme</button>
<button class="smallBtn" onclick="toggleNotif()">🔔 Notifications</button>
<input class="smallBtn" id="pfp" placeholder="PFP URL">
<button class="smallBtn" onclick="setPfp()">Set PFP</button>

<button class="smallBtn" onclick="toggleSettings()">Close</button>

</div>

<!-- USER PANEL -->
<div id="userPanel">

<div id="controls">
<button onclick="mute()">🎤</button>
<button onclick="deafen()">🎧</button>
<button onclick="leaveVC()" style="background:red;">Leave</button>
</div>

</div>

<script src="/socket.io/socket.io.js"></script>

<script>

const socket=io();

/* STATE */
let user=localStorage.getItem("u")||("user"+Math.floor(Math.random()*9999));
localStorage.setItem("u",user);

let current="#general";
let mode="chat";

let muted=false;
let deafened=false;

let theme="dark";
let notif=true;

let store={};

/* LOGIN */
socket.emit("login",user);

/* SEND */
function send(){
let t=msg.value.trim();
if(!t) return;

socket.emit("send",{to:current,text:t,mode});
msg.value="";
}

/* CHAT CREATE */
function createChat(){
let n=prompt("Chat name");
if(n) socket.emit("createChat",n);
}

/* VC CREATE */
function createVC(){
let n=prompt("VC name");
if(n) socket.emit("createVC",n);
}

/* DM */
function openDM(){
let u=prompt("Username:");
if(u){
mode="dm";
current=u;
room.innerText="💬 "+u;
load();
}
}

/* RECEIVE MSG */
socket.on("msg",m=>{

let key=m.to;

if(!store[key]) store[key]=[];

store[key].push(m);

if(m.to===current){
render();
}
});

/* RENDER */
function render(){
messages.innerHTML="";

let list=store[current]||[];

list.forEach(m=>{
let d=document.createElement("div");
d.className="msg";

d.innerHTML=`
<b>${m.from}</b>: ${m.text}
<br>

<div class="actions">
<button onclick="react(${m.id},'👍')">👍</button>
<button onclick="react(${m.id},'😂')">😂</button>
<button onclick="edit(${m.id})">✏️</button>
<button onclick="del(${m.id})">🗑</button>
</div>

<span id="r-${m.id}">${m.react||""}</span>
`;

messages.appendChild(d);
});
}

/* EDIT */
function edit(id){
let t=prompt("Edit:");
if(t) socket.emit("edit",{id,text:t});
}

/* DELETE */
function del(id){
socket.emit("delete",id);
}

/* REACT */
function react(id,r){
socket.emit("react",{id,r});
}

/* SETTINGS */
function toggleSettings(){
settings.style.display=
settings.style.display==="block"?"none":"block";
}

function toggleTheme(){
document.body.style.background=
document.body.style.background==="#1e1f22"?"white":"#1e1f22";
}

function toggleNotif(){
notif=!notif;
alert(notif);
}

function setPfp(){
localStorage.setItem("pfp",pfp.value);
}

/* VC */
function leaveVC(){}

function mute(){muted=!muted;}
function deafen(){deafened=!deafened;}

</script>

</body>
</html>`);
});

/* ================= SOCKET ================= */

io.on("connection",socket=>{

socket.on("login",u=>{
socket.user=u;
users.set(socket.id,u);
});

/* CHAT */
socket.on("createChat",n=>{
if(!chats.includes(n)) chats.push(n);
io.emit("chatList",chats);
});

socket.on("createVC",n=>{
if(!vcs.includes(n)) vcs.push(n);
io.emit("vcList",vcs);
});

/* SEND MSG */
socket.on("send",d=>{
const m={
id:msgId++,
from:socket.user,
to:d.to,
text:d.text,
react:""
};

io.emit("msg",m);
});

/* EDIT */
socket.on("edit",d=>{
io.emit("edit",d);
});

/* DELETE */
socket.on("delete",id=>{
io.emit("delete",id);
});

/* REACT */
socket.on("react",d=>{
io.emit("react",d);
});

/* CLEAN */
socket.on("disconnect",()=>{
users.delete(socket.id);
});

});

server.listen(3000,()=>{
console.log("TXTEL FULL SYSTEM RUNNING");
});
