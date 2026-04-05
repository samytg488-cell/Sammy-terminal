const express = require('express');
const path = require('path'); 
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
app.use(express.static(__dirname)); 

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

const io = new Server(server, { cors: { origin: "*" } });

let marketPrice = 100.00;
let activeUsers = 0;
let history = []; // <-- Isme saari candles save hongi

// Market Engine: Har 1 sec mein price update
setInterval(() => {
  marketPrice += (Math.random() - 0.5) * 0.22;
  
  // Candle logic on server side
  let now = new Date().getTime();
  if (history.length === 0 || now - history[history.length-1].x >= 60000) {
    history.push({ x: now, open: marketPrice, high: marketPrice, low: marketPrice, close: marketPrice });
    if(history.length > 100) history.shift(); // Sirf last 100 candles rakho
  } else {
    let last = history[history.length-1];
    last.high = Math.max(last.high, marketPrice);
    last.low = Math.min(last.low, marketPrice);
    last.close = marketPrice;
  }

  io.emit('marketUpdate', { 
    price: marketPrice, 
    activeUsers: activeUsers,
    history: history // Pura history sabko bhej raha hai
  });
}, 1000);

io.on('connection', (socket) => {
  activeUsers++;
  io.emit('userCountUpdate', activeUsers);
  
  // Naye user ko turant purana data bhejo
  socket.emit('initData', history);

  socket.on('disconnect', () => {
    activeUsers = Math.max(0, activeUsers - 1);
    io.emit('userCountUpdate', activeUsers);
  });

  socket.on('executeTrade', (data) => {
    io.emit('orderLog', { 
      msg: `TRADER_${socket.id.substring(0,4)}: ${data.side.toUpperCase()} ${data.size} lots`,
      color: data.side === 'buy' ? '#10b981' : '#f43f5e'
    });
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Live on ${PORT}`));
