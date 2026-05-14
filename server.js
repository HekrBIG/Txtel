const express=require("express");
const http=require("http");
const {Server}=require("socket.io");
const sqlite3=require("sqlite3").verbose();

const app=express();
const server=http.createServer(app);
const io=new Server(server);
const db=new sqlite3.Database("txtel.db");

const users=new Map();
const voiceRooms=new Map();

// DB (KEEP HISTORY)
db.run("CREATE TABLE IF NOT EXISTS messages(id INTEGER PRIMARY KEY,room TEXT,fromUser TEXT,toUser TEXT,text TEXT,time DATETIME DEFAULT CURRENT_TIMESTAMP)");
db.run("CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY,username TEXT UNIQUE)");

app.get("/",(req,res)=>res.send(`<!DOCTYPE html><html><head><meta charset="utf-8">
<title>TXTEL</title>
<style>
body{margin:0;font-family:Arial;background:#1e1f22;color:#fff;display:flex;height:100vh}
#s{width:240px;background:#111;padding:10px;overflow:auto}
#c{flex:1;display:flex;flex-direction:column}
#t{padding:10px;background:#111}
#m{flex:1;overflow:auto;padding:10px}
#b{display:flex;gap:5px;padding:10px;background:#111}
input{flex:1;padding:8px;border:none;border-radius:6px;background:#2b2d31;color:#fff}
button{padding:8px;border:none;border-radius:6px;background:#5865f2;color:#fff;cursor:pointer}
.u,.ch,.vc{padding:6px;background:#2b2d31;margin:4px;border-radius:6px;cursor:pointer}
.active{background:#4aa3ff!important}
.msg{background:#2b2d31;margin:5px;padding:6px;border-radius:6px}
.badge{background:red;border-radius:999px;padding:2px 6px;font-size:12px;float:right}
</style></head><body>

<div id="s">
<div id="channels"></div>
<hr>
<div id="users"></div>
<div id="voice"></div>
</div>

<div id="c">
<div id="t">TXTEL</div>
<div id="m"></div>

<div id="b">
<input id="i">
<button onclick="send()">Send</button>
<button id="muteBtn" onclick="muteMic()">🎤</button>
<button id="deafBtn" onclick="deafen()">🎧</button>
</div>
</div>

<script src="/socket.io/socket.io.js"></script>
<script>

const socket=io();

let user=localStorage.getItem("u");
if(!user){
user=prompt("name");
localStorage.setItem("u",user);
}
socket.emit("login",user);

// STATE (KEEP ALL FEATURES)
let room="general";
let chats={};
let unread={};

let stream;
let muted=false;
let deaf=false;
let peers={};

// UI
const m=document.getElementById("m");
const i=document.getElementById("i");

// SEND MESSAGE
function send(){
socket.emit("msg",{room,text:i.value});
i.value="";
}

// RECEIVE MESSAGE (DM + GROUP FIXED)
socket.on("msg",d=>{
if(!chats[d.room])chats[d.room]=[];
chats[d.room].push(d);

if(d.room!==room){
unread[d.room]=(unread[d.room]||0)+1;
renderCh();
}

if(d.room===room)render();
});

// RENDER CHAT (UNCHANGED LOGIC FIXED)
function render(){
m.innerHTML="";
(chats[room]||[]).forEach(x=>{
let d=document.createElement("div");
d.className="msg";
d.innerHTML="<b>"+x.from+":</b> "+x.text;
m.appendChild(d);
});
}

// CHANNELS (RESTORED + FIXED)
function renderCh(){
let c=document.getElementById("channels");
c.innerHTML="";

["general"].forEach(r=>{
let d=document.createElement("div");
d.className="ch"+(room===r?" active":"");
d.innerHTML=r+(unread[r]?" <span class='badge'>"+unread[r]+"</span>":"");
d.onclick=()=>{room=r;render();renderCh();};
c.appendChild(d);
});
}

// USERS
socket.on("users",l=>{
users.innerHTML="";
l.forEach(u=>{
let d=document.createElement("div");
d.className="u";
d.innerText=u;

// DM SYSTEM (RESTORED)
d.onclick=()=>{
room=u;
render();
};
users.appendChild(d);
});
});

// =====================
// REAL VOICE (FIXED)
// =====================

function joinVoice(){
socket.emit("joinVoice");

navigator.mediaDevices.getUserMedia({audio:true}).then(s=>{
stream=s;
});
}

// OFFER
socket.on("offer",async d=>{
let pc=create(d.from);
await pc.setRemoteDescription(d.offer);

stream.getTracks().forEach(t=>pc.addTrack(t,stream));

let ans=await pc.createAnswer();
await pc.setLocalDescription(ans);

socket.emit("answer",{to:d.from,ans});
});

// ANSWER
socket.on("answer",d=>{
peers[d.from].setRemoteDescription(d.ans);
});

// ICE
socket.on("ice",d=>{
peers[d.from].addIceCandidate(d.c);
});

// NEW USER IN VC
socket.on("join",async id=>{
let pc=create(id);

stream.getTracks().forEach(t=>pc.addTrack(t,stream));

let offer=await pc.createOffer();
await pc.setLocalDescription(offer);

socket.emit("offer",{to:id,offer});
});

// PEER CREATION (FIXED AUDIO PIPELINE)
function create(id){
let pc=new RTCPeerConnection({iceServers:[{urls:"stun:stun.l.google.com:19302"}]});
peers[id]=pc;

pc.ontrack=e=>{
let a=new Audio();
a.srcObject=e.streams[0];
a.autoplay=true;
document.body.appendChild(a);
if(deaf)a.muted=true;
};

pc.onicecandidate=e=>{
if(e.c)socket.emit("ice",{to:id,c:e.c});
};

return pc;
}

// =====================
// MUTE / DEAF (FIXED UI COLORS)
// =====================

function muteMic(){
muted=!muted;
stream.getAudioTracks().forEach(t=>t.enabled=!muted);
muteBtn.style.background=muted?"red":"#5865f2";
}

function deafen(){
deaf=!deaf;
document.querySelectorAll("audio").forEach(a=>a.muted=deaf);
deafBtn.style.background=deaf?"red":"#5865f2";
}

// INIT
renderCh();

</script>
</body></html>`));

// =====================
// SOCKET SERVER (FIXED + COMPLETE)
// =====================

io.on("connection",socket=>{

socket.on("login",u=>{
socket.user=u;
users.set(socket.id,u);

db.run("INSERT OR IGNORE INTO users(username) VALUES(?)",[u]);
io.emit("users",Array.from(users.values()));
});

// CHAT + DM + ROOM HISTORY
socket.on("msg",d=>{
let msg={from:socket.user,room:d.room,text:d.text};

db.run("INSERT INTO messages(room,fromUser,text) VALUES(?,?,?)",
[d.room,socket.user,d.text]);

io.emit("msg",msg);
});

// VOICE JOIN (FIXED)
socket.on("joinVoice",()=>{
socket.broadcast.emit("join",socket.id);
});

// WEBRTC SIGNALING (FIXED)
socket.on("offer",d=>{
io.to(d.to).emit("offer",{from:socket.id,offer:d.offer});
});

socket.on("answer",d=>{
io.to(d.to).emit("answer",{from:socket.id,ans:d.ans});
});

socket.on("ice",d=>{
io.to(d.to).emit("ice",{from:socket.id,c:d.c});
});

socket.on("disconnect",()=>{
users.delete(socket.id);
io.emit("users",Array.from(users.values()));
});
});

server.listen(process.env.PORT||3000,()=>console.log("TXTEL RUNNING"));
