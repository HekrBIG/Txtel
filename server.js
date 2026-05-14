const express=require("express");
const http=require("http");
const {Server}=require("socket.io");

const app=express();
const server=http.createServer(app);
const io=new Server(server,{cors:{origin:"*"}});

/* ================= STATE ================= */

let chats=["general"];
let vcs=["General VC"];

let messages={};
let unread={}; // 🔵 NOTIF BADGES (count per channel)

const users=new Map();

/* ================= FRONTEND ================= */

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

.title{font-size:12px;opacity:0.6;margin-bottom:6px;}

.item{
background:#232428;
padding:10px;
border-radius:8px;
margin:5px 0;
cursor:pointer;
position:relative;
}

.item:hover{background:#313338;}

.active{
background:#4aa3ff !important;
}

/* 🔵 UNREAD BADGE */
.badge{
position:absolute;
right:8px;
top:8px;
background:#5865f2;
color:white;
border-radius:50%;
width:18px;
height:18px;
font-size:12px;
display:flex;
align-items:center;
justify-content:center;
}

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

</style>
</head>

<body>

<div id="sidebar">

<div class="title">TEXT CHANNELS</div>
<div id="channels"></div>
<button onclick="createChat()">+ Chat</button>

<div class="title" style="margin-top:15px;">VOICE CHANNELS</div>
<div id="voice"></div>
<button onclick="createVC()">+ VC</button>

</div>

<div id="chat">

<div id="top">
<div id="room"># general</div>
<button onclick="rename()">Rename</button>
</div>

<div id="messages"></div>

<div id="bar">
<input id="msg">
<button onclick="send()">Send</button>
</div>

</div>

<script src="/socket.io/socket.io.js"></script>

<script>

const socket=io();

/* STATE */
let user=localStorage.getItem("u")||("user"+Math.floor(Math.random()*9999));
localStorage.setItem("u",user);

let current="general";

let store={};
let unread={};

/* LOGIN */
socket.emit("login",user);

/* ENTER SEND */
msg.addEventListener("keydown",e=>{
if(e.key==="Enter") send();
});

/* SEND */
function send(){
let t=msg.value.trim();
if(!t) return;

socket.emit("msg",{to:current,text:t});
msg.value="";
}

/* RENAME USER */
function rename(){
let n=prompt("New name:");
if(n){
user=n;
socket.emit("rename",n);
}
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

/* CHANNELS */
socket.on("chatList",list=>{
render(list);
});

function render(list){

channels.innerHTML="";

list.forEach(c=>{
let d=document.createElement("div");
d.className="item";

if(c===current){
d.classList.add("active");
unread[c]=0;
}

d.innerText="# "+c;

/* 🔵 BADGE */
if(unread[c] && c!==current){
let b=document.createElement("div");
b.className="badge";
b.innerText=unread[c];
d.appendChild(b);
}

d.onclick=()=>{
current=c;
room.innerText="# "+c;
unread[c]=0;
render(list);
load();
};

channels.appendChild(d);
});
}

/* MESSAGES */
socket.on("msg",m=>{

if(!store[m.to]) store[m.to]=[];
store[m.to].push(m);

/* unread counter */
if(m.to!==current){
unread[m.to]=(unread[m.to]||0)+1;
}

if(m.to===current) load();
renderedListLast=listCache;
});

/* LOAD */
function load(){
messages.innerHTML="";

let list=store[current]||[];

list.forEach(m=>{
let d=document.createElement("div");
d.className="msg";

d.innerHTML="<b>"+m.from+"</b>: "+m.text;

messages.appendChild(d);
});
}

/* VC LIST */
socket.on("vcList",list=>{
voice.innerHTML="";

list.forEach(v=>{
let d=document.createElement("div");
d.className="item";
d.innerText="🔊 "+v;
d.onclick=()=>alert("VC join: "+v);
voice.appendChild(d);
});
});

</script>

</body>
</html>
`);
});

/* ================= SOCKET ================= */

io.on("connection",socket=>{

socket.on("login",u=>{
socket.user=u;
users.set(socket.id,u);

socket.emit("chatList",chats);
socket.emit("vcList",vcs);
});

/* RENAME */
socket.on("rename",n=>{
socket.user=n;
users.set(socket.id,n);
});

/* CHAT */
socket.on("createChat",n=>{
if(!chats.includes(n)) chats.push(n);
io.emit("chatList",chats);
});

/* VC */
socket.on("createVC",n=>{
if(!vcs.includes(n)) vcs.push(n);
io.emit("vcList",vcs);
});

/* MESSAGE */
socket.on("msg",d=>{

const m={
from:socket.user,
to:d.to,
text:d.text
};

io.emit("msg",m);
});

});

server.listen(3000,()=>{
console.log("TXTEL FINAL CLEAN RUNNING");
});
