const express=require("express");
const http=require("http");
const {Server}=require("socket.io");

const app=express();
const server=http.createServer(app);
const io=new Server(server,{cors:{origin:"*"}});

/* STATE */
let chats=["general"];
let vcs=["General VC"];

let messages={};
let msgId=0;

const users=new Map();

/* FRONTEND */
app.get("/",(req,res)=>{
res.send(`
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>TXTEL</title>

<style>

body{
margin:0;
font-family:Arial;
display:flex;
height:100vh;
background:#1e1f22;
color:white;
overflow:hidden;
}

/* SIDEBAR */
#sidebar{
width:300px;
background:#0f1012;
padding:12px;
border-right:1px solid #222;
overflow:auto;
}

.section{margin-bottom:15px;}
.title{font-size:12px;opacity:0.6;margin-bottom:6px;}

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
border-bottom:1px solid #222;
display:flex;
justify-content:space-between;
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
width:240px;
background:#111214;
border:1px solid #222;
padding:10px;
border-radius:10px;
display:none;
}

.smallBtn{
width:100%;
margin:5px 0;
background:#2b2d31;
}

/* VC PANEL */
#userPanel{
position:fixed;
bottom:0;
left:0;
width:300px;
background:#111214;
padding:10px;
border-top:1px solid #222;
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
<div class="title">TEXT CHANNELS</div>
<div id="channels"></div>
<button onclick="createChat()">+ Chat</button>
</div>

<div class="section">
<div class="title">VOICE CHANNELS</div>
<div id="voice"></div>
<button onclick="createVC()">+ VC</button>
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

<div id="settings">
<button class="smallBtn" onclick="toggleTheme()">Theme</button>
<button class="smallBtn" onclick="toggleNotif()">Notif</button>
<input class="smallBtn" id="pfp" placeholder="PFP URL">
<button class="smallBtn" onclick="setPfp()">Set PFP</button>
<button class="smallBtn" onclick="toggleSettings()">Close</button>
</div>

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

let user=localStorage.getItem("u")||("user"+Math.floor(Math.random()*9999));
localStorage.setItem("u",user);

let current="general";

let store={};

socket.emit("login",user);

/* SEND */
function send(){
let t=msg.value.trim();
if(!t) return;

socket.emit("msg",{to:current,text:t});
msg.value="";
}

/* CREATE CHAT */
function createChat(){
let n=prompt("Chat name");
if(n) socket.emit("createChat",n);
}

/* CREATE VC */
function createVC(){
let n=prompt("VC name");
if(n) socket.emit("createVC",n);
}

/* CHAT LIST */
socket.on("chatList",list=>{
channels.innerHTML="";

list.forEach(c=>{
let d=document.createElement("div");
d.className="item";

if(c===current)d.classList.add("active");

d.innerText="# "+c;

d.onclick=()=>{
current=c;
room.innerText="# "+c;
render();
};

channels.appendChild(d);
});
});

/* MESSAGES */
socket.on("msg",m=>{

if(!store[m.to]) store[m.to]=[];

store[m.to].push(m);

if(m.to===current) render();
});

function render(){

messages.innerHTML="";

let list=store[current]||[];

list.forEach(m=>{
let d=document.createElement("div");
d.className="msg";

d.innerHTML=
"<b>"+m.from+"</b>: "+m.text+
"<div class='actions'>"+
"<button onclick=react("+m.id+",'👍')>👍</button>"+
"<button onclick=react("+m.id+",'😂')>😂</button>"+
"<button onclick=edit("+m.id+")>✏️</button>"+
"<button onclick=del("+m.id+")>🗑</button>"+
"</div>";

messages.appendChild(d);
});
}

/* ACTIONS */
function edit(id){
let t=prompt("Edit:");
if(t) socket.emit("edit",{id,text:t});
}

function del(id){
socket.emit("delete",id);
}

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
alert("notif");
}

function setPfp(){
localStorage.setItem("pfp",pfp.value);
}

function mute(){}
function deafen(){}
function leaveVC(){}

</script>

</body>
</html>
`);
});

/* SOCKET */
io.on("connection",socket=>{

socket.on("login",u=>{
socket.user=u;
users.set(socket.id,u);
socket.emit("chatList",chats);
});

/* CHAT */
socket.on("createChat",n=>{
if(!chats.includes(n)) chats.push(n);
io.emit("chatList",chats);
});

/* VC */
socket.on("createVC",n=>{
if(!vcs.includes(n)) vcs.push(n);
});

/* MSG */
socket.on("msg",d=>{

const m={
id:msgId++,
from:socket.user,
to:d.to,
text:d.text
};

io.emit("msg",m);
});

/* EDIT / DELETE / REACT */
socket.on("edit",d=>io.emit("edit",d));
socket.on("delete",id=>io.emit("delete",id));
socket.on("react",d=>io.emit("react",d));

});

server.listen(3000,()=>{
console.log("TXTEL STABLE RUNNING");
});
