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
let unread={};

let vcUsers={}; 
// { room: Set(usernames) }

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

.section{margin-bottom:15px;}
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
.active{background:#4aa3ff !important;}

/* UNREAD BADGE */
.badge{
position:absolute;
right:8px;
top:8px;
background:#5865f2;
width:18px;
height:18px;
border-radius:50%;
display:flex;
align-items:center;
justify-content:center;
font-size:12px;
}

/* VC USERS */
.small{
font-size:11px;
opacity:0.7;
margin-top:3px;
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
renderChats(list);
});

/* RENDER CHANNELS */
function renderChats(list){

channels.innerHTML="";

list.forEach(c=>{

let d=document.createElement("div");
d.className="item";

if(c===current){
d.classList.add("active");
unread[c]=0;
}

d.innerText="# "+c;

/* UNREAD BADGE */
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
renderChats(list);
load();
};

channels.appendChild(d);
});
}

/* MESSAGES */
socket.on("msg",m=>{

if(!store[m.to]) store[m.to]=[];
store[m.to].push(m);

/* unread system */
if(m.to!==current){
unread[m.to]=(unread[m.to]||0)+1;
}

if(m.to===current) load();
renderChats(Object.keys(store));
});

/* LOAD CHAT */
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
socket.on("vcList",data=>{

voice.innerHTML="";

data.vcs.forEach(v=>{

let d=document.createElement("div");
d.className="item";

let users=data.users[v]||[];

d.innerHTML=
"🔊 "+v+
"<div class='small'>"+users.join(", ")+"</div>";

d.onclick=()=>alert("Join VC: "+v);

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
socket.emit("vcList",{vcs,users:vcUsers});
});

/* CHAT CREATE */
socket.on("createChat",n=>{
if(!chats.includes(n)) chats.push(n);
io.emit("chatList",chats);
});

/* VC CREATE */
socket.on("createVC",n=>{
if(!vcs.includes(n)) vcs.push(n);

vcUsers[n]=vcUsers[n]||new Set();

io.emit("vcList",{vcs,users:vcUsersToObj()});
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

/* VC JOIN (no message spam, ONLY tracking) */
socket.on("joinVC",room=>{

for(let r in vcUsers){
vcUsers[r].delete(socket.user);
}

if(!vcUsers[room]) vcUsers[room]=new Set();

vcUsers[room].add(socket.user);

io.emit("vcList",{vcs,users:vcUsersToObj()});
});

/* HELPERS */
function vcUsersToObj(){
let o={};
for(let k in vcUsers){
o[k]=Array.from(vcUsers[k]);
}
return o;
}

/* CLEAN */
socket.on("disconnect",()=>{
users.delete(socket.id);
});

});

server.listen(3000,()=>{
console.log("TXTEL FINAL STABLE RUNNING");
});
