const express = require("express")
const http = require("http")
const { Server } = require("socket.io")
const fs = require("fs")

const app = express()
const server = http.createServer(app)

const io = new Server(server, {
  cors: { origin: "*" }
})

// IMPORTANT FOR HOSTING (Render / Railway)
const PORT = process.env.PORT || 3000

if (!fs.existsSync("./chats")) fs.mkdirSync("./chats")
if (!fs.existsSync("./users")) fs.mkdirSync("./users")
if (!fs.existsSync("./chats/global.txt")) fs.writeFileSync("./chats/global.txt","")

const users = []

io.on("connection", socket => {

  socket.on("login", data => {

    socket.username = data.username

    users.push({
      id: socket.id,
      username: data.username
    })

    io.emit("online_users", users)

    const oldChat = fs.readFileSync("./chats/global.txt","utf8")
    socket.emit("chat_history", oldChat)

    const msg = `[SYSTEM] ${data.username} joined\n`
    fs.appendFileSync("./chats/global.txt", msg)

    io.emit("new_message", {
      username: "SYSTEM",
      text: `${data.username} joined`
    })
  })

  socket.on("send_message", data => {

    const line = `${socket.username}: ${data.text}\n`

    fs.appendFileSync("./chats/global.txt", line)

    io.emit("new_message", {
      username: socket.username,
      text: data.text
    })
  })

  socket.on("disconnect", () => {

    const i = users.findIndex(u => u.id === socket.id)

    if (i !== -1) {

      const name = users[i].username
      users.splice(i,1)

      const msg = `[SYSTEM] ${name} left\n`

      fs.appendFileSync("./chats/global.txt", msg)

      io.emit("online_users", users)

      io.emit("new_message", {
        username: "SYSTEM",
        text: `${name} left`
      })
    }
  })
})

server.listen(PORT, () => {
  console.log("TEXTEL RUNNING ON " + PORT)
})
