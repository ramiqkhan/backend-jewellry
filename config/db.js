import dns from "node:dns";
import mongoose from "mongoose";

// Locally, some routers' DNS can't resolve Atlas SRV records (querySrv ECONNREFUSED),
// so use public DNS. Vercel's DNS works fine, so leave it alone there.
if (!process.env.VERCEL) dns.setServers(["8.8.8.8", "8.8.4.4"]);

// One shared connection. On Vercel a warm function instance reuses it between requests
// instead of reconnecting every time.
let connecting = null;

export function connectDB() {
  if (mongoose.connection.readyState === 1) return Promise.resolve(mongoose.connection);

  if (!connecting) {
    if (!process.env.MONGO_URI) throw new Error("MONGO_URI is not set");

    connecting = mongoose
      .connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 10000 })
      .then((conn) => {
        console.log(`MongoDB connected: ${conn.connection.host}`);
        return conn.connection;
      })
      .catch((error) => {
        connecting = null; // let the next request try again
        console.error(`MongoDB connection error: ${error.message}`);
        throw error;
      });
  }
  return connecting;
}
