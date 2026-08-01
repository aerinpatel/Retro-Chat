import "dotenv/config";
import express from 'express';
import { connectDB } from "./db.js";
import authRoutes from "./routes/authRoute_main.js";

const PORT = Number(process.env.PORT) || 8080;
const app = express();

app.use(express.json());
app.use("/auth", authRoutes);

async function startServer() {
  // 1. Connect to Database first
  await connectDB();

  // 2. Start Express server only after DB is connected
  app.listen(PORT, () => {
    console.log(`Application running on: ${PORT}`);
  });
}

startServer();
