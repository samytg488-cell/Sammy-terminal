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

// --- SMART WHALE ENGINE (v18 Optimized) ---
const runSmartBots = () => {
    setInterval(() => {
        const botType = Math.random();
        
        // 1. WHALE SIGNAL (High Impact)
        if (botType > 0.98) { 
            const side = Math.random() > 0.5 ? 'buy' : 'sell';
            const whaleSize = Math.floor(Math.random() * 5000000) + 2000000;
            processTradeMatching(side, whaleSize, "WHALE_BOT");
        } 
        // 2. INSTITUTIONAL ALGO
        else if (botType > 0.85) {
            const instSize = Math.floor(Math.random() * 1000000) + 500000;
            const side = Math.random() > 0.5 ? 'buy' : 'sell';
            processTradeMatching(side, instSize, "INST_ALGO");
        }
        // 3. RETAIL LIQUIDITY (Har 1.5s mein liquidity refresh hogi taaki trades execute ho sakein)
        else {
            let retailSize = Math.floor(Math.random() * 50000) + 10000;
            buyOrders.push({ id: 'RETAIL_BOT', size: retailSize });
            sellOrders.push({ id: 'RETAIL_BOT', size: retailSize });
            
            // Liquidity Buffer maintain rakhna zaroori hai
            if(buyOrders.length > 150) buyOrders.shift();
            if(sellOrders.length > 150) sellOrders.shift();
        }
    }, 1500); 
};

// --- MATCHING ENGINE (Execution Fix) ---
function processTradeMatching(side, size, traderID) {
    // Impact factor ko thoda balance kiya hai taaki PNL real-time hile
    let impact = size / 105000; 
    let matched = false;

    if (side === 'buy') {
        const totalSellLiquidity = sellOrders.reduce((a, b) => a + b.size, 0);
        if (totalSellLiquidity >= size) {
            reduceLiquidity(sellOrders, size);
            marketPrice += impact;
            matched = true;
        } else {
            // Agar liquidity kam hai toh partial match logic ki jagah order queue mein jayega
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
            msg: `EXECUTED: ${traderID} | ${size.toLocaleString()} lots`,
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

// --- CORE MARKET ENGINE (1s Tick) ---
setInterval(() => {
  marketPrice += (Math.random() - 0.5) * 0.02; // Thoda fast price movement
  let now = Date.now();

  history.push({ x: now, open: marketPrice, high: marketPrice, low: marketPrice, close: marketPrice });
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

  // Frontend se trade request receive karna
  socket.on('executeTrade', (data) => {
    let now = Date.now();

    // Lockdown Check
    if (lockedUsers[socket.id] && now < lockedUsers[socket.id]) {
        return socket.emit('orderLog', { msg: "SYSTEM_LOCKED: Wait for Reset", color: "#f43f5e" });
    }

    // Trade Process
    processTradeMatching(data.side, data.size, `PLAYER_${socket.id.substring(0,4)}`);
  });

  // Balance Update (Exit ke time ya Liquidation par)
  socket.on('updateBalance', (newBalance) => {
    userWallets[socket.id] = newBalance;
    if (newBalance <= 0) {
        lockedUsers[socket.id] = Date.now() + 180000; // 3 Min Lock
        io.emit('orderLog', { msg: `LIQUIDATED: PLAYER_${socket.id.substring(0,4)} is out!`, color: "#f43f5e" });
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
server.listen(PORT, () => console.log(`Institutional Engine v18 Live on ${PORT}`));
