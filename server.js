const socket = io();

let currentChat = "general";
let stream;
let peers = {};
let muted = false;
let deafened = false;
let voiceState = {};

let username = prompt("Username");
let password = prompt("Password");

socket.emit("login", { u: username, p: password });

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

socket.on("users", list => {
    users.innerHTML = "";

    list.forEach(u => {
        if (u === username) return;

        const d = document.createElement("div");
        d.className = "user";
        d.innerText = u;

        d.onclick = () => {
            currentChat = u;
            chatTitle.innerText = "@ " + u;

            document.querySelectorAll(".channel,.user").forEach(x => x.classList.remove("active"));

            d.classList.add("active");

            renderChat();
        };

        users.appendChild(d);
    });
});

generalBtn.onclick = () => {
    currentChat = "general";
    chatTitle.innerText = "# general";

    document.querySelectorAll(".channel,.user").forEach(x => x.classList.remove("active"));

    generalBtn.classList.add("active");

    renderChat();
};

socket.on("message", m => {
    let room = "general";

    if (m.to && (m.to === username || m.from === username)) {
        room = m.from === username ? m.to : m.from;
    }

    if (!chats[room]) chats[room] = [];

    let html = "";

    if (m.text) html = "<b>" + m.from + ":</b> " + m.text;
    if (m.file) html = "<b>" + m.from + ":</b> <a href='" + m.file + "' target='_blank'>File</a>";

    chats[room].push(html);

    saveChats();

    if (room === currentChat) renderChat();
});

function send() {
    if (!msg.value) return;

    socket.emit("message", {
        text: msg.value,
        to: currentChat === "general" ? null : currentChat
    });

    msg.value = "";
}

document.addEventListener("keydown", e => {
    if (e.key === "Enter") send();
});

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

async function joinVoice() {
    if (stream) return;

    stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    socket.emit("joinVoice");

    const ctx = new AudioContext();
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();

    source.connect(analyser);

    analyser.fftSize = 512;
    const data = new Uint8Array(analyser.frequencyBinCount);

    function loop() {
        analyser.getByteFrequencyData(data);

        let v = 0;

        for (let i = 0; i < data.length; i++) {
            v += data[i];
        }

        v = v / data.length;

        let level = 0;

        if (v > 5) level = 1;
        if (v > 10) level = 2;
        if (v > 20) level = 3;
        if (v > 35) level = 4;
        if (v > 55) level = 5;
        if (v > 75) level = 6;

        socket.emit("voiceSpeaking", {
            speaking: level > 0,
            level
        });

        setTimeout(loop, 200);
    }

    loop();
}

socket.on("voiceUsers", list => {
    voiceList.innerHTML = "";

    list.forEach(id => {
        if (!voiceState[id]) {
            voiceState[id] = { speaking: false, level: 0 };
        }

        const d = voiceState[id];

        const name = (id === socket.id ? "You" : id).slice(0, 10);

        let div = document.createElement("div");
        div.className = "voiceUser";

        let bars = "";

        for (let i = 1; i <= 6; i++) {
            let c = "";

            if (d.level >= i) {
                if (d.level <= 2) c = "green";
                else if (d.level <= 4) c = "orange";
                else c = "red";
            }

            bars += "<div class='bar " + (c ? "on " + c : "") + "'></div>";
        }

        div.innerHTML =
            "<div class='voiceLeft'>" +
            "<div class='mic " + (d.speaking ? "speaking" : "") + "'></div>" +
            name +
            "</div>" +
            "<div class='levels'>" + bars + "</div>";

        voiceList.appendChild(div);

        if (id !== socket.id && stream && !peers[id]) {
            createPeer(id, true);
        }
    });
});

socket.on("voiceSignal", d => {
    if (!peers[d.from]) {
        createPeer(d.from, false);
    }

    peers[d.from].signal(d.signal);
});

function createPeer(id, initiator) {
    const peer = new SimplePeer({
        initiator,
        trickle: false,
        stream: stream || undefined
    });

    peer.on("signal", sig => {
        socket.emit("voiceSignal", {
            to: id,
            signal: sig
        });
    });

    peer.on("stream", s => {
        const a = document.createElement("audio");
        a.srcObject = s;
        a.autoplay = true;
        a.muted = deafened;
        document.body.appendChild(a);
    });

    peers[id] = peer;
}

socket.on("voiceSpeakingUpdate", d => {
    if (!voiceState[d.id]) {
        voiceState[d.id] = { speaking: false, level: 0 };
    }

    voiceState[d.id].speaking = d.speaking;
    voiceState[d.id].level = d.level || 0;
});

function mute() {
    muted = !muted;

    if (stream) {
        stream.getAudioTracks().forEach(t => t.enabled = !muted);
    }

    muteBtn.classList.toggle("red", muted);
    muteBtn.innerText = muted ? "Unmute" : "Mute";
}

function deafen() {
    deafened = !deafened;

    document.querySelectorAll("audio").forEach(a => a.muted = deafened);

    deafenBtn.classList.toggle("red", deafened);
    deafenBtn.innerText = deafened ? "Undeafen" : "Deafen";
}

renderChat();
