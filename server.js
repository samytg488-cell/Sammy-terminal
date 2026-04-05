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

// --- DYNAMIC INSTITUTIONAL ALGO (v20 FIX) ---
const runSmartBots = () => {
    setInterval(() => {
        // --- LOGIC: Price Balance Check ---
        // Agar price bahut high hai, toh SELL ka chance 70% hoga.
        // Agar price bahut low hai, toh BUY ka chance 70% hoga.
        let buyProbability = 0.5; 
        if (marketPrice > 105) buyProbability = 0.3; // High price? Bots will dump.
        if (marketPrice < 95) buyProbability = 0.7;  // Low price? Bots will pump.

        const botType = Math.random();
        const side = Math.random() < buyProbability ? 'buy' : 'sell';

        // 1. WHALE SIGNAL (Strategic Movement)
        if (botType > 0.96) { 
            const whaleSize = Math.floor(Math.random() * 5000000) + 3000000;
            processTradeMatching(side, whaleSize, "WHALE_ALGO");
        } 
        // 2. INSTITUTIONAL FLOW
        else if (botType > 0.75) {
            const instSize = Math.floor(Math.random() * 1000000) + 200000;
            processTradeMatching(side, instSize, "INST_DUMP_PUMP");
        }
        // 3. RETAIL LIQUIDITY (Dono taraf order book bharna)
        else {
            let retailSize = Math.floor(Math.random() * 80000) + 20000;
            buyOrders.push({ id: 'LP', size: retailSize });
            sellOrders.push({ id: 'LP', size: retailSize });
            
            if(buyOrders.length > 100) buyOrders.shift();
            if(sellOrders.length > 100) sellOrders.shift();
        }
    }, 1200); 
};

// --- MATCHING ENGINE ---
function processTradeMatching(side, size, traderID) {
    let impact = size / 100000; 
    
    // Instant execution for better chart feel
    if (side === 'buy') {
        marketPrice += impact;
        reduceLiquidity(sellOrders, size);
    } else {
        marketPrice -= impact;
        reduceLiquidity(buyOrders, size);
    }

    io.emit('orderLog', { 
        msg: `EXECUTED: ${traderID} | ${size.toLocaleString()} lots`,
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

// --- CORE MARKET HEARTBEAT (1s) ---
setInterval(() => {
  // Natural market jitter
  marketPrice += (Math.random() - 0.5) * 0.04; 
  let now = Date.now();

  history.push({ x: now, open: marketPrice, high: marketPrice + 0.01, low: marketPrice - 0.01, close: marketPrice });
  if(history.length > 5000) history.shift();

  io.emit('marketUpdate', { 
    price: marketPrice, 
    activeUsers: activeUsers,
    history: history,
    buyQty: buyOrders.reduce((a, b) => a + b.size, 0) + 1000000, // Extra depth for visuals
    sellQty: sellOrders.reduce((a, b) => a + b.size, 0) + 1000000
  });
}, 1000);

// --- SOCKET CONNECTION ---
io.on('connection', (socket) => {
  activeUsers++;
  userWallets[socket.id] = 50000; 
  
  io.emit('userCountUpdate', activeUsers);
  socket.emit('initData', history);

  socket.on('executeTrade', (data) => {
    let now = Date.now();
    if (lockedUsers[socket.id] && now < lockedUsers[socket.id]) return;
    processTradeMatching(data.side, data.size, `PLAYER_${socket.id.substring(0,4)}`);
  });

  socket.on('updateBalance', (newBalance) => {
    userWallets[socket.id] = newBalance;
    if (newBalance <= 0) {
        lockedUsers[socket.id] = Date.now() + 180000;
        io.emit('orderLog', { msg: `LIQUIDATED: TRADER_${socket.id.substring(0,4)}`, color: "#f43f5e" });
    }
  });

  socket.on('disconnect', () => {
    activeUsers = Math.max(0, activeUsers - 1);
    delete userWallets[socket.id];
    delete lockedUsers[socket.id];
    io.emit('userCountUpdate', activeUsers);
  });
});

runSmartBots();

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Smart Algo Engine v20 Live on ${PORT}`));
