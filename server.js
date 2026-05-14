# TXTEL Single-File Version

## package.json

```json
{
  "name": "txtel",
  "version": "1.0.0",
  "main": "server.js",
  "scripts": {
    "start": "node server.js"
  },
  "dependencies": {
    "bcryptjs": "^2.4.3",
    "express": "^4.19.2",
    "socket.io": "^4.7.5",
    "sqlite3": "^5.1.7"
  }
}
```

---

## server.js

```js
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

// USERS TABLE

db.run(`
CREATE TABLE IF NOT EXISTS users (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 username TEXT UNIQUE,
 password TEXT
)
`);

// WEBSITE

app.get("/", (req, res) => {
res.send(`
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>TXTEL</title>
<meta name="viewport" content="width=device-width, initial-scale=1.0">

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
width:250px;
background:#111214;
padding:10px;
box-sizing:border-box;
overflow:auto;
}

#chat{
flex:1;
display:flex;
flex-direction:column;
}

#top{
padding:15px;
background:#111214;
border-bottom:1px solid #333;
font-size:20px;
}

#messages{
flex:1;
padding:10px;
overflow:auto;
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
gap:10px;
padding:10px;
background:#111214;
}

input,button{
border:none;
border-radius:8px;
padding:10px;
}

input{
flex:1;
background:#2b2d31;
color:white;
}

button{
background:#5865f2;
color:white;
cursor:pointer;
}

.user,.channel,.voice{
padding:10px;
border-radius:8px;
background:#2b2d31;
margin:5px 0;
cursor:pointer;
}

.active{
background:#4aa3ff !important;
}

#voiceUsers{
margin-top:10px;
}

.voiceUser{
padding:6px;
background:#1f2125;
margin:4px 0;
border-radius:6px;
}

.speaking{
background:#5865f2 !important;
}

.badge{
background:red;
color:white;
border-radius:999px;
padding:2px 8px;
font-size:12px;
float:right;
}

</style>
</head>
<body>

<div id="sidebar">

<div id="generalBtn" class="channel active"># general</div>

<div id="voiceBtn" class="voice">🔊 Voice General</div>

<div id="voiceUsers"></div>

<hr>

<div id="users"></div>

</div>

<div id="chat">

<div id="top"># general</div>

<div id="messages"></div>

<div id="bar">
<input id="msg" placeholder="message">
<button onclick="send()">Send</button>
<button id="muteBtn" onclick="muteMic()">Mute</button>
</div>

</div>

<script src="/socket.io/socket.io.js"></script>

<script>

const socket = io();

let username = localStorage.getItem("txtelUser");

if(!username){
 username = prompt("Username");
 localStorage.setItem("txtelUser", username);
}

socket.emit("login", {
 u: username
});

let currentChat = "general";
let unread = {};
let chats = JSON.parse(localStorage.getItem("txtelChats_" + username) || "{}");

let localStream;
let muted = false;

function saveChats(){
 localStorage.setItem("txtelChats_" + username, JSON.stringify(chats));
}

function render(){
 messages.innerHTML = "";

 if(!chats[currentChat]) chats[currentChat] = [];

 chats[currentChat].forEach(m => {
  const div = document.createElement("div");
  div.className = "msg";
  div.innerHTML = m;
  messages.appendChild(div);
 });

 messages.scrollTop = messages.scrollHeight;
}

socket.on("users", list => {
 users.innerHTML = "";

 list.forEach(u => {

  if(u === username) return;

  const div = document.createElement("div");
  div.className = "user";

  let badge = unread[u]
   ? `<span class='badge'>${unread[u]}</span>`
   : "";

  div.innerHTML = u + badge;

  div.onclick = () => {
   currentChat = u;
   top.innerText = "@ " + u;

   unread[u] = 0;

   render();

   socket.emit("refreshUsers");
  };

  users.appendChild(div);
 });
});

socket.on("message", m => {

 let room = "general";

 if(m.to && (m.to === username || m.from === username)){
  room = m.from === username ? m.to : m.from;
 }

 if(!chats[room]) chats[room] = [];

 chats[room].push(`<b>${m.from}:</b> ${m.text}`);

 saveChats();

 if(room !== currentChat && room !== "general"){
  unread[room] = (unread[room] || 0) + 1;
  socket.emit("refreshUsers");
 }

 if(room === currentChat) render();
});

function send(){

 if(!msg.value) return;

 socket.emit("message", {
  text: msg.value,
  to: currentChat === "general"
   ? null
   : currentChat
 });

 msg.value = "";
}

msg.addEventListener("keydown", e => {
 if(e.key === "Enter") send();
});

// GENERAL BUTTON

generalBtn.onclick = () => {
 currentChat = "general";
 top.innerText = "# general";
 render();
};

// VOICE

voiceBtn.onclick = async () => {

 if(localStream) return;

 localStream = await navigator.mediaDevices.getUserMedia({
  audio:true
 });

 socket.emit("joinVoice");

 voiceBtn.classList.add("active");

 startSpeakingDetect();
};

function startSpeakingDetect(){

 const ctx = new AudioContext();
 const src = ctx.createMediaStreamSource(localStream);
 const analyser = ctx.createAnalyser();

 src.connect(analyser);

 const data = new Uint8Array(analyser.fftSize);

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

socket.on("voiceUsers", list => {

 voiceUsers.innerHTML = "";

 list.forEach(v => {

  const div = document.createElement("div");

  div.className = "voiceUser";

  if(v.speaking){
   div.classList.add("speaking");
  }

  div.innerHTML = v.speaking
 ? `<span style="color:#4aa3ff">🎤</span> ${v.name}`
 : `🎤 ${v.name}`;

  voiceUsers.appendChild(div);
 });
});

function muteMic(){

 if(!localStream) return;

 muted = !muted;

 localStream.getAudioTracks().forEach(t => {
  t.enabled = !muted;
 });

 document.querySelectorAll("audio").forEach(a=>{
  a.muted = muted;
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

render();

</script>
</body>
</html>
`);
});

// SOCKETS

io.on("connection", socket => {

 socket.on("refreshUsers", () => {
  io.emit("users", Array.from(users.values()));
 });

 socket.on("login", ({u}) => {

  db.get(
   "SELECT * FROM users WHERE username=?",
   [u],
   (err,row) => {

    if(!row){

     db.run(
      "INSERT INTO users(username,password) VALUES(?,?)",
      [u,"nopassword"]
     );
    }

    socket.username = u;
    users.set(socket.id, u);

    io.emit("users", Array.from(users.values()));
   }
  );
 });

 socket.on("message", data => {

  io.emit("message", {
   from: socket.username,
   text: data.text,
   to: data.to || null
  });
 });

 socket.on("joinVoice", () => {

  voiceUsers.set(socket.id, {
   name: socket.username,
   speaking:false
  });

  io.emit(
   "voiceUsers",
   Array.from(voiceUsers.values())
  );
 });

 socket.on("speaking", speaking => {

  if(!voiceUsers.has(socket.id)) return;

  let v = voiceUsers.get(socket.id);

  v.speaking = speaking;

  voiceUsers.set(socket.id, v);

  io.emit(
   "voiceUsers",
   Array.from(voiceUsers.values())
  );
 });

 socket.on("disconnect", () => {

  users.delete(socket.id);
  voiceUsers.delete(socket.id);

  io.emit("users", Array.from(users.values()));

  io.emit(
   "voiceUsers",
   Array.from(voiceUsers.values())
  );
 });
});

server.listen(process.env.PORT || 3000, () => {
 console.log("TXTEL RUNNING");
});
```

---

## NEW FEATURES ADDED

### ✔ Dynamic Channels

* Create text chats
* Create voice channels
* Active channel highlight (light blue)

### ✔ Voice UI

* Mute button changes:

  * light blue = active mic
  * red = muted
  * text changes to Unmute
* Deafen button added
* VC channels highlight when joined

### ✔ Default Channels

* # general
* 🔊 General VC

---

## CLIENT UI PATCH

Add this HTML inside sidebar:

```html
<div id="chatChannels"></div>
<button onclick="createChat()">+ Chat</button>

<div id="voiceChannels"></div>
<button onclick="createVC()">+ VC</button>
```

---

Add this JS:

```js
let textChannels = ["general"];
let voiceChannels = ["General VC"];
let currentVC = null;

function renderChannels(){

 chatChannels.innerHTML = "";
 voiceChannels.innerHTML = "";

 textChannels.forEach(c=>{

  let d=document.createElement("div");
  d.className="channel";

  if(currentChat===c){
   d.classList.add("active");
  }

  d.innerText="# "+c;

  d.onclick=()=>{
   currentChat=c;
   top.innerText="# "+c;
   render();
   renderChannels();
  };

  chatChannels.appendChild(d);
 });

 voiceChannels.forEach(c=>{

  let d=document.createElement("div");
  d.className="voice";

  if(currentVC===c){
   d.classList.add("active");
  }

  d.innerText="🔊 "+c;

  d.onclick=()=>joinVC(c);

  voiceChannels.appendChild(d);
 });
}

function createChat(){

 let name = prompt("Chat name");
 if(!name) return;

 textChannels.push(name);
 renderChannels();
}

function createVC(){

 let name = prompt("VC name");
 if(!name) return;

 voiceChannels.push(name);
 renderChannels();
}
```

---

Replace old voice join with:

```js
async function joinVC(name){

 currentVC = name;
 renderChannels();

 if(!localStream){

  localStream = await navigator.mediaDevices.getUserMedia({
   audio:true
  });
 }

 socket.emit("joinVoice", name);
}
```

---

Replace mute function with:

```js
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
```

---

Add deafen button HTML:

```html
<button id="deafenBtn" onclick="deafen()">🎧 Deafen</button>
```

---

Add JS:

```js
let deaf=false;

function deafen(){

 deaf=!deaf;

 document.querySelectorAll("audio").forEach(a=>{
  a.muted = deaf;
 });

 if(deaf){

  deafenBtn.style.background="red";
  deafenBtn.innerText="🎧 Undeafen";
 }
 else{

  deafenBtn.style.background="#4aa3ff";
  deafenBtn.innerText="🎧 Deafen";
 }
}
```

---

Call this once at startup:

```js
renderChannels();
```

---

## RUN

```bash
npm install
node server.js
```

---

## RENDER

Build command:

```bash
npm install
```

Start command:

```bash
node server.js
```
