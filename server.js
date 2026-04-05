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
let lockedUsers = {}; // 3-Minute Penalty Tracking

// --- SMART WHALE ENGINE (WhatsApp Signal Style) ---
const runSmartBots = () => {
    setInterval(() => {
        const botType = Math.random();
        
        // 1. WHALE SIGNAL (2% chance) - High Impact
        if (botType > 0.98) { 
            const side = Math.random() > 0.5 ? 'buy' : 'sell';
            const whaleSize = Math.floor(Math.random() * 5000000) + 1000000;
            processTradeMatching(side, whaleSize, "WHALE_SIGNAL_BOT");
        } 
        // 2. INSTITUTIONAL ALGO (15% chance)
        else if (botType > 0.83) {
            const instSize = Math.floor(Math.random() * 800000) + 200000;
            const side = Math.random() > 0.5 ? 'buy' : 'sell';
            processTradeMatching(side, instSize, "INSTITUTIONAL_ALGO");
        }
        // 3. RETAIL LIQUIDITY (Constant)
        else {
            let retailSize = Math.floor(Math.random() * 30000) + 5000;
            buyOrders.push({ id: 'RETAIL_BOT', size: retailSize });
            sellOrders.push({ id: 'RETAIL_BOT', size: retailSize });
            
            if(buyOrders.length > 100) buyOrders.shift();
            if(sellOrders.length > 100) sellOrders.shift();
        }
    }, 1500); // Scalping frequency
};

// --- MATCHING ENGINE ---
function processTradeMatching(side, size, traderID) {
    let impact = size / 110000; 
    let matched = false;

    if (side === 'buy') {
        const totalSellLiquidity = sellOrders.reduce((a, b) => a + b.size, 0);
        if (totalSellLiquidity >= size) {
            reduceLiquidity(sellOrders, size);
            marketPrice += impact;
            matched = true;
        } else {
            buyOrders.push({ id: traderID, size: size });
        }
    } else {
        const totalBuyLiquidity = buyOrders.reduce((a, b) => a + b.size, 0);
        if (totalBuyLiquidity >= size) {
            reduceLiquidity(buyOrders, size);
            marketPrice -= impact;
            matched = true;
        } else {
            sellOrders.push({ id: traderID, size: size });
        }
    }

    if (matched) {
        io.emit('orderLog', { 
            msg: `SIGNAL_EXECUTED: ${traderID} | ${size.toLocaleString()} lots`,
            color: side === 'buy' ? '#10b981' : '#f43f5e'
        });
    }
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

// --- CORE MARKET ENGINE (1-Second Heartbeat) ---
setInterval(() => {
  marketPrice += (Math.random() - 0.5) * 0.015; 
  let now = Date.now();

  // Har second raw data push karein taaki 1s/2s chart chale
  history.push({ x: now, open: marketPrice, high: marketPrice, low: marketPrice, close: marketPrice });
  
  // Memory management: Last 15,000 ticks (~4 hours of 1s data)
  if(history.length > 15000) history.shift();

  io.emit('marketUpdate', { 
    price: marketPrice, 
    activeUsers: activeUsers,
    history: history,
    buyQty: buyOrders.reduce((a, b) => a + b.size, 0),
    sellQty: sellOrders.reduce((a, b) => a + b.size, 0)
  });
}, 1000);

// --- CONNECTION & LOCK LOGIC ---
io.on('connection', (socket) => {
  activeUsers++;
  userWallets[socket.id] = 50000; 
  
  io.emit('userCountUpdate', activeUsers);
  socket.emit('initData', history);

  socket.on('executeTrade', (data) => {
    let now = Date.now();

    // 3-Minute Penalty Check
    if (lockedUsers[socket.id] && now < lockedUsers[socket.id]) {
        let wait = Math.ceil((lockedUsers[socket.id] - now) / 1000);
        socket.emit('orderLog', { msg: `ACCOUNT_LOCKED: Wait ${wait}s`, color: "#f43f5e" });
        return;
    }

    if (userWallets[socket.id] <= 0) {
        lockedUsers[socket.id] = Date.now() + 180000; // 3 Min Lock
        socket.emit('orderLog', { msg: "BANKRUPT! Account locked for 3 mins.", color: "#ff0000" });
        return;
    }

    processTradeMatching(data.side, data.size, `TRADER_${socket.id.substring(0,4)}`);
  });

  socket.on('updateBalance', (newBalance) => {
    userWallets[socket.id] = newBalance;
    if (newBalance <= 0) {
        lockedUsers[socket.id] = Date.now() + 180000;
        io.emit('orderLog', { msg: `LIQUIDATED: TRADER_${socket.id.substring(0,4)} lost everything!`, color: "#f43f5e" });
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
server.listen(PORT, () => console.log(`Smart Engine Live on ${PORT}`));
