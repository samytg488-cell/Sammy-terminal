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
let buyOrders = []; // Pending Market Liquidity
let sellOrders = []; 
let userWallets = {}; // Track individual balances

// --- SMART AI BOTS ENGINE ---
// Ye bots market mein liquidity maintain karte hain aur Institutional moves banate hain
const runSmartBots = () => {
    setInterval(() => {
        const botDecision = Math.random();
        let size = Math.floor(Math.random() * 15000) + 5000;
        
        if (botDecision > 0.97) { 
            // INSTITUTIONAL WHALE MOVE (3% chance)
            const whaleSize = Math.floor(Math.random() * 150000) + 50000;
            const side = Math.random() > 0.5 ? 'buy' : 'sell';
            processTradeMatching(side, whaleSize, "WHALE_INSTITUTION");
        } else if (botDecision > 0.60) {
            // MARKET MAKERS (Providing Liquidity)
            buyOrders.push({ id: 'SMART_BOT', size: size });
            sellOrders.push({ id: 'SMART_BOT', size: size });
            
            // Limit order book size to prevent memory leaks
            if(buyOrders.length > 50) buyOrders.shift();
            if(sellOrders.length > 50) sellOrders.shift();
        }
    }, 2500);
};

// --- ORDER MATCHING & PRICE IMPACT LOGIC ---
function processTradeMatching(side, size, traderID) {
    let impact = size / 100000; // Har 100k lots par $1 ka impact
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
            msg: `MATCHED: ${traderID} ${side.toUpperCase()} ${size.toLocaleString()} lots.`,
            color: side === 'buy' ? '#10b981' : '#f43f5e'
        });
    } else {
        io.emit('orderLog', { 
            msg: `PENDING: ${traderID} waiting for opposite liquidity.`,
            color: '#fbbf24'
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

// --- CORE MARKET ENGINE ---
setInterval(() => {
  // Natural drift (Market noise)
  marketPrice += (Math.random() - 0.5) * 0.01;
  
  let now = Date.now();
  if (history.length === 0 || now - history[history.length-1].x >= 60000) {
    let open = history.length > 0 ? history[history.length-1].close : marketPrice;
    history.push({ x: now, open, high: marketPrice, low: marketPrice, close: marketPrice });
    if(history.length > 100) history.shift();
  } else {
    let last = history[history.length-1];
    last.high = Math.max(last.high, marketPrice);
    last.low = Math.min(last.low, marketPrice);
    last.close = marketPrice;
  }

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
  userWallets[socket.id] = 50000; // Starting capital for each user
  
  io.emit('userCountUpdate', activeUsers);
  socket.emit('initData', history);

  socket.on('executeTrade', (data) => {
    // Check if user is bankrupt
    if (userWallets[socket.id] <= 0) {
        socket.emit('orderLog', { msg: "EXECUTION REJECTED: Account Bankrupt!", color: "#ff0000" });
        return;
    }
    processTradeMatching(data.side, data.size, `TRADER_${socket.id.substring(0,4)}`);
  });

  socket.on('updateBalance', (newBalance) => {
    userWallets[socket.id] = newBalance;
    if (newBalance <= 0) {
        io.emit('orderLog', { msg: `LIQUIDATION: TRADER_${socket.id.substring(0,4)} wiped out!`, color: "#f43f5e" });
    }
  });

  socket.on('disconnect', () => {
    activeUsers = Math.max(0, activeUsers - 1);
    delete userWallets[socket.id];
    io.emit('userCountUpdate', activeUsers);
  });
});

runSmartBots(); // Start AI Liquidity

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Institutional Engine Live on ${PORT}`));
