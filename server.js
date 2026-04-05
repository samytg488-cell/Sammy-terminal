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

// --- SMART WHALE ENGINE (WhatsApp Signal Logic) ---
const runSmartBots = () => {
    setInterval(() => {
        const botType = Math.random();
        
        // WhatsApp Smart Signal: Whale tabhi enter karegi jab extreme momentum ho (2% chance)
        if (botType > 0.98) { 
            const side = Math.random() > 0.5 ? 'buy' : 'sell';
            const whaleSize = Math.floor(Math.random() * 5000000) + 1000000; 
            processTradeMatching(side, whaleSize, "WHALE_SMART_SIGNAL");
        } 
        // Institutional Banks (15% chance)
        else if (botType > 0.83) {
            const instSize = Math.floor(Math.random() * 800000) + 200000;
            const side = Math.random() > 0.5 ? 'buy' : 'sell';
            processTradeMatching(side, instSize, "INSTITUTIONAL_BANK");
        }
        // Retail Bots (Constant noise/liquidity)
        else {
            let retailSize = Math.floor(Math.random() * 40000) + 5000;
            buyOrders.push({ id: 'RETAIL_BOT', size: retailSize });
            sellOrders.push({ id: 'RETAIL_BOT', size: retailSize });
            
            if(buyOrders.length > 100) buyOrders.shift();
            if(sellOrders.length > 100) sellOrders.shift();
        }
    }, 1500); // Faster bot frequency for 1s charts
};

// --- ORDER MATCHING & PRICE IMPACT ---
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
            msg: `SIGNAL_MATCHED: ${traderID} | ${side.toUpperCase()} ${size.toLocaleString()} lots.`,
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

// --- CORE MARKET ENGINE (1-Second Tick) ---
setInterval(() => {
  marketPrice += (Math.random() - 0.5) * 0.015; 
  
  let now = Date.now();
  // Server hamesha 1-second ticks store karta hai, client ise aggregate karega
  history.push({ x: now, open: marketPrice, high: marketPrice, low: marketPrice, close: marketPrice });
  
  // Keep last 10,000 seconds for 1D timeframe aggregation
  if(history.length > 10000) history.shift();

  io.emit('marketUpdate', { 
    price: marketPrice, 
    activeUsers: activeUsers,
    history: history,
    buyQty: buyOrders.reduce((a, b) => a + b.size, 0),
    sellQty: sellOrders.reduce((a, b) => a + b.size, 0)
  });
}, 1000);

// --- CONNECTION HANDLER ---
io.on('connection', (socket) => {
  activeUsers++;
  userWallets[socket.id] = 50000; 
  
  io.emit('userCountUpdate', activeUsers);
  socket.emit('initData', history);

  socket.on('executeTrade', (data) => {
    let now = Date.now();

    // Check for 3-minute lock
    if (lockedUsers[socket.id] && now < lockedUsers[socket.id]) {
        socket.emit('orderLog', { msg: "ACCOUNT_LOCKED: Wait for penalty to expire.", color: "#f43f5e" });
        return;
    }

    if (userWallets[socket.id] <= 0) {
        lockedUsers[socket.id] = Date.now() + 180000; // 3 Minute Penalty
        socket.emit('orderLog', { msg: "BANKRUPT! Account locked for 3 mins.", color: "#ff0000" });
        return;
    }

    processTradeMatching(data.side, data.size, `TRADER_${socket.id.substring(0,4)}`);
  });

  socket.on('updateBalance', (newBalance) => {
    userWallets[socket.id] = newBalance;
    if (newBalance <= 0) {
        lockedUsers[socket.id] = Date.now() + 180000; 
        io.emit('orderLog', { msg: `LIQUIDATED: TRADER_${socket.id.substring(0,4)} is out for 3 mins!`, color: "#f43f5e" });
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
server.listen(PORT, () => console.log(`Smart Institutional Engine Live on ${PORT}`));
