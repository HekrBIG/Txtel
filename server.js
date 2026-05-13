const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const bcrypt = require("bcryptjs");
const sqlite3 = require("sqlite3").verbose();
const multer = require("multer");
const fs = require("fs");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

if (!fs.existsSync("./uploads")) fs.mkdirSync("./uploads");

const db = new sqlite3.Database("./txtel.db");

db.run(`
CREATE TABLE IF NOT EXISTS users (
id INTEGER PRIMARY KEY AUTOINCREMENT,
username TEXT UNIQUE,
password TEXT
)
`);

const upload = multer({
    storage: multer.diskStorage({
        destination: "./uploads",
        filename: (req, file, cb) =>
            cb(null, Date.now() + "-" + file.originalname)
    })
});

app.use("/uploads", express.static("uploads"));

const users = new Map();
const voiceRooms = new Map();
const admins = new Set();

function dmKey(a, b) {
    return [a, b].sort().join("__");
}

/* ================= FRONTEND ================= */
app.get("/", (req, res) => {

res.send(`
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>DISCORD CLONE</title>
<style>
body{margin:0;font-family:Arial;background:#1e1f22;color:white;display:flex;height:100vh}
#sidebar{width:240px;background:#111;padding:10px;overflow:auto}
#chat{flex:1;display:flex;flex-direction:column}
#messages{flex:1;overflow:auto;padding:10px}
.msg{background:#2b2d31;margin:5px;padding:6px;border-radius:6px}
.user{padding:6px;background:#2b2d31;margin:4px;cursor:pointer;display:flex;justify-content:space-between}

.mic{width:10px;height:10px;border-radius:50%;background:#555}
.mic.speaking{background:#00bfff}

.bar{width:4px;height:10px;background:#333;margin:1px;display:inline-block}
.bar.on.green{background:green}
.bar.on.orange{background:orange}
.bar.on.red{background:red}

#adminMenu{
position:fixed;
display:none;
background:#222;
padding:10px;
border:1px solid #444;
}
</style>
</head>
<body>

<div id="sidebar">
<div onclick="setRoom('general')"># general</div>
<hr>
<div id="users"></div>
</div>

<div id="chat">
<div id="messages"></div>
<input id="msg"><button onclick="send()">Send</button>
</div>

<div id="adminMenu">
<button onclick="kick()">Kick</button>
<button onclick="ban()">Ban</button>
<button onclick="rename()">Rename</button>
</div>

<script src="/socket.io/socket.io.js"></script>
<script src="https://unpkg.com/simple-peer/simplepeer.min.js"></script>

<script>
const socket=io();

let username=prompt("username");
let currentRoom="general";
let selected=null;
let admin=false;
let peers={};

socket.emit("login",{u:username});

/* ADMIN MODE */
document.addEventListener("keydown",e=>{
if(e.key===";") admin=true;
});

/* RIGHT CLICK */
document.addEventListener("contextmenu",e=>{
e.preventDefault();
if(admin && selected){
adminMenu.style.display="block";
adminMenu.style.left=e.pageX+"px";
adminMenu.style.top=e.pageY+"px";
}
});
document.addEventListener("click",()=>adminMenu.style.display="none");

/* USERS */
socket.on("users",list=>{
users.innerHTML="";
list.forEach(u=>{
if(u===username)return;

let d=document.createElement("div");
d.className="user";

let mic=document.createElement("div");
mic.className="mic";

let bars=document.createElement("div");
for(let i=0;i<6;i++){
let b=document.createElement("div");
b.className="bar";
bars.appendChild(b);
}

d.innerText=u;
d.appendChild(mic);
d.appendChild(bars);

d.onclick=()=>{
selected=u;
currentRoom=[username,u].sort().join("__");
render();
};

users.appendChild(d);
});
});

/* CHAT */
function render(){messages.innerHTML="";}

socket.on("message",m=>{
let d=document.createElement("div");
d.className="msg";
d.innerHTML="<b>"+m.from+":</b> "+m.text;
messages.appendChild(d);
});

/* SEND */
function send(){
socket.emit("message",{text:msg.value,to:currentRoom==="general"?null:currentRoom.split("__").find(x=>x!==username)});
msg.value="";
}

/* ROOMS */
function setRoom(r){currentRoom=r;render();}

/* VOICE */
async function joinVoice(){

let stream=await navigator.mediaDevices.getUserMedia({audio:true});
socket.emit("joinVoice");

const ctx=new AudioContext();
const src=ctx.createMediaStreamSource(stream);
const ana=ctx.createAnalyser();
src.connect(ana);

ana.fftSize=256;
let data=new Uint8Array(ana.frequencyBinCount);

function loop(){
ana.getByteFrequencyData(data);

let v=0;
for(let i=0;i<data.length;i++)v+=data[i];
v/=data.length;

let level=v>70?3:v>40?2:v>10?1:0;

socket.emit("voiceLevel",{level});
setTimeout(loop,150);
}
loop();
}

socket.on("voiceUpdate",d=>{
document.querySelectorAll(".user").forEach(el=>{
if(el.innerText.includes(d.name)){
let mic=el.querySelector(".mic");
if(mic) mic.classList.toggle("speaking",d.level>0);
}
});
});

/* ADMIN */
function kick(){socket.emit("admin",{type:"kick",target:selected});}
function ban(){socket.emit("admin",{type:"ban",target:selected});}
function rename(){socket.emit("admin",{type:"rename",target:selected,newName:prompt("name")});}

</script>

</body>
</html>
`);
});

/* FILES */
app.post("/upload",upload.single("file"),(req,res)=>{
res.json({url:"/uploads/"+req.file.filename});
});

/* SOCKET */
io.on("connection",socket=>{

socket.on("login",d=>{
socket.username=d.u;
users.set(socket.id,d.u);
io.emit("users",[...users.values()]);
});

/* CHAT */
socket.on("message",d=>{
io.emit("message",{from:socket.username,text:d.text});
});

/* VOICE */
socket.on("voiceLevel",d=>{
io.emit("voiceUpdate",{name:socket.username,level:d.level});
});

/* ADMIN */
socket.on("admin",d=>{
if(!admins.has(socket.id)) return;

for(let [id,name] of users){
if(name===d.target){

if(d.type==="kick") io.sockets.sockets.get(id)?.disconnect();
if(d.type==="ban") users.delete(id);
if(d.type==="rename") users.set(id,d.newName);

}
}

io.emit("users",[...users.values()]);
});

socket.on("disconnect",()=>{
users.delete(socket.id);
io.emit("users",[...users.values()]);
});
});

server.listen(process.env.PORT||3000,()=>{
console.log("DISCORD CLONE RUNNING");
});
