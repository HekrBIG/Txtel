
const express=require("express")
const http=require("http")
const {Server}=require("socket.io")
const multer=require("multer")
const path=require("path")
const fs=require("fs")

const app=express()
const server=http.createServer(app)
const io=new Server(server,{cors:{origin:"*"}})

if(!fs.existsSync("uploads")) fs.mkdirSync("uploads")

app.use(express.static("."))
app.use("/uploads",express.static("uploads"))

const storage=multer.diskStorage({
destination:(req,file,cb)=>cb(null,"uploads/"),
filename:(req,file,cb)=>cb(null,Date.now()+path.extname(file.originalname))
})
const upload=multer({storage})

app.post("/upload",upload.single("file"),(req,res)=>{
res.json({url:"/uploads/"+req.file.filename})
})

const users=new Map()
const vcStates=new Map()

let globalChats=["general"]
let globalVCs=["General VC"]

io.on("connection",socket=>{

socket.on("login",name=>{
socket.username=name
users.set(socket.id,name)

socket.emit("chatList",globalChats)
socket.emit("vcList",globalVCs)

io.emit("users",Array.from(users.values()))
})

socket.on("createChat",name=>{
if(!globalChats.includes(name)){
globalChats.push(name)
io.emit("chatList",globalChats)
}
})

socket.on("createVC",name=>{
if(!globalVCs.includes(name)){
globalVCs.push(name)
io.emit("vcList",globalVCs)
}
})

socket.on("message",m=>{
if(m.dm){
let target=m.room.replace("DM_","")
let targetId=null
for(let [id,name] of users){
if(name===target) targetId=id
}
if(targetId){
io.to(targetId).emit("message",{from:socket.username,room:"DM_"+socket.username,text:m.text||"",file:m.file||null})
}
socket.emit("message",{from:socket.username,room:m.room,text:m.text||"",file:m.file||null})
return
}

io.emit("message",{from:socket.username,room:m.room,text:m.text||"",file:m.file||null})
})

socket.on("joinVC",room=>{
socket.join(room)

vcStates.set(socket.id,{
name:socket.username,
room,
muted:false,
deafened:false,
volume:0
})

const usersInRoom=[...(io.sockets.adapter.rooms.get(room)||[])].filter(id=>id!==socket.id)

socket.emit("allUsers",usersInRoom)
socket.to(room).emit("userJoined",socket.id)

io.emit("vcUsers",Array.from(vcStates.values()))
})

socket.on("vcState",data=>{
if(!vcStates.has(socket.id)) return
let u=vcStates.get(socket.id)
if(data.type==="mute") u.muted=data.state
if(data.type==="deafen") u.deafened=data.state
vcStates.set(socket.id,u)
io.emit("vcUsers",Array.from(vcStates.values()))
})

socket.on("speakingData",data=>{
if(!vcStates.has(socket.id)) return
let u=vcStates.get(socket.id)
u.volume=data.volume
vcStates.set(socket.id,u)
io.emit("vcUsers",Array.from(vcStates.values()))
})

socket.on("disconnect",()=>{
users.delete(socket.id)
vcStates.delete(socket.id)
io.emit("users",Array.from(users.values()))
io.emit("vcUsers",Array.from(vcStates.values()))
})

})

server.listen(process.env.PORT||3000,()=>console.log("TXTEL RUNNING"))
