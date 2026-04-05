const express = require('express');
const path = require('path'); 
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);

// --- YEH HISSA FILE DIKHANE KE LIYE HAI ---
app.use(express.static(__dirname)); 

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});
// -----------------------------------------

const io = new Server(server, { 
  cors: { origin: "*" } 
});

let marketPrice = 100.00;
let pool = 5000000;

// Market Engine
setInterval(() => {
  marketPrice += (Math.random() - 0.5) * 0.18;
  io.emit('marketUpdate', { price: marketPrice, pool: pool });
}, 1000);

io.on('connection', (socket) => {
  console.log('Trader Joined:', socket.id);

  socket.on('executeTrade', (data) => {
    io.emit('orderLog', { 
      msg: `TRADER_${socket.id.substring(0,4)}: ${data.side.toUpperCase()} ${data.size} lots`,
      color: data.side === 'buy' ? '#10b981' : '#f43f5e'
    });
  });
});

// Render variable port use karta hai isliye process.env.PORT zaroori hai
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
