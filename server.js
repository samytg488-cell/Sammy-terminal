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

// --- SMART WHALE ENGINE (v19 Optimized for SL/TP) ---
const runSmartBots = () => {
    setInterval(() => {
        const botType = Math.random();
        
        // 1. WHALE SIGNAL - Market ko move karne ke liye
        if (botType > 0.96) { 
            const side = Math.random() > 0.5 ? 'buy' : 'sell';
            const whaleSize = Math.floor(Math.random() * 6000000) + 3000000;
            processTradeMatching(side, whaleSize, "WHALE_NODE");
        } 
        // 2. INSTITUTIONAL LIQUIDITY - Constant depth maintain karne ke liye
        else {
            let volume = Math.floor(Math.random() * 100000) + 50000;
            buyOrders.push({ id: 'AUTO_LP', size: volume });
            sellOrders.push({ id: 'AUTO_LP', size: volume });
            
            if(buyOrders.length > 100) buyOrders.shift();
            if(sellOrders.length > 100) sellOrders.shift();
        }
    }, 1200); // Thoda fast frequency
};

// --- MATCHING ENGINE (Instant Execution for SL/TP Sync) ---
function processTradeMatching(side, size, traderID) {
    // Impact calculation: v19 mein thoda sensitive rakha hai taaki Sliders hit hon
    let impact = size / 95000; 
    
    if (side === 'buy') {
        marketPrice += impact;
        reduceLiquidity(sellOrders, size);
    } else {
        marketPrice -= impact;
        reduceLiquidity(buyOrders, size);
    }

    io.emit('orderLog', { 
        msg: `EXECUTION: ${traderID} | ${size.toLocaleString()} lots`,
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

// --- CORE TICK ENGINE (Real-time PNL Movement) ---
setInterval(() => {
  // Volatility badha di hai taaki SL/TP sliders test ho sakein
  marketPrice += (Math.random() - 0.5) * 0.04; 
  let now = Date.now();

  history.push({ x: now, open: marketPrice, high: marketPrice, low: marketPrice, close: marketPrice });
  if(history.length > 8000) history.shift();

  io.emit('marketUpdate', { 
    price: marketPrice, 
    activeUsers: activeUsers,
    history: history,
    buyQty: buyOrders.reduce((a, b) => a + b.size, 0) + 500000, 
    sellQty: sellOrders.reduce((a, b) => a + b.size, 0) + 500000
  });
}, 1000);

// --- SOCKET CONNECTION ---
io.on('connection', (socket) => {
  activeUsers++;
  userWallets[socket.id] = 50000; 
  
  io.emit('userCountUpdate', activeUsers);
  socket.emit('initData', history);

  // Jab user PUMP/DUMP click kare
  socket.on('executeTrade', (data) => {
    let now = Date.now();
    if (lockedUsers[socket.id] && now < lockedUsers[socket.id]) return;

    processTradeMatching(data.side, data.size, `TRADER_${socket.id.substring(0,4)}`);
  });

  // Jab SL, TP, ya Manual Exit trigger ho
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
server.listen(PORT, () => console.log(`Institutional Engine v19 (SL/TP Ready) Live on ${PORT}`));
