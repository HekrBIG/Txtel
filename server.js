const socket = io();

let currentChat = "general";

let stream;
let peers = {};

let muted = false;
let deafened = false;

let voiceState = {}; 
// { id: { speaking: bool, level: 0-6 } }

// ================= LOGIN =================
let username = prompt("Username");
let password = prompt("Password");

socket.emit("login", {
    u: username,
    p: password
});

// ================= CHAT STORAGE =================
let chats = JSON.parse(localStorage.getItem("txtelChats") || "{}");

function saveChats() {
    localStorage.setItem("txtelChats", JSON.stringify(chats));
}

function renderChat() {

    messages.innerHTML = "";

    if (!chats[currentChat]) {
        chats[currentChat] = [];
    }

    chats[currentChat].forEach(m => {

        const div = document.createElement("div");
        div.className = "msg";
        div.innerHTML = m;
        messages.appendChild(div);
    });

    messages.scrollTop = messages.scrollHeight;
}

// ================= USERS =================
socket.on("users", (list) => {

    users.innerHTML = "";

    list.forEach(u => {

        if (u === username) return;

        const d = document.createElement("div");
        d.className = "user";
        d.innerText = u;

        d.onclick = () => {

            currentChat = u;
            chatTitle.innerText = "@ " + u;

            document.querySelectorAll(".channel,.user")
                .forEach(x => x.classList.remove("active"));

            d.classList.add("active");

            renderChat();
        };

        users.appendChild(d);
    });
});

// ================= GENERAL =================
generalBtn.onclick = () => {

    currentChat = "general";
    chatTitle.innerText = "# general";

    document.querySelectorAll(".channel,.user")
        .forEach(x => x.classList.remove("active"));

    generalBtn.classList.add("active");

    renderChat();
};

// ================= RECEIVE MESSAGE =================
socket.on("message", (m) => {

    let room = "general";

    if (m.to && (m.to === username || m.from === username)) {
        room = m.from === username ? m.to : m.from;
    }

    if (!chats[room]) chats[room] = [];

    let html = "";

    if (m.text) {
        html = "<b>" + m.from + ":</b> " + m.text;
    }

    if (m.file) {
        html = "<b>" + m.from + ":</b> <a href='" + m.file + "' target='_blank'>File</a>";
    }

    chats[room].push(html);
    saveChats();

    if (room === currentChat) renderChat();
});

// ================= SEND =================
function send() {

    if (!msg.value) return;

    socket.emit("message", {
        text: msg.value,
        to: currentChat === "general" ? null : currentChat
    });

    msg.value = "";
}

document.addEventListener("keydown", (e) => {
    if (e.key === "Enter") send();
});

// ================= FILE =================
async function uploadFile() {

    const f = file.files[0];
    if (!f) return;

    const form = new FormData();
    form.append("file", f);

    const res = await fetch("/upload", {
        method: "POST",
        body: form
    });

    const data = await res.json();

    socket.emit("message", {
        file: data.url,
        to: currentChat === "general" ? null : currentChat
    });
}

// ================= VOICE =================

async function joinVoice() {

    if (stream) return;

    stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    socket.emit("joinVoice");

    // speaking + level detection
    const audioCtx = new AudioContext();
    const source = audioCtx.createMediaStreamSource(stream);
    const analyser = audioCtx.createAnalyser();

    source.connect(analyser);

    analyser.fftSize = 512;
    const data = new Uint8Array(analyser.frequencyBinCount);

    function detectSpeaking() {

        analyser.getByteFrequencyData(data);

        let volume = 0;

        for (let i = 0; i < data.length; i++) {
            volume += data[i];
        }

        volume = volume / data.length;

        let level = Math.min(6, Math.floor(volume / 15));

        socket.emit("voiceSpeaking", {
            speaking: level > 0,
            level
        });

        setTimeout(detectSpeaking, 200);
    }

    detectSpeaking();
}

// ================= VOICE USERS =================
socket.on("voiceUsers", (usersList) => {

    voiceList.innerHTML = "";

    usersList.forEach(id => {

        if (!voiceState[id]) {
            voiceState[id] = { speaking: false, level: 0 };
        }

        const data = voiceState[id];

        const name =
            (id === socket.id ? "You" : id)
            .slice(0, 10);

        const div = document.createElement("div");
        div.className = "voiceUser";

        let bars = "";

        for (let i = 1; i <= 6; i++) {

            let color = "";

            if (data.level >= i) {
                if (data.level <= 2) color = "green";
                else if (data.level <= 4) color = "orange";
                else color = "red";
            }

            bars += `<div class="bar ${color ? "on " + color : ""}"></div>`;
        }

        div.innerHTML = `
            <div class="voiceLeft">
                <div class="mic ${data.speaking ? "speaking" : ""}"></div>
                ${name}
            </div>

            <div class="levels">
                ${bars}
            </div>
        `;

        voiceList.appendChild(div);

        if (id !== socket.id && stream && !peers[id]) {
            createPeer(id, true);
        }
    });
});

// ================= VOICE SIGNAL =================
socket.on("voiceSignal", (data) => {

    if (!peers[data.from]) {
        createPeer(data.from, false);
    }

    peers[data.from].signal(data.signal);
});

// ================= PEER =================
function createPeer(id, initiator) {

    const peer = new SimplePeer({
        initiator,
        trickle: false,
        stream: stream || undefined
    });

    peer.on("signal", (signal) => {
        socket.emit("voiceSignal", {
            to: id,
            signal
        });
    });

    peer.on("stream", (remoteStream) => {

        const audio = document.createElement("audio");
        audio.srcObject = remoteStream;
        audio.autoplay = true;
        audio.muted = deafened;

        document.body.appendChild(audio);
    });

    peers[id] = peer;
}

// ================= SPEAKING UPDATE =================
socket.on("voiceSpeakingUpdate", (data) => {

    voiceState[data.id] = {
        speaking: data.speaking,
        level: data.level || 0
    };

    socket.emit("voiceUsers", Object.keys(voiceState));
});

// ================= MUTE =================
function mute() {

    muted = !muted;

    if (stream) {
        stream.getAudioTracks().forEach(t => {
            t.enabled = !muted;
        });
    }

    muteBtn.classList.toggle("red", muted);
    muteBtn.innerText = muted ? "Unmute" : "Mute";
}

// ================= DEAFEN =================
function deafen() {

    deafened = !deafened;

    document.querySelectorAll("audio").forEach(a => {
        a.muted = deafened;
    });

    deafenBtn.classList.toggle("red", deafened);
    deafenBtn.innerText = deafened ? "Undeafen" : "Deafen";
}

// ================= INIT =================
renderChat();
