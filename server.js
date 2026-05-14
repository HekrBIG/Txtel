const express=require("express");
const http=require("http");
const {Server}=require("socket.io");
const multer=require("multer");
const path=require("path");
const fs=require("fs");

const app=express();
const server=http.createServer(app);
const io=new Server(server,{cors:{origin:"*"}});

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

const users=new Map();
const vcStates=new Map();

let chats=["general"];
let vcs=["General VC"];

let typing=new Map();

app.get("/",(req,res)=>{

res.send(`<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>TXTEL</title>

<style>
body{margin:0;font-family:Arial;background:#1e1f22;color:white;display:flex;height:100vh;overflow:hidden}
#sidebar{width:280px;background:#0f1012;padding:10px;overflow:auto;border-right:1px solid #222}
.item{background:#232428;padding:10px;margin:5px 0;border-radius:10px;cursor:pointer;display:flex;justify-content:space-between}
.item:hover{background:#313338}
.active{background:#4aa3ff!important}
#chat{flex:1;display:flex;flex-direction:column}
#top{padding:12px;background:#111214}
#messages{flex:1;overflow:auto;padding:10px}
.msg{background:#2b2d31;padding:8px;margin:5px 0;border-radius:8px}
#bar{display:flex;gap:6px;padding:10px;background:#111214}
input{flex:1;padding:10px;border:none;border-radius:8px;background:#2b2d31;color:white}
button{padding:10px;border:none;border-radius:8px;background:#5865f2;color:white;cursor:pointer}

.badge{background:#4aa3ff;border-radius:999px;padding:2px 6px;font-size:12px}

#vcUsers{padding:10px}
.vcMember{background:#232428;padding:8px;margin:5px 0;border-radius:10px;display:flex;justify-content:space-between}
.volumeWrap{width:12px;height:42px;background:#555;border-radius:999px;overflow:hidden}
.volumeFill{width:100%;height:0%;background:#4aa3ff}

#typing{font-size:12px;opacity:0.6;padding:5px 10px}

#settings{position:absolute;bottom:60px;left:10px;background:#232428;padding:10px;border-radius:10px;display:none}

#gear{cursor:pointer}
</style>
</head>

<body>

<div id="sidebar">
<div id="channels"></div>
<button onclick="addChat()">+ chat</button>
<hr>
<div id="voiceChannels"></div>
<button onclick="addVC()">+ vc</button>
<hr>
<div id="users"></div>
</div>

<div id="chat">
<div id="top"># general <span id="gear">⚙</span></div>
<div id="typing"></div>
<div id="messages"></div>
<div id="bar">
<input id="msgInput">
<button onclick="send()">send</button>
</div>

<div id="settings">
<input id="pfpInput" placeholder="pfp url/base64">
<button onclick="setPfp()">save pfp</button>
</div>

<div id="vcUsers"></div>
</div>

<script src="/socket.io/socket.io.js"></script>

<script>
const socket=io();

let username=localStorage.getItem("u");
if(!username){
username=prompt("name")||"user"+Math.floor(Math.random()*9999);
localStorage.setItem("u",username);
}

socket.emit("login",username);

let room="general";
let vc=null;
let chatsMap={};
let unread={};
let typingUsers={};

document.getElementById("gear").onclick=()=>{
let s=document.getElementById("settings");
s.style.display=s.style.display==="block"?"none":"block";
};

function send(){
let t=msgInput.value.trim();
if(!t)return;
socket.emit("message",{room,text:t});
msgInput.value="";
socket.emit("typing",{room,typing:false});
}

msgInput.addEventListener("input",()=>{
socket.emit("typing",{room,typing:true});
clearTimeout(window.t);
window.t=setTimeout(()=>socket.emit("typing",{room,typing:false}),800);
});

msgInput.addEventListener("keydown",e=>{
if(e.key==="Enter") send();
});

socket.on("chatList",list=>{
window.chats=list;
render();
});

function render(){
channels.innerHTML="";
window.chats.forEach(c=>{
let d=document.createElement("div");
d.className="item"+(c===room?" active":"");
d.innerHTML=c+(unread[c]?` <span class="badge">${unread[c]}</span>`:"");
d.onclick=()=>{
room=c;
unread[c]=0;
render();
renderMsgs();
};
channels.appendChild(d);
});
}

socket.on("message",m=>{
if(!chatsMap[m.room])chatsMap[m.room]=[];
chatsMap[m.room].push(m);

if(m.room!==room){
unread[m.room]=(unread[m.room]||0)+1;
notify(m);
}

render();
renderMsgs();
});

function renderMsgs(){
messages.innerHTML="";
(chatsMap[room]||[]).forEach(m=>{
let d=document.createElement("div");
d.className="msg";
d.innerHTML="<b>"+m.from+":</b> "+m.text;
messages.appendChild(d);
});
messages.scrollTop=messages.scrollHeight;
}

socket.on("typingUpdate",data=>{
if(data.room===room){
typing.innerText=data.users.join(", ")+" typing...";
}
});

function notify(m){
if(Notification.permission==="granted"){
new Notification(m.from+": "+m.text);
}
}

socket.on("vcUsers",list=>{
vcUsers.innerHTML="";
list.forEach(u=>{
if(vc && u.room!==vc)return;
let d=document.createElement("div");
d.className="vcMember";
d.innerHTML=`
<b>${u.name}</b>
<div class="volumeWrap"><div class="volumeFill" style="height:${u.volume||0}%"></div></div>
`;
vcUsers.appendChild(d);
});
});

async function addChat(){
let n=prompt("chat");
if(n)socket.emit("createChat",n);
}

async function addVC(){
let n=prompt("vc");
if(n)socket.emit("createVC",n);
}

socket.on("vcList",l=>{
window.vcs=l;
voiceChannels.innerHTML="";
l.forEach(v=>{
let d=document.createElement("div");
d.className="item";
d.innerText=v;
d.onclick=()=>joinVC(v);
voiceChannels.appendChild(d);
});
});

async function joinVC(v){
vc=v;
let stream=await navigator.mediaDevices.getUserMedia({audio:true});
const ctx=new AudioContext();
const src=ctx.createMediaStreamSource(stream);
const a=ctx.createAnalyser();
src.connect(a);
const data=new Uint8Array(a.frequencyBinCount);

function loop(){
a.getByteFrequencyData(data);
let sum=0;
for(let i=0;i<data.length;i++)sum+=data[i];
socket.emit("voiceData",{room:v,volume:Math.min(100,sum/data.length)});
requestAnimationFrame(loop);
}
loop();

socket.emit("joinVC",v);
}

socket.on("users",l=>{
users.innerHTML="";
l.forEach(u=>{
let d=document.createElement("div");
d.className="item";
d.innerText=u;
users.appendChild(d);
});
});

</script>

</body>
</html>`);
});

io.on("connection",socket=>{

socket.on("login",name=>{
socket.username=name;
users.set(socket.id,name);
socket.emit("chatList",chats);
socket.emit("vcList",vcs);
io.emit("users",Array.from(users.values()));
});

socket.on("createChat",n=>{
if(!chats.includes(n))chats.push(n);
io.emit("chatList",chats);
});

socket.on("createVC",n=>{
if(!vcs.includes(n))vcs.push(n);
io.emit("vcList",vcs);
});

socket.on("message",m=>{
io.emit("message",{from:socket.username,...m});
});

socket.on("typing",d=>{
typing.set(socket.id,{user:socket.username,room:d.room,typing:d.typing});
let list=[...typing.values()].filter(x=>x.room===d.room && x.typing).map(x=>x.user);
io.emit("typingUpdate",{room:d.room,users:list});
});

socket.on("joinVC",room=>{
vcStates.set(socket.id,{name:socket.username,room,volume:0});
io.emit("vcUsers",Array.from(vcStates.values()));
});

socket.on("voiceData",d=>{
if(!vcStates.has(socket.id))return;
let u=vcStates.get(socket.id);
u.volume=d.volume;
vcStates.set(socket.id,u);
io.emit("vcUsers",Array.from(vcStates.values()));
});

socket.on("disconnect",()=>{
users.delete(socket.id);
vcStates.delete(socket.id);
io.emit("users",Array.from(users.values()));
io.emit("vcUsers",Array.from(vcStates.values()));
});

});

server.listen(process.env.PORT||3000,()=>{
console.log("RUNNING");
});
