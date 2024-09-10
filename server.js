const express = require("express");
const mongoose = require("mongoose");
const Web3 = require("web3");
const cors = require("cors");
const axios = require("axios");

// Create Express App
const app = express();
app.use(express.json());
app.use(cors());

// MongoDB Connection (Direct URL)
const DB_URL = "mongodb+srv://user:123@cluster0.b3s8i1k.mongodb.net/deposits";
mongoose
  .connect(DB_URL, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error("MongoDB connection error:", err));

// Ethereum RPC Connection (Alchemy URL)
const RPC_URL =
  "https://eth-mainnet.g.alchemy.com/v2/Sc06r6RdQlFPFFypdj4n6rYqd1IsLZnG";
const web3 = new Web3(new Web3.providers.HttpProvider(RPC_URL));

// Telegram Bot Configuration
const TELEGRAM_BOT_TOKEN = "6910022042:AAGjG_66N3N4O_G2K7mvGlcenxwQPVCSLd4";
const TELEGRAM_CHAT_ID = "1042079012";
const TELEGRAM_API_URL = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;

// Deposit Schema
const depositSchema = new mongoose.Schema({
  blockNumber: Number,
  blockTimestamp: Date,
  fee: String,
  txHash: String,
  sender: String,
});

const Deposit = mongoose.model("Deposit", depositSchema);

// Function to Send Telegram Notification
const sendTelegramNotification = async (message) => {
  try {
    await axios.post(TELEGRAM_API_URL, {
      chat_id: TELEGRAM_CHAT_ID,
      text: message,
    });
    console.log("Telegram notification sent.");
  } catch (error) {
    console.error("Error sending Telegram notification:", error);
  }
};

// Function to Track and Store Block Data
const trackDeposits = async () => {
  try {
    const latestBlock = await web3.eth.getBlockNumber();
    console.log("Tracking Block:", latestBlock);

    const block = await web3.eth.getBlock(latestBlock, true);
    if (block && block.transactions) {
      for (const tx of block.transactions) {
        try {
          const receipt = await web3.eth.getTransactionReceipt(tx.hash);
          const gasUsed = receipt.gasUsed;
          const gasPrice = tx.gasPrice;

          // Save deposit information to MongoDB
          const deposit = new Deposit({
            blockNumber: block.number,
            blockTimestamp: new Date(block.timestamp * 1000),
            fee: web3.utils.fromWei((gasUsed * gasPrice).toString(), "ether"),
            txHash: tx.hash,
            sender: tx.from, // Sender's address
          });

          await deposit.save();
          console.log("Deposit saved.");
          const message = `New Deposit:\nBlock Number: ${deposit.blockNumber}\nFee: ${deposit.fee} ETH\nTransaction Hash: ${deposit.txHash}\nSender: ${deposit.sender}`;
          await sendTelegramNotification(message);
        } catch (error) {
          console.error("Error saving transaction:", error);
        }
      }
    }
  } catch (error) {
    console.error("Error while fetching block or transactions:", error);
  }
};

// Poll for new blocks every 30 seconds
setInterval(trackDeposits, 30000);

// API Route to Get All Deposits
app.get("/api/deposits", async (req, res) => {
  try {
    const deposits = await Deposit.find();
    res.json(deposits);
  } catch (error) {
    res.status(500).json({ error: "Error fetching deposits" });
  }
});

// Start Server
const port = process.env.PORT || 5000;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
