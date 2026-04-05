const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);

// CORS enable kiya hai taaki kisi bhi link se connect ho sake
const io = new Server(server, {
  cors: { origin: "*" }
});

let marketPrice = 100.00;

// Market Engine: Har 1 second mein price update broadcast karega
setInterval(() => {
  const change = (Math.random() - 0.5) * 0.15;
  marketPrice += change;
  io.emit('tick', {
    price: marketPrice,
    time: new Date().getTime()
  });
}, 1000);

io.on('connection', (socket) => {
  console.log('New Trader Connected:', socket.id);

  // Jab koi trade le toh sabko message bhejo
  socket.on('trade', (data) => {
    io.emit('broadcast_trade', {
      user: socket.id.substring(0, 5),
      side: data.side,
      amount: data.amount,
      px: marketPrice.toFixed(2)
    });
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Market Live on Port ${PORT}`));
