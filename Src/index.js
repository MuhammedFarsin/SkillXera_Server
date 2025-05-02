const express = require("express");
const dotenv = require("dotenv");
const connectDB = require("./Config/dbConnect");
const userRoute = require("./Routes/UserRoute");
const adminRoute = require("./Routes/AdminRoute");
const saleRoute = require("./Routes/SaleRoute");
const { initSocket } = require("./socket"); // Make sure path is correct
const cors = require("cors");
const cookieParser = require("cookie-parser");
const path = require("path");
const http = require("http");

dotenv.config();
const app = express();
const server = http.createServer(app); // ✅ Create HTTP server for socket.io

connectDB();
initSocket(server); // ✅ Pass the server to socket.io, not the app

app.use(
  cors({
    origin: process.env.FRONTEND_URL,
    credentials: true,
  })
);
app.use(express.json({ limit: "500mb" }));
app.use(express.urlencoded({ extended: true, limit: "500mb" }));
app.use(cookieParser());

app.use("/uploads", express.static(path.join(__dirname, "../public/uploads")));
app.use("/videos", express.static(path.join(__dirname, "../public/videos/")));

app.use("/", userRoute);
app.use("/admin", adminRoute);
app.use("/sale", saleRoute);

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`Server is listening on http://localhost:${PORT}`);
});
