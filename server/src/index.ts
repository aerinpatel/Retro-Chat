import "dotenv/config";
import express from 'express';
import { connectDB } from "./db.js";
import authRoutes from "./routes/authRoute_main.js";
// import chatRoutes
import initWebsocketServer from "./routes/chatRoom.js";

const PORT = Number(process.env.PORT) || 8080;
const app = express();

app.use(express.json());
app.use("/auth", authRoutes);
// app.use("/chat",chatRoutes)

async function startServer() {
  // 1. Connect to Database first
  await connectDB();
  // 2. Start Express server only after DB is connected
  const server1 = app.listen(PORT, () => {
    console.log(`Application running on: ${PORT}`);
  });
  initWebsocketServer(server1);
}

startServer();
