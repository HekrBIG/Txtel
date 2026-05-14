const express=require("express");
const http=require("http");
const {Server}=require("socket.io");

const app=express();
const server=http.createServer(app);
const io=new Server(server,{cors:{origin:"*"}});

/* ================= STATE ================= */

let chats=["general"];
let messages={};

let dms={}; // "user1-user2": []

let vcUsers={}; // room -> Set(user)
let pfp={}; // user -> url

const users=new Map();

/* ================= FRONTEND ================= */

app.get("/",(req,res)=>{
res.send(`
<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>TXTEL</title>

<style>

body{
margin:0;
font-family:Arial;
display:flex;
height:100vh;
overflow:hidden;
transition:0.3s;
}

.dark{background:#1e1f22;color:white;}
.light{background:white;color:black;}

/* SIDEBAR */
#sidebar{
width:280px;
background:#0f1012;
padding:10px;
overflow:auto;
}

.item{
padding:10px;
margin:5px 0;
background:#232428;
border-radius:8px;
cursor:pointer;
position:relative;
}

.item:hover{background:#313338;}
.active{background:#4aa3ff !important;}

.badge{
position:absolute;
right:8px;
top:8px;
background:#5865f2;
width:18px;height:18px;
border-radius:50%;
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
padding:10px;
background:#111214;
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

/* SETTINGS */
#settings{
position:fixed;
bottom:100px;
left:10px;
background:#111214;
padding:10px;
border-radius:10px;
display:none;
width:220px;
}

.smallBtn{width:100%;margin:5px 0;}

/* VC RING */
.speaking{
outline:2px solid #3ba55d;
box-shadow:0 0 10px #3ba55d;
}

@media(max-width:700px){
#sidebar{width:120px;font-size:12px;}
}

</style>
</head>

<body class="dark">

<div id="sidebar">

<div>TEXT</div>
<div id="channels"></div>
<button onclick="createChat()">+ Chat</button>

<hr>

<div>DM</div>
<div id="dmList"></div>
<button onclick="startDM()">+ DM</button>

<hr>

<div>VOICE</div>
<div id="voice"></div>
<button onclick="createVC()">+ VC</button>

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

<button class="smallBtn" onclick="toggleTheme()">Light/Dark</button>
<input class="smallBtn" id="pfpInput" placeholder="PFP URL">
<button class="smallBtn" onclick="setPfp()">Set PFP</button>

</div>

<script src="/socket.io/socket.io.js"></script>

<script>

const socket=io();

/* STATE */
let user=localStorage.getItem("u")||("user"+Math.floor(Math.random()*9999));
localStorage.setItem("u",user);

let current="general";
let mode="chat";

let store={};
let unread={};
let theme="dark";

/* LOGIN */
socket.emit("login",user);

/* SEND */
function send(){
let t=msg.value.trim();
if(!t) return;

socket.emit("msg",{to:current,text:t,mode});
msg.value="";
}

/* CHAT */
function createChat(){
let n=prompt("Chat name");
if(n) socket.emit("createChat",n);
}

/* DM */
function startDM(){
let u=prompt("Username:");
if(u) socket.emit("dm",u);
}

/* VC */
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

if(unread[c]){
let b=document.createElement("div");
b.className="badge";
b.innerText=unread[c];
d.appendChild(b);
}

d.innerText="# "+c;

d.onclick=()=>{
current=c;
unread[c]=0;
room.innerText="# "+c;
load();
render(list);
};

channels.appendChild(d);
});
});

/* MESSAGES */
socket.on("msg",m=>{

if(!store[m.to]) store[m.to]=[];
store[m.to].push(m);

if(m.to!==current){
unread[m.to]=(unread[m.to]||0)+1;
}

if(m.to===current) load();
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

/* DM LIST */
socket.on("dmList",list=>{
dmList.innerHTML="";
list.forEach(u=>{
let d=document.createElement("div");
d.className="item";
d.innerText="💬 "+u;
d.onclick=()=>{
current=u;
room.innerText="💬 "+u;
load();
};
dmList.appendChild(d);
});
});

/* VC USERS (speaking ring) */
socket.on("vcUpdate",data=>{
voice.innerHTML="";

Object.keys(data).forEach(room=>{

let d=document.createElement("div");
d.className="item";

let users=data[room].join(", ");

d.innerHTML="🔊 "+room+"<div style='font-size:11px'>"+users+"</div>";

voice.appendChild(d);
});

});

/* SETTINGS */
function toggleSettings(){
settings.style.display=
settings.style.display==="block"?"none":"block";
}

function toggleTheme(){
theme=theme==="dark"?"light":"dark";
document.body.className=theme;
}

function setPfp(){
localStorage.setItem("pfp",pfpInput.value);
}

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
});

/* CHAT */
socket.on("createChat",n=>{
if(!chats.includes(n)) chats.push(n);
io.emit("chatList",chats);
});

/* MSG */
socket.on("msg",d=>{

const m={
from:socket.user,
to:d.to,
text:d.text
};

io.emit("msg",m);
});

/* DM */
socket.on("dm",u=>{
socket.emit("dmList",[u]);
});

/* VC */
socket.on("createVC",n=>{
vcUsers[n]=vcUsers[n]||new Set();
io.emit("vcUpdate",vcUsersToObj());
});

function vcUsersToObj(){
let o={};
for(let k in vcUsers){
o[k]=Array.from(vcUsers[k]);
}
return o;
}

socket.on("joinVC",room=>{

for(let r in vcUsers){
vcUsers[r].delete(socket.user);
}

if(!vcUsers[room]) vcUsers[room]=new Set();

vcUsers[room].add(socket.user);

io.emit("vcUpdate",vcUsersToObj());
});

});

server.listen(3000,()=>{
console.log("TXTEL FINAL VC + DM + UI RUNNING");
});
