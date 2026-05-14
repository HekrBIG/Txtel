const express=require("express");
const http=require("http");
const {Server}=require("socket.io");
const bcrypt=require("bcryptjs");
const sqlite3=require("sqlite3").verbose();

const app=express();
const server=http.createServer(app);
const io=new Server(server);

const db=new sqlite3.Database("txtel.db");

const users=new Map();
const voiceUsers=new Map();

db.run(`CREATE TABLE IF NOT EXISTS users (
id INTEGER PRIMARY KEY AUTOINCREMENT,
username TEXT UNIQUE,
password TEXT
)`);

app.get("/",(req,res)=>{
res.send(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>TXTEL</title>
<style>
body{margin:0;font-family:Arial;background:#1e1f22;color:white;display:flex;height:100vh}
#sidebar{width:240px;background:#111;padding:10px}
#chat{flex:1;display:flex;flex-direction:column}
#messages{flex:1;overflow:auto;padding:10px}
.msg{background:#2b2d31;margin:5px;padding:8px;border-radius:8px}
.user,.voice{padding:10px;background:#2b2d31;margin:5px 0;border-radius:8px;cursor:pointer}
#bar{display:flex;padding:10px;background:#111;gap:10px}
input,button{padding:10px;border:none;border-radius:8px}
input{flex:1;background:#2b2d31;color:white}
button{background:#5865f2;color:white}
.badge{background:red;border-radius:999px;padding:2px 8px;font-size:12px;float:right}
</style></head><body>

<div id="sidebar">
<div class="voice" id="voiceBtn">🔊 Voice General</div>
<div id="voiceUsers"></div>
<hr>
<div id="users"></div>
</div>

<div id="chat">
<div id="messages"></div>
<div id="bar">
<input id="msg">
<button onclick="send()">Send</button>
</div>
</div>

<script src="/socket.io/socket.io.js"></script>
<script>
const socket=io();

let username=prompt("Username");
let password=prompt("Password");

socket.emit("login",{u:username,p:password});

let currentChat="general";
let unread={};
let chats=JSON.parse(localStorage.getItem("txtelChats")||"{}");

function save(){localStorage.setItem("txtelChats",JSON.stringify(chats));}

function render(){
messages.innerHTML="";
if(!chats[currentChat]) chats[currentChat]=[];
chats[currentChat].forEach(m=>{
let d=document.createElement("div");
d.className="msg";
d.innerHTML=m;
messages.appendChild(d);
});
}

socket.on("users",list=>{
users.innerHTML="";
list.forEach(u=>{
if(u===username)return;
let d=document.createElement("div");
d.className="user";
let b=unread[u]?"<span class='badge'>"+unread[u]+"</span>":"";
d.innerHTML=u+b;
d.onclick=()=>{
currentChat=u;
unread[u]=0;
render();
socket.emit("refreshUsers");
};
users.appendChild(d);
});
});

socket.on("message",m=>{
let room="general";
if(m.to&&(m.to===username||m.from===username)){
room=m.from===username?m.to:m.from;
}
if(!chats[room]) chats[room]=[];
chats[room].push("<b>"+m.from+":</b> "+m.text);
save();

if(room!==currentChat&&room!=="general"){
unread[room]=(unread[room]||0)+1;
socket.emit("refreshUsers");
}

if(room===currentChat) render();
});

function send(){
if(!msg.value)return;
socket.emit("message",{
text:msg.value,
to:currentChat==="general"?null:currentChat
});
msg.value="";
}

msg.addEventListener("keydown",e=>{
if(e.key==="Enter") send();
});

let localStream;

voiceBtn.onclick=async()=>{
if(localStream)return;
localStream=await navigator.mediaDevices.getUserMedia({audio:true});
socket.emit("joinVoice");
};

socket.on("voiceUsers",list=>{
voiceUsers.innerHTML="";
list.forEach(v=>{
let d=document.createElement("div");
d.className="user";
d.innerHTML=v.name+(v.speaking?" 🎤":"");
voiceUsers.appendChild(d);
});
});

</script></body></html>`);
});

io.on("connection",socket=>{

socket.on("refreshUsers",()=>{
io.emit("users",Array.from(users.values()));
});

socket.on("login",({u,p})=>{
db.get("SELECT * FROM users WHERE username=?",[u],(e,row)=>{
if(!row){
bcrypt.hash(p,10,(e,h)=>{
db.run("INSERT INTO users(username,password) VALUES(?,?)",[u,h]);
});
socket.username=u;
users.set(socket.id,u);
io.emit("users",Array.from(users.values()));
return;
}

bcrypt.compare(p,row.password,(e,ok)=>{
if(!ok)return;
socket.username=u;
users.set(socket.id,u);
io.emit("users",Array.from(users.values()));
});
});
});

socket.on("message",data=>{
io.emit("message",{
from:socket.username,
text:data.text,
to:data.to||null
});
});

socket.on("joinVoice",()=>{
voiceUsers.set(socket.id,{
name:socket.username,
speaking:false
});
io.emit("voiceUsers",Array.from(voiceUsers.values()));
});

socket.on("disconnect",()=>{
users.delete(socket.id);
voiceUsers.delete(socket.id);
io.emit("users",Array.from(users.values()));
io.emit("voiceUsers",Array.from(voiceUsers.values()));
});

});

server.listen(process.env.PORT||3000,()=>{
console.log("TXTEL RUNNING");
});
