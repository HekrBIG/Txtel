const express=require("express");
const http=require("http");
const {Server}=require("socket.io");

const app=express();
const server=http.createServer(app);
const io=new Server(server,{cors:{origin:"*"}});

app.use(express.json({limit:"10mb"}));

const users=new Map();
const vcStates=new Map();
const profiles=new Map();

let chats=["general"];
let vcs=["General VC"];

const messages={};
const typing={};

function push(room,msg){
if(!messages[room])messages[room]=[];
messages[room].push(msg);
if(messages[room].length>200)messages[room].shift();
}

io.on("connection",socket=>{

socket.on("login",name=>{
socket.username=name;
users.set(socket.id,name);

profiles.set(socket.id,{name,pfp:null});

socket.emit("init",{chats,vcs,messages});

io.emit("users",[...users.values()]);
});

socket.on("message",data=>{
const msg={from:socket.username,text:data.text,room:data.room,ts:Date.now()};
push(data.room,msg);
io.emit("message",msg);
});

socket.on("typing",data=>{
socket.broadcast.emit("typing",{user:socket.username,room:data.room,state:data.state});
});

socket.on("createChat",name=>{
if(!chats.includes(name))chats.push(name);
io.emit("chatList",chats);
});

socket.on("createVC",name=>{
if(!vcs.includes(name))vcs.push(name);
io.emit("vcList",vcs);
});

socket.on("joinVC",room=>{
vcStates.set(socket.id,{name:socket.username,room,volume:0,speaking:false,muted:false,deaf:false});
io.emit("vcUsers",[...vcStates.values()]);
});

socket.on("voiceData",d=>{
const u=vcStates.get(socket.id);
if(!u)return;
u.volume=d.volume;
u.speaking=d.speaking;
vcStates.set(socket.id,u);
io.emit("vcUsers",[...vcStates.values()]);
});

socket.on("setPfp",img=>{
const p=profiles.get(socket.id);
if(!p)return;
p.pfp=img;
profiles.set(socket.id,p);
io.emit("profiles",[...profiles.values()]);
});

socket.on("disconnect",()=>{
users.delete(socket.id);
vcStates.delete(socket.id);
profiles.delete(socket.id);

io.emit("users",[...users.values()]);
io.emit("vcUsers",[...vcStates.values()]);
});

});

app.get("/",(req,res)=>{
res.send(`<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>TXTEL</title>

<style>
body{margin:0;display:flex;height:100vh;background:#1e1f22;color:white;font-family:Arial;overflow:hidden}
#sidebar{width:280px;background:#0f1012;padding:10px;overflow:auto}
.item{padding:10px;margin:5px 0;background:#232428;border-radius:10px;cursor:pointer}
.item:hover{background:#313338}
.active{background:#4aa3ff}
#chat{flex:1;display:flex;flex-direction:column}
#top{padding:10px;background:#111214;display:flex;justify-content:space-between}
#messages{flex:1;overflow:auto;padding:10px}
.msg{background:#2b2d31;padding:8px;margin:5px 0;border-radius:8px}
#bar{display:flex;padding:10px;gap:6px;background:#111214}
input{flex:1;padding:10px;border:none;border-radius:8px;background:#2b2d31;color:white}
button{padding:10px;border:none;border-radius:8px;background:#5865f2;color:white;cursor:pointer}
.badge{background:#4aa3ff;border-radius:999px;padding:2px 6px;font-size:12px}
.vcMember{background:#232428;margin:5px 0;padding:8px;border-radius:10px;display:flex;justify-content:space-between}
.volumeWrap{width:14px;height:42px;background:#555;border-radius:999px;overflow:hidden;display:flex;align-items:flex-end}
.volumeFill{width:100%;height:0%;background:#4aa3ff}
</style>
</head>

<body>

<div id="sidebar">
<div id="channels"></div>
<button onclick="addChat()">+ chat</button>
<hr/>
<div id="voiceChannels"></div>
<button onclick="addVC()">+ vc</button>
<hr/>
<div id="users"></div>
</div>

<div id="chat">

<div id="top"><div id="room"># general</div></div>

<div id="messages"></div>

<div id="bar">
<input id="msg"/>
<button onclick="send()">send</button>
</div>

</div>

<script src="/socket.io/socket.io.js"></script>

<script>

const socket=io();

let user=localStorage.getItem("u")||("u"+Math.floor(Math.random()*9999));
localStorage.setItem("u",user);
socket.emit("login",user);

let room="general";
let chats=["general"];
let map={};

socket.on("init",d=>{
chats=d.chats;
renderChats();
});

socket.on("message",m=>{
if(!map[m.room])map[m.room]=[];
map[m.room].push(m);
if(m.room===room)render();
});

function renderChats(){
channels.innerHTML="";
chats.forEach(c=>{
let d=document.createElement("div");
d.className="item"+(c===room?" active":"");
d.innerText=c;
d.onclick=()=>{
room=c;
renderChats();
render();
};
channels.appendChild(d);
});
}

function addChat(){
let n=prompt("chat");
if(n)socket.emit("createChat",n);
}

function send(){
let t=msg.value.trim();
if(!t)return;
socket.emit("message",{room,text:t});
msg.value="";
}

msg.addEventListener("keydown",e=>{
if(e.key==="Enter")send();
});

function render(){
messages.innerHTML="";
(map[room]||[]).forEach(m=>{
let d=document.createElement("div");
d.className="msg";
d.innerHTML="<b>"+m.from+":</b> "+m.text;
messages.appendChild(d);
});
}

socket.on("vcUsers",list=>{
voiceChannels.innerHTML="";
list.forEach(u=>{
if(u.room!==room)return;
let d=document.createElement("div");
d.className="vcMember";
d.innerHTML=`
<b>${u.name}</b>
<div class="volumeWrap">
<div class="volumeFill" style="height:${u.volume||0}%"></div>
</div>
`;
voiceChannels.appendChild(d);
});
});

function addVC(){
let n=prompt("vc");
if(n)socket.emit("createVC",n);
}

</script>

</body>
</html>`);
});

server.listen(process.env.PORT||3000,()=>console.log("RUN"));
