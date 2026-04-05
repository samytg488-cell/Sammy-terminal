const express = require('express');
const path = require('path'); 
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);

// --- FRONTEND CONNECTIVITY ---
app.use(express.static(__dirname)); 

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

const io = new Server(server, { 
  cors: { origin: "*" } 
});

let marketPrice = 100.00;
let pool = 5000000;
let activeUsers = 0; // Active users count karne ke liye

// Market Engine: Har 1 second mein sabhi ko SAME price bhejega
setInterval(() => {
  marketPrice += (Math.random() - 0.5) * 0.22; 
  
  io.emit('marketUpdate', { 
    price: marketPrice, 
    pool: pool,
    activeUsers: activeUsers // Sabhi ko current user count bhej raha hai
  });
}, 1000);

io.on('connection', (socket) => {
  // Naya user aane par count badhao
  activeUsers++;
  io.emit('userCountUpdate', activeUsers); 
  console.log('New Trader Linked:', socket.id, 'Total:', activeUsers);

  // User ke jaane par count kam karo
  socket.on('disconnect', () => {
    activeUsers = Math.max(0, activeUsers - 1);
    io.emit('userCountUpdate', activeUsers);
    console.log('Trader Unlinked. Total:', activeUsers);
  });

  // Jab koi player BUY/SELL karega toh sabhi ko dikhega
  socket.on('executeTrade', (data) => {
    io.emit('orderLog', { 
      msg: `TRADER_${socket.id.substring(0,4)}: ${data.side.toUpperCase()} ${data.size} lots @ ${marketPrice.toFixed(2)}`,
      color: data.side === 'buy' ? '#10b981' : '#f43f5e'
    });
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`SAMMY_TERMINAL is Live on Port ${PORT}`);
});
