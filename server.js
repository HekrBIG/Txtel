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
let textChannels = [];
let vcChannels = [];

let peers = {};
let localStream = null;

let muted = false;
let deafened = false;

let unread = {};
let typingUsers = new Set();
let selectedMsg = null;

function el(id){return document.getElementById(id)}

function isImage(f){
return /\.(png|jpg|jpeg|gif|webp)$/i.test(f);
}

socket.on("chatList", list => {
textChannels = list;
renderChats();
});

function renderChats(){
channels.innerHTML = "";
textChannels.forEach(c => {
let d = document.createElement("div");
d.className = "item";
if(c === currentRoom) d.classList.add("active");

d.innerHTML = c + (unread[c] ? ` <span class="badge">${unread[c]}</span>` : "");

d.onclick = () => {
currentRoom = c;
unread[c] = 0;
renderChats();
renderMessages();
};

channels.appendChild(d);
});
}

function addChat(){
let n = prompt("Chat name");
if(n) socket.emit("createChat", n);
}

socket.on("vcList", list => {
vcChannels = list;
renderVCs();
});

function renderVCs(){
voiceChannels.innerHTML = "";
vcChannels.forEach(v => {
let d = document.createElement("div");
d.className = "item";
if(v === currentVC) d.classList.add("active");
d.innerText = "🔊 " + v;
d.onclick = () => joinVC(v);
voiceChannels.appendChild(d);
});
}

function addVC(){
let n = prompt("VC name");
if(n) socket.emit("createVC", n);
}

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

document.addEventListener("contextmenu", e => {
e.preventDefault();
let msgEl = e.target.closest(".msg");
if(!msgEl) return;
selectedMsg = msgEl.dataset.id;
contextMenu.style.display = "block";
contextMenu.style.left = e.pageX + "px";
contextMenu.style.top = e.pageY + "px";
});

document.addEventListener("click", () => {
contextMenu.style.display = "none";
});

function editMsg(){
let t = prompt("Edit message");
socket.emit("editMessage", { id: selectedMsg, text: t });
contextMenu.style.display = "none";
}

function deleteMsg(){
socket.emit("deleteMessage", { id: selectedMsg });
contextMenu.style.display = "none";
}

document.addEventListener("drop", async e => {
e.preventDefault();
uploadFile(e.dataTransfer.files[0]);
});

fileInput.onchange = () => uploadFile(fileInput.files[0]);

async function uploadFile(file){
let form = new FormData();
form.append("file", file);

let res = await fetch("/upload", { method:"POST", body:form });
let data = await res.json();

socket.emit("message", {
room: currentRoom,
file: data.url,
text: file.name
});
}

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

socket.on("users", list => {
users.innerHTML = "";
list.forEach(u => {
let d = document.createElement("div");
d.className = "item";
d.innerText = u;
users.appendChild(d);
});
});

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

async function joinVC(room){
currentVC = room;
vcNameSmall.innerText = "🔊 " + room;

if(!localStream){
localStream = await navigator.mediaDevices.getUserMedia({ audio:true });
startSpeakingDetect();
}

socket.emit("joinVC", room);
}

function leaveVC(){
currentVC = null;
vcNameSmall.innerText = "Not connected";
socket.emit("leaveVC");
}

function startSpeakingDetect(){
let ctx = new AudioContext();
let src = ctx.createMediaStreamSource(localStream);
let analyser = ctx.createAnalyser();
src.connect(analyser);

let data = new Uint8Array(analyser.fftSize);

function loop(){
analyser.getByteTimeDomainData(data);
let sum = 0;

for(let i=0;i<data.length;i++){
sum += Math.abs(data[i]-128);
}

socket.emit("speaking", sum > 900);
requestAnimationFrame(loop);
}

loop();
}

function notify(m){
if(Notification.permission === "granted"){
new Notification(m.from, { body: m.text || "file" });
}

let a = new Audio("/ping.mp3");
a.play().catch(()=>{});
}

Notification.requestPermission();

function muteMic(){
muted = !muted;
localStream.getAudioTracks().forEach(t => t.enabled = !muted);
socket.emit("vcState", { type:"mute", state:muted });
}

function deafen(){
deafened = !deafened;
document.querySelectorAll("audio").forEach(a => a.muted = deafened);
socket.emit("vcState", { type:"deafen", state:deafened });
}
