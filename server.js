const express=require("express");
const http=require("http");
const {Server}=require("socket.io");
const multer=require("multer");
const path=require("path");
const fs=require("fs");

const app=express();
const server=http.createServer(app);
const io=new Server(server,{cors:{origin:"*"}});

/* ================= FILES ================= */

if(!fs.existsSync("uploads")) fs.mkdirSync("uploads");

app.use("/uploads",express.static("uploads"));

const storage=multer.diskStorage({
destination:(req,file,cb)=>cb(null,"uploads/"),
filename:(req,file,cb)=>cb(null,Date.now()+path.extname(file.originalname))
});

const upload=multer({storage});

app.post("/upload",upload.single("file"),(req,res)=>{
res.json({url:"/uploads/"+req.file.filename});
});

/* ================= STATE ================= */

const users=new Map();
const vcStates=new Map();

let chats=["general"];
let vcs=["General VC"];

/* ================= APP ================= */

app.get("/",(req,res)=>{

res.send(`<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>TXTEL VC+</title>

<style>

/* ================= BASE ================= */

html,body{
margin:0;
padding:0;
height:100%;
font-family:Arial;
background:#1e1f22;
color:white;
overflow:hidden;
}

/* ================= LAYOUT ================= */

body{
display:flex;
}

/* ================= SIDEBAR ================= */

#sidebar{
width:280px;
background:#0f1012;
padding:10px;
overflow:auto;
border-right:1px solid #222;
flex-shrink:0;
}

.section{
margin-bottom:15px;
}

.item{
background:#232428;
padding:10px;
margin:5px 0;
border-radius:10px;
cursor:pointer;
display:flex;
justify-content:space-between;
align-items:center;
}

.item:hover{background:#313338;}

.active{background:#4aa3ff!important;}

/* ================= CHAT ================= */

#chat{
flex:1;
display:flex;
flex-direction:column;
min-width:0;
}

#top{
padding:12px;
background:#111214;
border-bottom:1px solid #222;
}

#messages{
flex:1;
overflow:auto;
padding:10px;
min-height:0;
}

.msg{
background:#2b2d31;
padding:8px;
margin:5px 0;
border-radius:8px;
word-break:break-word;
}

/* ================= INPUT ================= */

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

/* ================= VC ================= */

#vcPanel{
padding:10px;
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

.volumeWrap{
width:12px;
height:42px;
background:#555;
border-radius:999px;
overflow:hidden;
display:flex;
align-items:flex-end;
margin-left:6px;
}

.volumeFill{
width:100%;
height:0%;
background:#4aa3ff;
}

/* ================= BADGE ================= */

.badge{
background:#4aa3ff;
color:white;
border-radius:999px;
font-size:11px;
min-width:18px;
height:18px;
display:flex;
align-items:center;
justify-content:center;
padding:0 5px;
margin-left:6px;
}

/* ================= MOBILE ================= */

@media(max-width:768px){

#sidebar{
position:absolute;
left:-100%;
top:0;
height:100%;
z-index:999;
transition:0.2s;
}

#sidebar.open{
left:0;
}

#chat{
width:100%;
}

#mobileBtn{
display:block;
position:absolute;
top:10px;
left:10px;
z-index:1000;
background:#4aa3ff;
padding:10px;
border-radius:8px;
}

}

#mobileBtn{display:none;}

audio{display:none;}

</style>
</head>

<body>

<div id="mobileBtn" onclick="toggleMenu()">☰</div>

<div id="sidebar">

<div id="channels"></div>
<button onclick="addChat()">+ Chat</button>

<hr>

<div id="voiceChannels"></div>
<button onclick="addVC()">+ VC</button>

<hr>

<div id="users"></div>

</div>

<div id="chat">

<div id="top"># general</div>

<div id="messages"></div>

<div id="bar">
<input id="msgInput">
<input type="file" id="fileInput" hidden>
<button onclick="fileInput.click()">📎</button>
<button onclick="send()">Send</button>
</div>

<div id="vcPanel"></div>

</div>

<script src="/socket.io/socket.io.js"></script>

<script>

const socket=io();

let username=localStorage.getItem("tx_user");
if(!username){
username=prompt("Name")||"user"+Math.floor(Math.random()*9999);
localStorage.setItem("tx_user",username);
}

socket.emit("login",username);

/* ================= STATE ================= */

let room="general";
let vc=null;

let chatsMap={};
let unread={};

let streams=null;
let muted=false;
let deaf=false;

/* ================= MOBILE ================= */

function toggleMenu(){
document.getElementById("sidebar").classList.toggle("open");
}

/* ================= CHAT ================= */

socket.on("chatList",list=>{
window._chats=list;
renderChats();
});

function renderChats(){
channels.innerHTML="";
window._chats.forEach(c=>{

let d=document.createElement("div");
d.className="item";

if(c===room)d.classList.add("active");

d.innerHTML=c+(unread[c]?` <span class="badge">${unread[c]}</span>`:"");

d.onclick=()=>{
room=c;
unread[c]=0;
renderChats();
renderMessages();
};

channels.appendChild(d);
});
}

function addChat(){
let n=prompt("chat");
if(n) socket.emit("createChat",n);
}

/* ================= VC ================= */

socket.on("vcList",list=>{
window._vcs=list;
renderVC();
});

function renderVC(){
voiceChannels.innerHTML="";
window._vcs.forEach(v=>{
let d=document.createElement("div");
d.className="item";
if(v===vc)d.classList.add("active");
d.innerText="🔊 "+v;
d.onclick=()=>joinVC(v);
voiceChannels.appendChild(d);
});
}

function addVC(){
let n=prompt("vc");
if(n) socket.emit("createVC",n);
}

/* ================= USERS ================= */

socket.on("users",list=>{
users.innerHTML="";
list.forEach(u=>{
if(u===username)return;
let d=document.createElement("div");
d.className="item";
d.innerText=u;
users.appendChild(d);
});
});

/* ================= SEND ================= */

function send(){
let t=msgInput.value.trim();
if(!t)return;
socket.emit("message",{room,text:t});
msgInput.value="";
}

/* ================= MSG ================= */

socket.on("message",m=>{

if(!chatsMap[m.room]) chatsMap[m.room]=[];
chatsMap[m.room].push(m);

if(m.room!==room){
unread[m.room]=(unread[m.room]||0)+1;
}

if(m.room===room) renderMessages();

renderChats();
});

function renderMessages(){
messages.innerHTML="";
(chatsMap[room]||[]).forEach(m=>{
let d=document.createElement("div");
d.className="msg";
d.innerHTML="<b>"+m.from+":</b> "+m.text;
messages.appendChild(d);
});
}

/* ================= VC JOIN ================= */

async function joinVC(v){

vc=v;

if(!streams){
streams=await navigator.mediaDevices.getUserMedia({audio:true});
volumeLoop();
}

socket.emit("joinVC",v);
}

/* ================= VC LEAVE ================= */

function leaveVC(){
vc=null;
socket.emit("leaveVC");
}

/* ================= VOLUME ================= */

function volumeLoop(){

const ctx=new AudioContext();
const src=ctx.createMediaStreamSource(streams);
const a=ctx.createAnalyser();
a.fftSize=512;

src.connect(a);

const data=new Uint8Array(a.frequencyBinCount);

function loop(){

a.getByteFrequencyData(data);

let sum=0;
for(let i=0;i<data.length;i++)sum+=data[i];

let vol=Math.min(100,Math.floor(sum/data.length/1.3));

socket.emit("voiceData",{volume:vol,speaking:vol>10});

requestAnimationFrame(loop);
}

loop();
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

socket.emit("chatList",chats);
socket.emit("vcList",vcs);

io.emit("users",Array.from(users.values()));
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
socket.on("message",m=>{
io.emit("message",{from:socket.username,...m});
});

/* VC JOIN */
socket.on("joinVC",room=>{
vcStates.set(socket.id,{
name:socket.username,
room,
muted:false,
deaf:false,
volume:0,
speaking:false
});

io.emit("vcUsers",Array.from(vcStates.values()));
});

/* VC DATA */
socket.on("voiceData",d=>{
if(!vcStates.has(socket.id))return;

let u=vcStates.get(socket.id);
u.volume=d.volume;
u.speaking=d.speaking;

vcStates.set(socket.id,u);

io.emit("vcUsers",Array.from(vcStates.values()));
});

/* DISCONNECT */
socket.on("disconnect",()=>{
users.delete(socket.id);
vcStates.delete(socket.id);

io.emit("users",Array.from(users.values()));
io.emit("vcUsers",Array.from(vcStates.values()));
});

});

server.listen(process.env.PORT||3000,()=>{
console.log("TXTEL VC MOBILE READY");
});
