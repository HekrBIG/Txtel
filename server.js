const express=require("express");
const http=require("http");
const {Server}=require("socket.io");

const app=express();
const server=http.createServer(app);
const io=new Server(server,{cors:{origin:"*"}});

/* ================= STATE ================= */

const users=new Map();

const chats=["general"];

/* 🔊 ALWAYS EXISTING VC */
let vcRooms={
"General VC": new Set()
};

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
margin:5px 0;
background:#232428;
border-radius:8px;
cursor:pointer;
position:relative;
}

.item:hover{background:#313338;}
.active{background:#4aa3ff !important;}

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

.small{
font-size:11px;
opacity:0.7;
}

</style>
</head>

<body>

<div id="sidebar">

<div>VOICE CHANNELS</div>
<div id="voice"></div>

<button onclick="createVC()">+ Create VC</button>

</div>

<div id="chat">

<div id="top">🔊 General VC</div>

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

let currentVC="General VC";

/* LOGIN */
socket.emit("login",user);

/* SEND (not chat spam, just VC test if needed) */
function send(){
msg.value="";
}

/* CREATE VC */
function createVC(){
let n=prompt("VC name");
if(!n) return;
socket.emit("createVC",n);
}

/* JOIN VC */
function joinVC(room){
currentVC=room;
socket.emit("joinVC",room);
renderVC([]);
}

/* RENDER VC */
socket.on("vcUpdate",data=>{

voice.innerHTML="";

Object.keys(data).forEach(room=>{

let d=document.createElement("div");
d.className="item";

if(room===currentVC)d.classList.add("active");

d.innerHTML="🔊 "+room+
"<div class='small'>"+data[room].join(", ")+"</div>";

d.onclick=()=>joinVC(room);

voice.appendChild(d);

});

});

/* INIT */
socket.on("vcUpdate",data=>{
renderVC(data);
});

function renderVC(data){
voice.innerHTML="";

Object.keys(data).forEach(room=>{

let d=document.createElement("div");
d.className="item";

if(room===currentVC)d.classList.add("active");

d.innerHTML="🔊 "+room+
"<div class='small'>"+data[room].join(", ")+"</div>";

d.onclick=()=>joinVC(room);

voice.appendChild(d);

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

/* ALWAYS SEND VC */
sendVC();
});

/* CREATE VC */
socket.on("createVC",name=>{
if(!vcRooms[name]){
vcRooms[name]=new Set();
}

sendVC();
});

/* JOIN VC */
socket.on("joinVC",room=>{

/* leave all */
for(let r in vcRooms){
vcRooms[r].delete(socket.id);
}

/* join */
if(!vcRooms[room]){
vcRooms[room]=new Set();
}

vcRooms[room].add(socket.id);

sendVC();
});

/* VC UPDATE */
function sendVC(){

let out={};

for(let r in vcRooms){
out[r]=Array.from(vcRooms[r]).map(id=>users.get(id)).filter(Boolean);
}

/* ensure General VC ALWAYS EXISTS */
if(!out["General VC"]) out["General VC"]=[];

io.emit("vcUpdate",out);
}

/* DISCONNECT */
socket.on("disconnect",()=>{

users.delete(socket.id);

for(let r in vcRooms){
vcRooms[r].delete(socket.id);
}

sendVC();

});

});

server.listen(3000,()=>{
console.log("VC FIXED: GENERAL + CREATOR READY");
});
