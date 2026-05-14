const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const bcrypt = require("bcryptjs");
const sqlite3 = require("sqlite3").verbose();

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const db = new sqlite3.Database("txtel.db");

const users = new Map();
const voiceUsers = new Map();

db.run(`
CREATE TABLE IF NOT EXISTS users (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 username TEXT UNIQUE,
 password TEXT
)
`);

app.get("/", (req, res) => {

res.send(`

<!DOCTYPE html>
<html>
<head>

<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">

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

#sidebar{
width:260px;
background:#111214;
padding:10px;
overflow:auto;
box-sizing:border-box;
}

#chat{
flex:1;
display:flex;
flex-direction:column;
}

#top{
padding:15px;
background:#111214;
font-size:20px;
border-bottom:1px solid #333;
}

#messages{
flex:1;
overflow:auto;
padding:10px;
}

.msg{
background:#2b2d31;
padding:8px;
margin:5px 0;
border-radius:8px;
word-break:break-word;
}

#bar{
display:flex;
gap:10px;
padding:10px;
background:#111214;
}

input,button{
border:none;
padding:10px;
border-radius:8px;
}

input{
flex:1;
background:#2b2d31;
color:white;
}

button{
background:#4aa3ff;
color:white;
cursor:pointer;
}

.channel,.voice,.user{
padding:10px;
margin:5px 0;
border-radius:8px;
background:#2b2d31;
cursor:pointer;
transition:.2s;
}

.channel:hover,
.voice:hover,
.user:hover{
background:#3a3d45;
}

.active{
background:#4aa3ff !important;
}

.badge{
background:red;
padding:2px 8px;
border-radius:999px;
float:right;
font-size:12px;
}

#voiceUsers{
margin-top:10px;
}

.voiceUser{
padding:8px;
background:#1f2125;
margin:4px 0;
border-radius:6px;
}

.speaking{
background:#4aa3ff !important;
}

</style>

</head>

<body>

<div id="sidebar">

<h3>Chats</h3>

<div id="chatChannels"></div>

<button onclick="createChat()">+ Chat</button>

<hr>

<h3>Voice</h3>

<div id="voiceChannels"></div>

<button onclick="createVC()">+ VC</button>

<div id="voiceUsers"></div>

<hr>

<h3>Users</h3>

<div id="users"></div>

</div>

<div id="chat">

<div id="top"># general</div>

<div id="messages"></div>

<div id="bar">

<input id="msg" placeholder="message">

<button onclick="send()">Send</button>

<button id="muteBtn" onclick="muteMic()">🎤 Mute</button>

<button id="deafenBtn" onclick="deafen()">🎧 Deafen</button>

</div>

</div>

<script src="/socket.io/socket.io.js"></script>

<script>

const socket = io();

let username = prompt("Username");
let password = prompt("Password");

socket.emit("login",{
u:username,
p:password
});

let currentChat = "general";
let currentVC = null;

let unread = {};

let chats =
JSON.parse(
localStorage.getItem("txtelChats") || "{}"
);

let textChannels = ["general"];
let voiceChannels = ["General VC"];

let localStream;
let muted = false;
let deaf = false;

// ================= SAVE =================

function saveChats(){

localStorage.setItem(
"txtelChats",
JSON.stringify(chats)
);

}

// ================= RENDER =================

function render(){

messages.innerHTML = "";

if(!chats[currentChat]){
chats[currentChat] = [];
}

chats[currentChat].forEach(m=>{

const div = document.createElement("div");

div.className = "msg";

div.innerHTML = m;

messages.appendChild(div);

});

messages.scrollTop =
messages.scrollHeight;
}

// ================= CHANNELS =================

function renderChannels(){

chatChannels.innerHTML = "";
voiceChannels.innerHTML = "";

textChannels.forEach(c=>{

let div = document.createElement("div");

div.className = "channel";

if(currentChat === c){
div.classList.add("active");
}

div.innerText = "# " + c;

div.onclick = ()=>{

currentChat = c;

top.innerText = "# " + c;

render();

renderChannels();
};

chatChannels.appendChild(div);

});

voiceChannels.forEach(c=>{

let div = document.createElement("div");

div.className = "voice";

if(currentVC === c){
div.classList.add("active");
}

div.innerText = "🔊 " + c;

div.onclick = ()=>{
joinVC(c);
};

voiceChannels.appendChild(div);

});
}

// ================= CREATE CHAT =================

function createChat(){

let name = prompt("Chat name");

if(!name) return;

textChannels.push(name);

renderChannels();
}

// ================= CREATE VC =================

function createVC(){

let name = prompt("VC name");

if(!name) return;

voiceChannels.push(name);

renderChannels();
}

// ================= USERS =================

socket.on("users", list=>{

users.innerHTML = "";

list.forEach(u=>{

if(u === username) return;

let div = document.createElement("div");

div.className = "user";

let badge =
unread[u]
? "<span class='badge'>" + unread[u] + "</span>"
: "";

div.innerHTML = u + badge;

div.onclick = ()=>{

currentChat = u;

top.innerText = "@ " + u;

unread[u] = 0;

render();

socket.emit("refreshUsers");

};

users.appendChild(div);

});
});

// ================= MESSAGE =================

socket.on("message", m=>{

let room = "general";

if(
m.to &&
(m.to === username || m.from === username)
){

room =
m.from === username
? m.to
: m.from;

}

if(!chats[room]){
chats[room] = [];
}

chats[room].push(
"<b>" + m.from + ":</b> " + m.text
);

saveChats();

if(
room !== currentChat &&
room !== "general"
){

unread[room] =
(unread[room] || 0) + 1;

socket.emit("refreshUsers");
}

if(room === currentChat){
render();
}

});

// ================= SEND =================

function send(){

if(!msg.value) return;

socket.emit("message",{

text:msg.value,

to:
currentChat === "general"
? null
: currentChat

});

msg.value = "";
}

msg.addEventListener("keydown", e=>{

if(e.key === "Enter"){
send();
}

});

// ================= JOIN VC =================

async function joinVC(name){

currentVC = name;

renderChannels();

if(!localStream){

localStream =
await navigator.mediaDevices.getUserMedia({
audio:true
});

}

socket.emit("joinVoice", name);

startSpeakingDetect();
}

// ================= SPEAK DETECT =================

function startSpeakingDetect(){

const ctx = new AudioContext();

const src =
ctx.createMediaStreamSource(localStream);

const analyser = ctx.createAnalyser();

src.connect(analyser);

const data =
new Uint8Array(analyser.fftSize);

function loop(){

analyser.getByteTimeDomainData(data);

let sum = 0;

for(let i=0;i<data.length;i++){

sum += Math.abs(data[i]-128);

}

socket.emit("speaking", sum > 800);

requestAnimationFrame(loop);
}

loop();
}

// ================= VC USERS =================

socket.on("voiceUsers", list=>{

voiceUsers.innerHTML = "";

list.forEach(v=>{

const div = document.createElement("div");

div.className = "voiceUser";

if(v.speaking){
div.classList.add("speaking");
}

div.innerHTML =
v.name +
(v.speaking ? " 🎤" : "");

voiceUsers.appendChild(div);

});
});

// ================= MUTE =================

function muteMic(){

if(!localStream) return;

muted = !muted;

localStream.getAudioTracks().forEach(t=>{

t.enabled = !muted;

});

if(muted){

muteBtn.style.background = "red";

muteBtn.innerText = "🔇 Unmute";
}
else{

muteBtn.style.background = "#4aa3ff";

muteBtn.innerText = "🎤 Mute";
}
}

// ================= DEAFEN =================

function deafen(){

deaf = !deaf;

document.querySelectorAll("audio")
.forEach(a=>{

a.muted = deaf;

});

if(deaf){

deafenBtn.style.background = "red";

deafenBtn.innerText =
"🎧 Undeafen";
}
else{

deafenBtn.style.background =
"#4aa3ff";

deafenBtn.innerText =
"🎧 Deafen";
}
}

// ================= START =================

render();
renderChannels();

</script>

</body>
</html>

`);

});

// ================= SOCKET =================

io.on("connection", socket=>{

socket.on("refreshUsers", ()=>{

io.emit(
"users",
Array.from(users.values())
);

});

// ================= LOGIN =================

socket.on("login", ({u,p})=>{

db.get(
"SELECT * FROM users WHERE username=?",
[u],

(err,row)=>{

if(!row){

bcrypt.hash(p,10,(err,hash)=>{

db.run(
"INSERT INTO users(username,password) VALUES(?,?)",
[u,hash]
);

});

socket.username = u;

users.set(socket.id,u);

io.emit(
"users",
Array.from(users.values())
);

return;
}

bcrypt.compare(
p,
row.password,

(err,ok)=>{

if(!ok) return;

socket.username = u;

users.set(socket.id,u);

io.emit(
"users",
Array.from(users.values())
);

});

});
});

// ================= MESSAGE =================

socket.on("message", data=>{

io.emit("message",{

from:socket.username,

text:data.text,

to:data.to || null

});

});

// ================= JOIN VOICE =================

socket.on("joinVoice", room=>{

voiceUsers.set(socket.id,{

name:socket.username,

room:room,

speaking:false

});

io.emit(
"voiceUsers",
Array.from(voiceUsers.values())
);

});

// ================= SPEAKING =================

socket.on("speaking", speaking=>{

if(!voiceUsers.has(socket.id)) return;

let v = voiceUsers.get(socket.id);

v.speaking = speaking;

voiceUsers.set(socket.id,v);

io.emit(
"voiceUsers",
Array.from(voiceUsers.values())
);

});

// ================= DISCONNECT =================

socket.on("disconnect", ()=>{

users.delete(socket.id);

voiceUsers.delete(socket.id);

io.emit(
"users",
Array.from(users.values())
);

io.emit(
"voiceUsers",
Array.from(voiceUsers.values())
);

});

});

// ================= START =================

server.listen(
process.env.PORT || 3000,
()=>{

console.log("TXTEL RUNNING");

});
