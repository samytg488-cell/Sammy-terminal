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

// --- MARKET VARIABLES ---
let marketPrice = 100.00;
let activeUsers = 0;
let history = []; 
let buyOrders = []; 
let sellOrders = []; 
let userWallets = {}; 
let lockedUsers = {}; 

// --- SMART WHALE ENGINE (v19 - High Liquidity) ---
const runSmartBots = () => {
    setInterval(() => {
        const botType = Math.random();
        
        // 1. WHALE SIGNAL
        if (botType > 0.97) { 
            const side = Math.random() > 0.5 ? 'buy' : 'sell';
            const whaleSize = Math.floor(Math.random() * 8000000) + 2000000;
            processTradeMatching(side, whaleSize, "WHALE_BOT");
        } 
        // 2. RETAIL NOISE (Har 1s mein liquidity bhari jayegi)
        else {
            let retailSize = Math.floor(Math.random() * 200000) + 50000;
            // Constant liquidity supply taaki user ke orders hamesha fill hon
            buyOrders.push({ id: 'LIQUIDITY_PROVIDER', size: retailSize });
            sellOrders.push({ id: 'LIQUIDITY_PROVIDER', size: retailSize });
            
            if(buyOrders.length > 50) buyOrders.shift();
            if(sellOrders.length > 50) sellOrders.shift();
        }
    }, 1000); 
};

// --- MATCHING ENGINE (Instant Fill Logic) ---
function processTradeMatching(side, size, traderID) {
    // Impact ko thoda sensitive banaya hai taaki PNL fast change ho
    let impact = size / 85000; 
    
    if (side === 'buy') {
        marketPrice += impact;
        reduceLiquidity(sellOrders, size);
    } else {
        marketPrice -= impact;
        reduceLiquidity(buyOrders, size);
    }

    // Har trade par confirmation bhejna zaroori hai
    io.emit('orderLog', { 
        msg: `Trade Filled: ${traderID} | ${size.toLocaleString()} Lots`,
        color: side === 'buy' ? '#10b981' : '#f43f5e'
    });
}

function reduceLiquidity(orderArray, sizeToReduce) {
    let remaining = sizeToReduce;
    while (remaining > 0 && orderArray.length > 0) {
        if (orderArray[0].size <= remaining) {
            remaining -= orderArray[0].size;
            orderArray.shift();
        } else {
            orderArray[0].size -= remaining;
            remaining = 0;
        }
    }
}

// --- CORE MARKET TICK (1s) ---
setInterval(() => {
  // Natural movement thoda badha diya hai
  marketPrice += (Math.random() - 0.5) * 0.05; 
  let now = Date.now();

  history.push({ x: now, open: marketPrice, high: marketPrice, low: marketPrice, close: marketPrice });
  if(history.length > 5000) history.shift();

  io.emit('marketUpdate', { 
    price: marketPrice, 
    activeUsers: activeUsers,
    history: history,
    buyQty: buyOrders.reduce((a, b) => a + b.size, 0) + 1000000, // Artificial depth
    sellQty: sellOrders.reduce((a, b) => a + b.size, 0) + 1000000
  });
}, 1000);

// --- SOCKET EVENTS ---
io.on('connection', (socket) => {
  activeUsers++;
  userWallets[socket.id] = 50000; 
  io.emit('userCountUpdate', activeUsers);
  socket.emit('initData', history);

  socket.on('executeTrade', (data) => {
    // Instant execution trigger
    processTradeMatching(data.side, data.size, `PLAYER_${socket.id.substring(0,4)}`);
  });

  socket.on('updateBalance', (newBalance) => {
    userWallets[socket.id] = newBalance;
    if (newBalance <= 0) {
        lockedUsers[socket.id] = Date.now() + 180000;
        io.emit('orderLog', { msg: "ACCOUNT_LIQUIDATED", color: "#f43f5e" });
    }
  });

  socket.on('disconnect', () => {
    activeUsers = Math.max(0, activeUsers - 1);
    io.emit('userCountUpdate', activeUsers);
  });
});

runSmartBots();

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Engine v19 Live on ${PORT}`));
