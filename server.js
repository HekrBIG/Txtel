const express=require("express")
const http=require("http")
const {Server}=require("socket.io")
const multer=require("multer")
const path=require("path")
const fs=require("fs")

const app=express()
const server=http.createServer(app)

const io=new Server(server,{
cors:{origin:"*"}
})

if(!fs.existsSync("uploads")){
fs.mkdirSync("uploads")
}

app.use("/uploads",express.static("uploads"))

const storage=multer.diskStorage({

destination:(req,file,cb)=>{
cb(null,"uploads/")
},

filename:(req,file,cb)=>{
cb(
null,
Date.now()+
path.extname(file.originalname)
)
}

})

const upload=multer({storage})

app.post("/upload",upload.single("file"),(req,res)=>{

res.json({
url:"/uploads/"+req.file.filename
})

})

const users=new Map()
const vcStates=new Map()

let globalChats=["general"]
let globalVCs=["General VC"]

app.get("/",(req,res)=>{

res.send(`<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
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
width:280px;
background:#111214;
padding:10px;
box-sizing:border-box;
overflow:auto;
border-right:1px solid #222;
padding-bottom:120px;
}

.section{
margin-bottom:20px;
}

.title{
font-size:12px;
opacity:.7;
margin-bottom:8px;
}

.item{
background:#232428;
padding:10px;
border-radius:10px;
margin:5px 0;
cursor:pointer;
transition:.15s;
}

.item:hover{
background:#313338;
}

.active{
background:#4aa3ff!important;
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
border-bottom:1px solid #222;
}

#messages{
flex:1;
overflow:auto;
padding:10px;
}

.msg{
background:#2b2d31;
padding:10px;
border-radius:10px;
margin:5px 0;
word-break:break-word;
}

.msg img{
max-width:350px;
border-radius:10px;
margin-top:6px;
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

.vcMember{
background:#232428;
padding:8px;
border-radius:10px;
margin:5px 0;
display:flex;
justify-content:space-between;
align-items:center;
}

.speaking{
box-shadow:0 0 10px #4aa3ff;
}

.iconRow{
display:flex;
gap:6px;
align-items:center;
}

#userPanel{
position:fixed;
bottom:0;
left:0;
width:280px;
background:#111214;
padding:10px;
box-sizing:border-box;
border-top:1px solid #222;
}

#userCard{
margin-bottom:10px;
}

#usernameBox{
font-weight:bold;
font-size:16px;
margin-bottom:4px;
}

#vcNameSmall{
opacity:.7;
font-size:13px;
}

#controls{
display:flex;
gap:6px;
}

#controls button{
flex:1;
height:42px;
font-size:18px;
background:#2b2d31;
}

#muteBtn.active{
background:#ed4245;
}

#deafBtn.active{
background:#ed4245;
}

#shareBtn.active{
background:#4aa3ff;
}

#leaveBtn{
background:#ed4245!important;
}

.volumeWrap{
width:14px;
height:42px;
background:#555;
border-radius:999px;
overflow:hidden;
display:flex;
align-items:flex-end;
}

.volumeFill{
width:100%;
height:0%;
background:#4aa3ff;
transition:.08s linear;
}

</style>
</head>

<body>

<div id="sidebar">

<div class="section">

<div class="title">
TEXT CHANNELS
</div>

<div id="channels"></div>

<button onclick="addChat()">
+ Chat
</button>

</div>

<div class="section">

<div class="title">
VOICE CHANNELS
</div>

<div id="voiceChannels"></div>

<div id="vcUsers"></div>

<button onclick="addVC()">
+ VC
</button>

</div>

<div class="section">

<div class="title">
USERS
</div>

<div id="users"></div>

</div>

</div>

<div id="chat">

<div id="top">
# general
</div>

<div id="messages"></div>

<div id="bar">

<input id="msgInput" placeholder="message">

<input type="file" id="fileInput" hidden>

<button onclick="fileInput.click()">
📎
</button>

<button onclick="send()">
Send
</button>

</div>

</div>

<div id="userPanel">

<div id="userCard">

<div id="usernameBox"></div>

<div id="vcNameSmall">
Not connected
</div>

</div>

<div id="controls">

<button id="muteBtn" onclick="muteMic()">
🎤
</button>

<button id="deafBtn" onclick="deafen()">
🎧
</button>

<button id="shareBtn" onclick="startScreen()">
🖥
</button>

<button id="leaveBtn" onclick="leaveVC()">
📞
</button>

</div>

</div>

<script src="/socket.io/socket.io.js"></script>

<script>

const socket=io()

Notification.requestPermission()

const joinSound=new Audio(
"https://cdn.pixabay.com/download/audio/2022/03/15/audio_c8c8a73467.mp3?filename=notification-2-269292.mp3"
)

const leaveSound=new Audio(
"https://cdn.pixabay.com/download/audio/2022/03/10/audio_c8631ef2b1.mp3?filename=interface-124464.mp3"
)

let username=
localStorage.getItem("txtelUser")

/* ADD THIS UNDER USERNAME */

document.addEventListener("keydown",e=>{

if(e.key===";"){

let newName=prompt(
"New username",
username
)

if(!newName) return

username=newName

localStorage.setItem(
"txtelUser",
username
)

usernameBox.innerText=username

socket.emit(
"changeName",
username
)

}

})

/* ================= SERVER SIDE ================= */

/* ADD INSIDE io.on("connection") */

socket.on("changeName",name=>{

socket.username=name

users.set(socket.id,name)

if(vcStates.has(socket.id)){

let u=vcStates.get(socket.id)

u.name=name

vcStates.set(socket.id,u)

}

io.emit(
"users",
Array.from(users.values())
)

io.emit(
"vcUsers",
Array.from(vcStates.values())
)

})

if(!username){

username=prompt("Username")

if(!username){
username="user"+Math.floor(Math.random()*9999)
}

localStorage.setItem(
"txtelUser",
username
)

}

usernameBox.innerText=username

socket.emit("login",username)

let currentRoom="general"
let currentVC=null

let chats={}

let saved=
localStorage.getItem("txtelChats")

if(saved){
chats=JSON.parse(saved)
}

let unread={}

let textChannels=[]
let vcChannels=[]

let peers={}

let localStream=null

let muted=false
let deafened=false

let vcStart=0
let vcInterval=null

socket.on("chatList",list=>{

textChannels=list

renderChats()

})

function renderChats(){

channels.innerHTML=""

textChannels.forEach(c=>{

let d=document.createElement("div")

d.className="item"

if(c===currentRoom){
d.classList.add("active")
}

let badge=unread[c]
? \`<span style="
background:red;
padding:2px 8px;
border-radius:999px;
font-size:12px;
">\${unread[c]}</span>\`
: ""

d.innerHTML=\`
<div style="
display:flex;
justify-content:space-between;
align-items:center;
">

<span>

\${c.startsWith("DM_")
? "@ "+c.replace("DM_","")
: "# "+c}

</span>

\${badge}

</div>
\`

d.onclick=()=>{

currentRoom=c

unread[c]=0

top.innerText=
c.startsWith("DM_")
? "@ "+c.replace("DM_","")
: "# "+c

renderChats()
renderMessages()

}

channels.appendChild(d)

})

}

function addChat(){

let n=prompt("Chat name")

if(!n) return

socket.emit("createChat",n)

}

socket.on("vcList",list=>{

vcChannels=list

renderVCs()

})

function renderVCs(){

voiceChannels.innerHTML=""

vcChannels.forEach(v=>{

let d=document.createElement("div")

d.className="item"

if(v===currentVC){
d.classList.add("active")
}

d.innerText="🔊 "+v

d.onclick=()=>joinVC(v)

voiceChannels.appendChild(d)

})

}

function addVC(){

let n=prompt("VC name")

if(!n) return

socket.emit("createVC",n)

}

socket.on("users",list=>{

users.innerHTML=""

list.forEach(u=>{

if(u===username) return

let d=document.createElement("div")

d.className="item"

d.innerHTML=\`
<div style="
display:flex;
justify-content:space-between;
align-items:center;
">
<span>\${u}</span>
<span>🟢</span>
</div>
\`

d.onclick=()=>{

currentRoom="DM_"+u

top.innerText="@ "+u

if(!chats[currentRoom]){
chats[currentRoom]=[]
}

if(!textChannels.includes(currentRoom)){
textChannels.push(currentRoom)
}

renderChats()
renderMessages()

}

users.appendChild(d)

})

})

function send(){

let text=msgInput.value.trim()

if(!text) return

socket.emit("message",{
room:currentRoom,
text,
dm:currentRoom.startsWith("DM_")
})

msgInput.value=""

}

msgInput.addEventListener("keydown",e=>{

if(e.key==="Enter"){
send()
}

})

document.addEventListener("dragover",e=>{
e.preventDefault()
})

document.addEventListener("drop",async e=>{

e.preventDefault()

const file=e.dataTransfer.files[0]

uploadFile(file)

})

fileInput.onchange=()=>{

const file=fileInput.files[0]

uploadFile(file)

}

async function uploadFile(file){

const form=new FormData()

form.append("file",file)

const res=await fetch("/upload",{
method:"POST",
body:form
})

const data=await res.json()

socket.emit("message",{
room:currentRoom,
file:data.url,
text:file.name,
dm:currentRoom.startsWith("DM_")
})

}

socket.on("message",m=>{

if(
document.hidden &&
m.from!==username
){

new Notification(
m.from,
{
body:m.text||"Sent a file"
}
)

}

if(!chats[m.room]){
chats[m.room]=[]
}

chats[m.room].push(m)

localStorage.setItem(
"txtelChats",
JSON.stringify(chats)
)

if(
m.room!==currentRoom &&
m.from!==username
){

unread[m.room]=
(unread[m.room]||0)+1

renderChats()

}

if(m.room===currentRoom){
renderMessages()
}

})

function renderMessages(){

messages.innerHTML=""

(chats[currentRoom]||[]).forEach(m=>{

let d=document.createElement("div")

d.className="msg"

let html="<b>"+m.from+":</b> "

if(m.file){

if(
m.file.endsWith(".png")||
m.file.endsWith(".jpg")||
m.file.endsWith(".jpeg")||
m.file.endsWith(".gif")||
m.file.endsWith(".webp")
){

html+=\`
<br>
<img src="\${m.file}">
\`

}else{

html+=\`
<br>
<a href="\${m.file}" target="_blank">
📎 \${m.text}
</a>
\`

}

}else{

html+=m.text

}

d.innerHTML=html

messages.appendChild(d)

})

messages.scrollTop=
messages.scrollHeight

}

socket.on("vcUsers",list=>{

vcUsers.innerHTML=""

list.forEach(u=>{

if(u.room!==currentVC) return

let div=document.createElement("div")

div.className="vcMember"

if(u.speaking){
div.classList.add("speaking")
}

let mic=u.muted?"🔇":"🎤"
let deaf=u.deafened?"🔕":"🎧"

div.innerHTML=\`

<div>
<b>\${u.name}</b>
</div>

<div class="iconRow">

<span>\${mic}</span>

<span>\${deaf}</span>

<div class="volumeWrap">

<div
class="volumeFill"
style="height:\${u.volume||0}%">
</div>

</div>

</div>

\`

vcUsers.appendChild(div)

})

})

async function joinVC(room){

currentVC=room

renderVCs()

vcStart=Date.now()

clearInterval(vcInterval)

vcInterval=setInterval(()=>{

let sec=Math.floor(
(Date.now()-vcStart)/1000
)

let m=Math.floor(sec/60)
.toString()
.padStart(2,"0")

let s=(sec%60)
.toString()
.padStart(2,"0")

vcNameSmall.innerText=
"🔊 "+room+" • "+m+":"+s

},1000)

if(!localStream){

localStream=
await navigator.mediaDevices
.getUserMedia({
audio:true
})

startSpeakingDetect()

}

socket.emit("leaveVC")

setTimeout(()=>{

socket.emit("joinVC",room)

},300)

}

function leaveVC(){

currentVC=null

renderVCs()

clearInterval(vcInterval)

vcNameSmall.innerText=
"Not connected"

Object.values(peers).forEach(p=>{
p.close()
})

peers={}

socket.emit("leaveVC")

leaveSound.play()

}

socket.on("allUsers",list=>{

list.forEach(id=>{
createPeer(id,true)
})

})

socket.on("userJoined",id=>{

createPeer(id,false)

joinSound.play()

})

function createPeer(id,initiator){

if(peers[id]){
return peers[id]
}

const pc=new RTCPeerConnection({

iceServers:[
{
urls:[
"stun:stun.l.google.com:19302"
]
}
]

})

peers[id]=pc

if(localStream){

localStream.getTracks().forEach(track=>{
pc.addTrack(track,localStream)
})

}

pc.ontrack=e=>{

let media=
document.getElementById(
"media-"+id
)

if(!media){

media=document.createElement(
"audio"
)

media.autoplay=true

media.id="media-"+id

document.body.appendChild(media)

}

media.srcObject=e.streams[0]

}

pc.onicecandidate=e=>{

if(e.candidate){

socket.emit("iceCandidate",{
to:id,
candidate:e.candidate
})

}

}

if(initiator){

pc.createOffer({
offerToReceiveAudio:true
})
.then(o=>pc.setLocalDescription(o))
.then(()=>{

socket.emit("offer",{
to:id,
offer:pc.localDescription
})

})

}

return pc

}

socket.on("offer",async data=>{

const pc=
createPeer(data.from,false)

await pc.setRemoteDescription(
data.offer
)

const answer=
await pc.createAnswer()

await pc.setLocalDescription(
answer
)

socket.emit("answer",{
to:data.from,
answer
})

})

socket.on("answer",data=>{

if(peers[data.from]){

peers[data.from]
.setRemoteDescription(
data.answer
)

}

})

socket.on("iceCandidate",data=>{

if(peers[data.from]){

peers[data.from]
.addIceCandidate(
data.candidate
)

}

})

function muteMic(){

if(!localStream) return

muted=!muted

localStream
.getAudioTracks()
.forEach(track=>{
track.enabled=!muted
})

if(muted){

muteBtn.classList.add("active")
muteBtn.innerHTML="🔇"

}else{

muteBtn.classList.remove("active")
muteBtn.innerHTML="🎤"

}

socket.emit("vcState",{
type:"mute",
state:muted
})

}

function deafen(){

deafened=!deafened

document
.querySelectorAll("audio")
.forEach(a=>{
a.muted=deafened
})

if(deafened){

deafBtn.classList.add("active")
deafBtn.innerHTML="🔕"

}else{

deafBtn.classList.remove("active")
deafBtn.innerHTML="🎧"

}

socket.emit("vcState",{
type:"deafen",
state:deafened
})

}

async function startScreen(){

if(!currentVC) return

shareBtn.classList.add("active")

const screen=
await navigator.mediaDevices
.getDisplayMedia({
video:true,
audio:true
})

const track=
screen.getVideoTracks()[0]

let preview=
document.getElementById(
"screenPreview"
)

if(!preview){

preview=document.createElement(
"video"
)

preview.id="screenPreview"
preview.autoplay=true
preview.playsInline=true

preview.style.position="fixed"
preview.style.right="20px"
preview.style.bottom="20px"
preview.style.width="300px"
preview.style.borderRadius="14px"
preview.style.border=
"2px solid #4aa3ff"
preview.style.zIndex="999"

document.body.appendChild(preview)

}

preview.srcObject=screen

Object.values(peers).forEach(pc=>{

const sender=
pc.getSenders()
.find(s=>
s.track &&
s.track.kind==="video"
)

if(sender){

sender.replaceTrack(track)

}else{

pc.addTrack(track,screen)

}

})

track.onended=()=>{

shareBtn.classList.remove("active")

if(preview){
preview.remove()
}

}

}

function startSpeakingDetect(){

const ctx=new AudioContext()

const src=
ctx.createMediaStreamSource(
localStream
)

const analyser=
ctx.createAnalyser()

analyser.fftSize=512

src.connect(analyser)

const data=
new Uint8Array(
analyser.frequencyBinCount
)

function loop(){

analyser.getByteFrequencyData(
data
)

let values=0

for(let i=0;i<data.length;i++){
values+=data[i]
}

let average=
values/data.length

let volume=Math.min(
100,
Math.floor(average/1.4)
)

socket.emit("speakingData",{
speaking:volume>12,
volume
})

requestAnimationFrame(loop)

}

loop()

}

</script>

</body>
</html>`)

})

io.on("connection",socket=>{

socket.on("login",name=>{

socket.username=name

users.set(socket.id,name)

socket.emit(
"chatList",
globalChats
)

socket.emit(
"vcList",
globalVCs
)

io.emit(
"users",
Array.from(users.values())
)

})

socket.on("createChat",name=>{

if(!globalChats.includes(name)){

globalChats.push(name)

io.emit(
"chatList",
globalChats
)

}

})

socket.on("createVC",name=>{

if(!globalVCs.includes(name)){

globalVCs.push(name)

io.emit(
"vcList",
globalVCs
)

}

})

socket.on("message",m=>{

if(m.dm){

let target=
m.room.replace("DM_","")

let targetId=null

for(let [id,name] of users){

if(name===target){
targetId=id
}

}

if(targetId){

io.to(targetId).emit(
"message",
{
from:socket.username,
room:"DM_"+socket.username,
text:m.text||"",
file:m.file||null
}
)

}

socket.emit("message",{
from:socket.username,
room:m.room,
text:m.text||"",
file:m.file||null
})

return

}

io.emit("message",{
from:socket.username,
room:m.room,
text:m.text||"",
file:m.file||null
})

})

socket.on("joinVC",room=>{

for(let r of socket.rooms){
socket.leave(r)
}

socket.join(room)

vcStates.set(socket.id,{
name:socket.username,
room,
muted:false,
deafened:false,
speaking:false,
volume:0
})

const usersInRoom=
[...(io.sockets.adapter.rooms.get(room)||[])]
.filter(id=>id!==socket.id)

socket.emit(
"allUsers",
usersInRoom
)

socket.to(room)
.emit("userJoined",socket.id)

io.emit(
"vcUsers",
Array.from(vcStates.values())
)

})

socket.on("vcState",data=>{

if(!vcStates.has(socket.id))
return

let u=vcStates.get(socket.id)

if(data.type==="mute"){
u.muted=data.state
}

if(data.type==="deafen"){
u.deafened=data.state
}

vcStates.set(socket.id,u)

io.emit(
"vcUsers",
Array.from(vcStates.values())
)

})

socket.on("speakingData",data=>{

if(!vcStates.has(socket.id))
return

let u=vcStates.get(socket.id)

u.speaking=data.speaking
u.volume=data.volume

vcStates.set(socket.id,u)

io.emit(
"vcUsers",
Array.from(vcStates.values())
)

})

socket.on("leaveVC",()=>{

vcStates.delete(socket.id)

io.emit(
"vcUsers",
Array.from(vcStates.values())
)

})

socket.on("offer",data=>{

io.to(data.to).emit(
"offer",
{
from:socket.id,
offer:data.offer
}
)

})

socket.on("answer",data=>{

io.to(data.to).emit(
"answer",
{
from:socket.id,
answer:data.answer
}
)

})

socket.on("iceCandidate",data=>{

io.to(data.to).emit(
"iceCandidate",
{
from:socket.id,
candidate:data.candidate
}
)

})

socket.on("disconnect",()=>{

users.delete(socket.id)

vcStates.delete(socket.id)

io.emit(
"users",
Array.from(users.values())
)

io.emit(
"vcUsers",
Array.from(vcStates.values())
)

})

})

server.listen(
process.env.PORT||3000,
()=>{
console.log("TXTEL RUNNING")
}
)
