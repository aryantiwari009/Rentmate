import jwt from "jsonwebtoken";
import { User } from "../models/User.js";

export async function requireAuth( req, res, next){
    try{
        const token = req.cookies.token;
        if(!token){
            return res.status(401).json({ message: "Not logged in" })
        }

        const payload = jwt.verify(token, process.env.JWT_SECRET);

        const user = await User.findById(payload.userId);
        if(!user){
            return res.status(401).json({ message: "User not found" })
        }

        req.user = user;
        next();
    }catch(err){
        console.error(err.message)
        return res.status(401).json({ message: "Not loggedIn" })
    }
}