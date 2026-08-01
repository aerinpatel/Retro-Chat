import express from 'express';
import { z } from 'zod';
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import mongoose from 'mongoose';
import {User} from "../models/user.js"
import { RefreshToken } from '../models/refreshToken.js';


const router :express.Router = express.Router();

const signupSchema = z.object({
    name: z.string().min(2,"Name must be at least 2 characters"),
    email: z.string().email("invalid email"),
    password: z.string().min(6,"password must be at least 6 characters")
})

const signinSchema = z.object({
    email:z.string().email("invalid email"),
    password: z.string().min(1,"password required")
})



router.post("/signup",async (req:express.Request,res:express.Response)=>{
    try{
        const parsed = signupSchema.safeParse(req.body);
        if(!parsed.success) return res.json(400).json({error:parsed.error.issues});

        const existingUser = await User.findOne({email:parsed.data.email})
        if(existingUser) return res.json(400).json({message:"user already exist"});

        const hashedPassword = await bcrypt.hash(parsed.data.password,10);
        const user = new User({
            name:parsed.data.name,
            email:parsed.data.email,
            password:hashedPassword,
        });

        await user.save();
        return res.status(201).json({message:"User registered successfully"});

    }
    catch(err){
        console.error("error in signup:",err);
        return res.status(500).json({message:"Internal server error"})
    }
})

router.post("/signin",async (req:express.Request,res:express.Response)=>{
    try{
        const parsed = signinSchema.safeParse(req.body);
        if(!parsed.success) return res.json(400).json({error:parsed.error.issues});

        const user = await User.findOne({email:parsed.data.email});
        if(!user) return res.json(400).json({message:"user not found"});

        const valid = await bcrypt.compare(parsed.data.password,user.password);
        if(!valid) return res.json(400).json({message:"password invalid"});

        const accessToken = jwt.sign({id:user._id,email:user.email},process.env.ACCESS_TOKEN_SECRET!)
        const refreshToken = jwt.sign({id:user._id,email:user.email},process.env.REFRESH_TOKEN_SECRET!)

        const token = new RefreshToken({
            token:refreshToken,
            userId:user._id,
        });
        await token.save();
        return res.status(200).json({accessToken,refreshToken});
    }
    catch(err){
        console.error("error in signin:",err);
        return res.status(500).json({message:"Internal server error"})
    }
})

router.post("/refresh",async (req:express.Request,res:express.Response)=>{
    try{
        const refreshToken = req.body.refreshToken;
        if(!refreshToken) return res.status(401).json({message:'refresh token is required'});

        const token = await RefreshToken.findOne(refreshToken);
        if(!token) return res.status(403).json({message:"invalid token"})

        const payload = jwt.verify(refreshToken,process.env.REFRESH_TOKEN_SECRET!) as {id:string;email:string}

        const newAccessToken = jwt.sign({id:payload.id,email:payload.email},process.env.ACCESS_TOKEN_SECRET!,{expiresIn:"15m"})
        // const newRefreshToken = jwt.sign({id:payload.id,email:payload.email},process.env.REFRESH_TOKEN_SECRET!,{expiresIn:"7d"})

        // const newToken = new RefreshToken({
        //     token:refreshToken,
        //     userId:token.userId,
        // });
        // await newToken.save();
        return res.status(200).json({newAccessToken});
    }
    catch(err){
        console.error("error in refresh:",err);
        return res.status(500).json({message:"Internal server error"})
    }
})

router.post("/signout",async (req:express.Request,res:express.Response)=>{
    try{
        const refreshToken = req.body.refreshToken;
        if(!refreshToken) return res.status(401).json({message:'refresh token is required'});

        const token = await RefreshToken.findOne({token:refreshToken});
        if(!token) return res.status(403).json({message:"invalid token"})

        await RefreshToken.deleteOne({token:refreshToken});
        return res.status(200).json({message:"token deleted"});
    }
    catch(err){
        console.error("error in logout:",err);
        return res.status(500).json({message:"Internal server error"})
    }
})

// router.get("/me",async (req:express.Request,res:express.Response)=>{
//     try{
        
//     }   
//     catch(err){
//         console.error("error in logout:",err);
//         return res.status(500).json({message:"Internal server error"})
//     }
// })

export default router;