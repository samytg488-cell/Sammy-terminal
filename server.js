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

// --- SMART AI BOTS ENGINE (Whale vs Retailer Hierarchy) ---
const runSmartBots = () => {
    setInterval(() => {
        const botType = Math.random();
        
        if (botType > 0.98) { 
            // 1. GOD-MODE WHALE BOT (100x Your Power)
            // Ye bots market ka trend palatne ki taqat rakhte hain
            const whaleSize = Math.floor(Math.random() * 5000000) + 1000000; // 1M to 5M lots
            const side = Math.random() > 0.5 ? 'buy' : 'sell';
            processTradeMatching(side, whaleSize, "CORE_WHALE_INSTITUTION");
        } 
        else if (botType > 0.85) {
            // 2. INSTITUTIONAL BOT (High Power)
            const instSize = Math.floor(Math.random() * 800000) + 200000;
            const side = Math.random() > 0.5 ? 'buy' : 'sell';
            processTradeMatching(side, instSize, "BANK_OF_ALGO");
        }
        else {
            // 3. RETAILER BOTS (Your Level)
            // Ye bots market mein normal liquidity aur noise banate hain
            let retailSize = Math.floor(Math.random() * 40000) + 5000;
            buyOrders.push({ id: 'RETAIL_BOT', size: retailSize });
            sellOrders.push({ id: 'RETAIL_BOT', size: retailSize });
            
            if(buyOrders.length > 60) buyOrders.shift();
            if(sellOrders.length > 60) sellOrders.shift();
        }
    }, 2000);
};

// --- ORDER MATCHING & PRICE IMPACT LOGIC ---
function processTradeMatching(side, size, traderID) {
    // Price Impact: Badi quantity se market hilega
    let impact = size / 120000; 
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
            msg: `EXECUTED: ${traderID} matched ${size.toLocaleString()} lots.`,
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

// --- CORE MARKET ENGINE (Candle Synchronization) ---
setInterval(() => {
  marketPrice += (Math.random() - 0.5) * 0.012; // Natural Volatility
  
  let now = Date.now();
  // 1 Minute Candle Core Logic
  if (history.length === 0 || now - history[history.length-1].x >= 60000) {
    let open = history.length > 0 ? history[history.length-1].close : marketPrice;
    history.push({ x: now, open, high: marketPrice, low: marketPrice, close: marketPrice });
    if(history.length > 200) history.shift();
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
  userWallets[socket.id] = 50000; 
  
  io.emit('userCountUpdate', activeUsers);
  socket.emit('initData', history);

  socket.on('executeTrade', (data) => {
    if (userWallets[socket.id] <= 0) {
        socket.emit('orderLog', { msg: "REJECTED: Margin Call / Bankrupt!", color: "#ff0000" });
        return;
    }
    processTradeMatching(data.side, data.size, `PLAYER_${socket.id.substring(0,4)}`);
  });

  socket.on('updateBalance', (newBalance) => {
    userWallets[socket.id] = newBalance;
    if (newBalance <= 0) {
        io.emit('orderLog', { msg: `ACCOUNT_WIPED: PLAYER_${socket.id.substring(0,4)} has been liquidated!`, color: "#f43f5e" });
    }
  });

  socket.on('disconnect', () => {
    activeUsers = Math.max(0, activeUsers - 1);
    delete userWallets[socket.id];
    io.emit('userCountUpdate', activeUsers);
  });
});

runSmartBots(); // Power on the Institutions

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Institutional Terminal Engine Live on ${PORT}`));
