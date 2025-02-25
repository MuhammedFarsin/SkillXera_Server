const express = require("express") ;
const dotenv = require ("dotenv");
const connectDB = require("./Config/dbConnect");
const userRoute = require("./Routes/UserRoute")
const adminRoute = require("./Routes/AdminRoute")
const saleRoute = require("./Routes/SaleRoute")

const cors = require("cors");
const cookieParser = require("cookie-parser")
const path = require('path');

dotenv.config();

connectDB()
const app = express();
app.use(cors({
    origin: "http://localhost:5173", 
    credentials: true
}));
app.use(express.json({ limit: "500mb" }));
app.use(express.urlencoded({ extended: true, limit: "500mb" }));
app.use(cookieParser());

app.use('/uploads', express.static(path.join(__dirname, '../public/uploads')));
app.use("/videos", express.static(path.join(__dirname, "../public/videos/")));



const PORT =  process.env.PORT || 5000

app.use("/",userRoute)
app.use("/admin",adminRoute)
app.use("/sale",saleRoute)

app.listen(PORT, () => {
    console.log(`Sever is listening on http://localhost:${PORT}`)
})




