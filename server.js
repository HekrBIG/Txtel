const socket = io();

let username = localStorage.getItem("txtelUser");

if (!username) {
username = prompt("Username");
if (!username) username = "user" + Math.floor(Math.random() * 9999);
localStorage.setItem("txtelUser", username);
}

socket.emit("login", username);

let currentRoom = "general";
let currentVC = null;

let chats = {};
let channels = [];
let vcs = [];

let peers = {};
let localStream = null;
let screenStream = null;

let muted = false;
let deafened = false;

let unread = {};
let typing = {};
let selectedMsg = null;

function isImage(f){
return /\.(png|jpg|jpeg|gif|webp)$/i.test(f);
}

/* CHAT */

socket.on("chatList", list => {
channels = list;
renderChats();
});

function renderChats(){
channelsEl.innerHTML = "";

channels.forEach(c => {
let d = document.createElement("div");
d.className = "item";
if(c === currentRoom) d.classList.add("active");

d.innerHTML = c + (unread[c] ? ` <span class="badge"></span>` : "");

d.onclick = () => {
currentRoom = c;
unread[c] = 0;
renderChats();
renderMessages();
};

channelsEl.appendChild(d);
});
}

function addChat(){
let n = prompt("Chat");
if(n) socket.emit("createChat", n);
}

/* VC */

socket.on("vcList", list => {
vcs = list;
renderVC();
});

function renderVC(){
voiceChannels.innerHTML = "";

vcs.forEach(v => {
let d = document.createElement("div");
d.className = "item";
if(v === currentVC) d.classList.add("active");

d.innerText = "🔊 " + v;

d.onclick = () => joinVC(v);

voiceChannels.appendChild(d);
});
}

function addVC(){
let n = prompt("VC");
if(n) socket.emit("createVC", n);
}

/* SEND */

function send(){
let text = msgInput.value.trim();
if(!text) return;

socket.emit("message", {
room: currentRoom,
text
});

msgInput.value = "";
}

msgInput.addEventListener("keydown", e => {
socket.emit("typing", { room: currentRoom, user: username });

if(e.key === "Enter") send();
});

/* FILE */

fileInput.onchange = () => upload(fileInput.files[0]);

async function upload(file){
let f = new FormData();
f.append("file", file);

let res = await fetch("/upload", { method:"POST", body:f });
let data = await res.json();

socket.emit("message", {
room: currentRoom,
file: data.url,
text: file.name
});
}

/* RECEIVE */

socket.on("message", m => {

if(!chats[m.room]) chats[m.room] = [];
chats[m.room].push(m);

if(m.room !== currentRoom){
unread[m.room] = (unread[m.room] || 0) + 1;
notify(m);
}

renderChats();
if(m.room === currentRoom) renderMessages();
});

socket.on("messageEdited", m => {
let arr = chats[m.room] || [];
let msg = arr.find(x => x.id === m.id);
if(msg) msg.text = m.text;
renderMessages();
});

socket.on("messageDeleted", id => {
for(let r in chats){
chats[r] = chats[r].filter(m => m.id !== id);
}
renderMessages();
});

/* RENDER MSG */

function renderMessages(){
messages.innerHTML = "";

(chats[currentRoom] || []).forEach(m => {

let d = document.createElement("div");
d.className = "msg";
d.dataset.id = m.id;

let html = "";

if(m.pfp){
html += `<img class="pfp" src="${m.pfp}">`;
}

html += "<b>" + m.from + ":</b> ";

if(m.file){
if(isImage(m.file)){
html += `<br><img src="${m.file}">`;
}else{
html += `<br><a href="${m.file}" target="_blank">📎 ${m.text}</a>`;
}
}else{
html += m.text;
}

d.innerHTML = html;
messages.appendChild(d);
});

messages.scrollTop = messages.scrollHeight;
}

/* USERS */

socket.on("users", list => {
users.innerHTML = "";
list.forEach(u => {
let d = document.createElement("div");
d.className = "item";
d.innerText = u;
users.appendChild(d);
});
});

/* VC USERS */

socket.on("vcUsers", list => {
vcUsers.innerHTML = "";

list.forEach(u => {
if(u.room !== currentVC) return;

let d = document.createElement("div");
d.className = "vcMember";
if(u.speaking) d.classList.add("speaking");

d.innerHTML = `<b>${u.name}</b>`;
vcUsers.appendChild(d);
});
});

/* VC */

async function joinVC(room){
currentVC = room;
vcNameSmall.innerText = "🔊 " + room;

if(!localStream){
localStream = await navigator.mediaDevices.getUserMedia({ audio:true, video:true });
startSpeaking();
}

socket.emit("joinVC", room);
}

function leaveVC(){
currentVC = null;
vcNameSmall.innerText = "Not connected";
socket.emit("leaveVC");
}

/* SPEAK */

function startSpeaking(){
let ctx = new AudioContext();
let src = ctx.createMediaStreamSource(localStream);
let a = ctx.createAnalyser();
src.connect(a);

let data = new Uint8Array(a.fftSize);

function loop(){
a.getByteTimeDomainData(data);

let sum = 0;
for(let i=0;i<data.length;i++){
sum += Math.abs(data[i]-128);
}

socket.emit("speaking", sum > 900);
requestAnimationFrame(loop);
}

loop();
}

/* SCREEN SHARE */

async function startScreen(){
screenStream = await navigator.mediaDevices.getDisplayMedia({ video:true, audio:true });

let track = screenStream.getVideoTracks()[0];

Object.values(peers).forEach(pc => {
let sender = pc.getSenders().find(s => s.track && s.track.kind === "video");
if(sender) sender.replaceTrack(track);
else pc.addTrack(track, screenStream);
});

track.onended = stopScreen;
}

function stopScreen(){
if(!screenStream) return;

screenStream.getTracks().forEach(t => t.stop());
screenStream = null;

navigator.mediaDevices.getUserMedia({ video:true, audio:true })
.then(cam => {
let t = cam.getVideoTracks()[0];

Object.values(peers).forEach(pc => {
let sender = pc.getSenders().find(s => s.track && s.track.kind === "video");
if(sender) sender.replaceTrack(t);
});
});
}

/* MUTE */

function muteMic(){
muted = !muted;
localStream.getAudioTracks().forEach(t => t.enabled = !muted);
socket.emit("vcState", { type:"mute", state:muted });
}

/* DEAF */

function deafen(){
deafened = !deafened;
document.querySelectorAll("audio").forEach(a => a.muted = deafened);
socket.emit("vcState", { type:"deafen", state:deafened });
}

/* NOTIFY */

function notify(m){
if(Notification.permission === "granted"){
new Notification(m.from, { body:m.text || "file" });
}
let a = new Audio("/ping.mp3");
a.play().catch(()=>{});
}

Notification.requestPermission();
