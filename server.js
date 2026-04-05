const express = require('express');
const path = require('path'); 
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);

// --- FRONTEND CONNECTIVITY (Isse 'Cannot GET /' error hatega) ---
app.use(express.static(__dirname)); 

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});
// -------------------------------------------------------------

const io = new Server(server, { 
  cors: { origin: "*" } 
});

let marketPrice = 100.00;
let pool = 5000000;

// Market Engine: Har 1 second mein sabhi users ko price bhejega
setInterval(() => {
  // Thoda random movement
  marketPrice += (Math.random() - 0.5) * 0.22; 
  
  io.emit('marketUpdate', { 
    price: marketPrice, 
    pool: pool,
    url: "https://sammy-terminal.onrender.com/" 
  });
}, 1000);

io.on('connection', (socket) => {
  console.log('New Trader Linked:', socket.id);

  // Jab koi player BUY/SELL karega
  socket.on('executeTrade', (data) => {
    io.emit('orderLog', { 
      msg: `TRADER_${socket.id.substring(0,4)}: ${data.side.toUpperCase()} ${data.size} lots @ ${marketPrice.toFixed(2)}`,
      color: data.side === 'buy' ? '#10b981' : '#f43f5e'
    });
  });
});

// Render variable port use karta hai isliye process.env.PORT zaroori hai
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`SAMMY_TERMINAL is Live on Port ${PORT}`);
});
