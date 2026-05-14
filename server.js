const express=require("express");
const http=require("http");
const {Server}=require("socket.io");

const app=express();
const server=http.createServer(app);
const io=new Server(server,{cors:{origin:"*"}});

/* ================= STATE ================= */

const users=new Map(); // socket.id -> username

const onlineUsers=new Set(); // usernames

const chats=["general"];
const messages={};

const vcRooms=new Map(); // room -> Set(socket.id)

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
display:flex;
height:100vh;
font-family:Arial;
background:#1e1f22;
color:white;
}

/* SIDEBAR */
#sidebar{
width:280px;
background:#0f1012;
padding:10px;
overflow:auto;
}

.item{
padding:10px;
background:#232428;
margin:5px 0;
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
width:18px;
height:18px;
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

<div>CHAT</div>
<div id="channels"></div>

<div style="margin-top:10px">DM (ONLINE)</div>
<div id="dm"></div>

<div style="margin-top:10px">VOICE</div>
<div id="voice"></div>

</div>

<div id="chat">

<div id="top" id="room"># general</div>

<div id="messages"></div>

<div id="bar">
<input id="msg">
<button onclick="send()">Send</button>
</div>

</div>

<script src="/socket.io/socket.io.js"></script>

<script>

const socket=io();

let user=localStorage.getItem("u")||("user"+Math.floor(Math.random()*9999));
localStorage.setItem("u",user);

let current="general";
let mode="chat";

let store={};

/* LOGIN */
socket.emit("login",user);

/* SEND */
function send(){
let t=msg.value.trim();
if(!t) return;

socket.emit("msg",{to:current,text:t});
msg.value="";
}

/* CHAT SELECT */
function selectChat(c){
current=c;
room.innerText="# "+c;
load();
}

/* RENDER CHAT LIST */
socket.on("chatList",list=>{
channels.innerHTML="";

list.forEach(c=>{
let d=document.createElement("div");
d.className="item";

if(c===current)d.classList.add("active");

d.innerText="# "+c;

d.onclick=()=>selectChat(c);

channels.appendChild(d);
});
});

/* DM USERS (REAL ONLINE USERS) */
socket.on("onlineUsers",list=>{
dm.innerHTML="";

list.forEach(u=>{
if(u===user) return;

let d=document.createElement("div");
d.className="item";
d.innerText="💬 "+u;

d.onclick=()=>{
current="dm:"+u;
room.innerText="💬 "+u;
load();
};

dm.appendChild(d);
});
});

/* VC LIST (REAL ROOMS) */
socket.on("vcUpdate",data=>{
voice.innerHTML="";

Object.keys(data).forEach(room=>{

let d=document.createElement("div");
d.className="item";

let users=data[room];

d.innerHTML="🔊 "+room+"<div style='font-size:11px'>"+users.join(", ")+"</div>";

d.onclick=()=>{
socket.emit("joinVC",room);
};

voice.appendChild(d);
});
});

/* MESSAGES */
socket.on("msg",m=>{

if(!store[m.to]) store[m.to]=[];
store[m.to].push(m);

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
onlineUsers.add(u);

/* send updates */
io.emit("onlineUsers",Array.from(onlineUsers));
io.emit("chatList",chats);
});

/* CHAT */
socket.on("msg",d=>{

let m={
from:socket.user,
to:d.to,
text:d.text
};

io.emit("msg",m);
});

/* VC JOIN (REAL ROOM SYSTEM) */
socket.on("joinVC",room=>{

/* leave all rooms first */
for(let [r,set] of vcRooms){
set.delete(socket.id);
}

/* join new */
if(!vcRooms.has(room)) vcRooms.set(room,new Set());

vcRooms.get(room).add(socket.id);

sendVCUpdate();
});

function sendVCUpdate(){

let out={};

for(let [room,set] of vcRooms){

out[room]=Array.from(set).map(id=>users.get(id)).filter(Boolean);

}

io.emit("vcUpdate",out);
}

/* CHAT CREATE */
socket.on("createChat",n=>{
if(!chats.includes(n)) chats.push(n);
io.emit("chatList",chats);
});

/* DISCONNECT */
socket.on("disconnect",()=>{

onlineUsers.delete(socket.user);
users.delete(socket.id);

for(let [r,set] of vcRooms){
set.delete(socket.id);
}

io.emit("onlineUsers",Array.from(onlineUsers));
sendVCUpdate();

});

});

server.listen(3000,()=>{
console.log("TXTEL FIXED DM + VC REAL RUNNING");
});
