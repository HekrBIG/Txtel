socket.on("watchScreen",data=>{

if(!data.from)return

const pc=peers[data.from]

if(!pc)return

pc.ontrack=e=>{

const videoTrack=e.track

if(videoTrack.kind!=="video")return

const stream=new MediaStream([videoTrack])

let video=document.getElementById(
"remoteScreen-"+data.from
)

if(!video){

video=document.createElement("video")

video.id="remoteScreen-"+data.from

video.autoplay=true
video.playsInline=true
video.controls=false

video.style.position="fixed"
video.style.right="20px"
video.style.top="20px"
video.style.width="420px"
video.style.borderRadius="14px"
video.style.border="2px solid #4aa3ff"
video.style.background="#000"
video.style.zIndex="9999"

document.body.appendChild(video)

}

video.srcObject=stream

video.play().catch(()=>{})

}

})

async function startScreen(){

if(!currentVC)return

try{

shareBtn.classList.add("active")

const screen=
await navigator.mediaDevices
.getDisplayMedia({

video:true,
audio:true

})

const track=
screen.getVideoTracks()[0]

let preview=document.getElementById(
"screenPreview"
)

if(!preview){

preview=document.createElement("video")

preview.id="screenPreview"

preview.autoplay=true
preview.playsInline=true
preview.muted=true

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

preview.play().catch(()=>{})

Object.keys(peers).forEach(id=>{

const pc=peers[id]

if(!pc)return

let sender=
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

socket.emit("watchScreen",{
to:id,
from:socket.id
})

})

track.onended=()=>{

shareBtn.classList.remove("active")

Object.values(peers).forEach(pc=>{

if(!pc)return

const sender=
pc.getSenders()
.find(s=>
s.track &&
s.track.kind==="video"
)

if(sender){

try{
sender.replaceTrack(null)
}catch{}

}

})

const preview=
document.getElementById(
"screenPreview"
)

if(preview){
preview.remove()
}

document
.querySelectorAll(
"[id^='remoteScreen-']"
)
.forEach(v=>v.remove())

}

}catch(err){

alert("Screenshare failed")

shareBtn.classList.remove("active")

}

}
