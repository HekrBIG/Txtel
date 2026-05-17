
const socket=io()

let username=localStorage.getItem("u")||prompt("name")
localStorage.setItem("u",username)

usernameBox.innerText=username
socket.emit("login",username)

let currentRoom="general"
let chats={}

function send(){
let t=msgInput.value
if(!t)return
socket.emit("message",{room:currentRoom,text:t})
msgInput.value=""
}

socket.on("message",m=>{
if(!chats[m.room]) chats[m.room]=[]
chats[m.room].push(m)
render()
})

function render(){
messages.innerHTML=""
;(chats[currentRoom]||[]).forEach(m=>{
let d=document.createElement("div")
d.className="msg"
d.innerText=m.from+": "+m.text
messages.appendChild(d)
})
}

msgInput.addEventListener("keydown",e=>{
if(e.key==="Enter") send()
})
