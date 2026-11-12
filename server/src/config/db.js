import mongoose from "mongoose";
import dns from "node:dns";
import 'dotenv/config';

if (process.env.DNS_SERVERS && process.env.DNS_SERVERS.trim() !== "") {
  const list = process.env.DNS_SERVERS.split(",").map((s) => s.trim()).filter(Boolean);
  if (list.length > 0) {
    dns.setServers(list);
  }
}

export async function connectDB(){
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB Connected');
};

