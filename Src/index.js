const express = require("express") ;
const dotenv = require ("dotenv");
const connectDB = require("./Config/dbConnect");
const userRoute = require("./Routes/UserRoute")
const cors = require("cors");
const cookieParser = require("cookie-parser")

dotenv.config();

connectDB()
const app = express();
app.use(cors({
    origin: "http://localhost:5173", // Change this to your frontend URL
    credentials: true
}));
app.use(express.json());
app.use(cookieParser());

const PORT =  process.env.PORT || 5000

app.use("/",userRoute)

app.listen(PORT, () => {
    console.log(`Sever is listening on http://localhost:${PORT}`)
})




