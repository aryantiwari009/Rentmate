import mongoose from "mongoose";
import dns from "node:dns";
import 'dotenv/config';

if (process.env.DNS_SERVERS) {
  const list = process.env.DNS_SERVERS.split(",");
  dns.setServers(list)
}

export async function connectDB(){
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB Connected');
};

