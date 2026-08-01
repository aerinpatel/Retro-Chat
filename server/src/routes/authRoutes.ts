import { z } from "zod";
import { Request, Response, Router, NextFunction } from "express";
import bcrypt from "bcrypt";
import jwt, { JwtPayload } from "jsonwebtoken";
import { configDotenv } from "dotenv";
import { error } from "node:console";
configDotenv();

declare global{
    namespace Express{
        interface Request {
            userInfo?: string|JwtPayload; // Replace 'any' with your specific user data type/interface if available
            refreshToken?: string;
        }
    }
}


const signupSchema = z.object({
    name: z.string().min(2, "Name must be at least 2 characters"),
    email: z.string().email("Invalid email"),
    password: z.string().min(6, "Password must be at least 6 characters")
});

const signinSchema = z.object({
    email: z.string().email("Invalid email"),
    password: z.string().min(1, "Password is required")
});
const router: Router = Router();

// Secrets from .env (provide fallback for testing)
const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET || "access_secret_123";
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET || "refresh_secret_456";

// Temporary In-Memory storage (until you plug in a real Database like Prisma/Mongoose)
// 1. users list
let users: Array<{ id: string; email: string; passwordHash: string }> = [];
// 2. active refresh tokens list
let refreshTokens: string[] = [];

// TODO 1: Generate Access Token (Short-lived: e.g. "15m")
function generateAccessToken(payload: { id: string; email: string }): string {
  // HINT: Use jwt.sign(payload, SECRET, { expiresIn: '15m' })
  // Write your code here:
  return jwt.sign(payload,ACCESS_TOKEN_SECRET,{expiresIn:"15m"});
}

// TODO 2: Generate Refresh Token (Long-lived: e.g. "7d")
function generateRefreshToken(payload: { id: string; email: string }): string {
  // HINT: Use jwt.sign(payload, SECRET, { expiresIn: '7d' })
  // Write your code here:
  return jwt.sign(payload,REFRESH_TOKEN_SECRET,{expiresIn:"7d"})
}

// =================================================================
// STEP 2: AUTH MIDDLEWARE (Protects private routes)
// =================================================================

export function authenticateToken(req: Request, res: Response, next: NextFunction) {
  // TODO 3: Extract the Bearer token from req.headers['authorization']
  // HINT: header format is "Bearer <TOKEN>". Split by space to get index 1.
  const token:string = req.headers['authorization']?.split(" ")[1] || "";

  // TODO 4: If no token found, return res.status(401).json({ message: "Token missing" })
    if(token == "") return res.status(401).json({message:"token missing"});
  // TODO 5: Verify the token with jwt.verify(token, ACCESS_TOKEN_SECRET)
  // If error -> return res.status(403).json({ message: "Invalid or expired token" })
  // If valid -> attach user to req and call next()
  try{
      const data = jwt.verify(token,ACCESS_TOKEN_SECRET);
        req.userInfo = data;
        next();
  }catch(err){
    res.status(403).json({message:"Invalid or expired token"});
  }
    

}

// =================================================================
// STEP 3: SIGNUP ROUTE
// =================================================================

router.post("/signup", async (req: Request, res: Response) => {
  // TODO 6: Validate req.body using userSignup.safeParse(req.body)
  // If !parsed.success -> return res.status(400).json({ error: parsed.error.issues })
  const parsed = signupSchema.safeParse(req.body);
    if(!parsed.success) return res.status(400).json({error:parsed.error.issues});
  // TODO 7: Check if user already exists in `users` array by email
  // If exists -> return res.status(400).json({ message: "User already exists" })
  if(users.find((u) => u.email === parsed.data.email)) return res.status(400).json({message:"user already exist"});
    const {name,email,password} = parsed.data;
  // TODO 8: Hash password with bcrypt.hash(password, 10)
  const hashedPassword:string = await bcrypt.hash(password,10);
  // TODO 9: Create new user object and push to `users` array
  users.push({id:Date.now().toString(),email,passwordHash:hashedPassword})
  return res.status(201).json({ message: "User registered successfully" })
});

// =================================================================
// STEP 4: SIGNIN ROUTE (Issues both tokens)
// =================================================================

router.post("/signin", async (req: Request, res: Response) => {
  // TODO 10: Validate req.body with userSignin.safeParse(req.body)
  const parsed = signinSchema.safeParse(req.body);
    if(!parsed.success) return res.status(400).json({error:parsed.error.issues});
  // TODO 11: Find user in `users` array by email
  // If not found -> return res.status(400).json({ message: "Invalid email or password" })
  const user =users.find((e) => e.email === parsed.data.email);
    if(!user) return res.status(400).json({message:"user must signup first"});

  // TODO 12: Compare password using await bcrypt.compare(password, user.passwordHash)
  // If wrong -> return res.status(400).json({ message: "Invalid email or password" })
    const vailidatePass = await bcrypt.compare(parsed.data.password,user.passwordHash);
    if(!vailidatePass){
        return res.status(400).json({ message: "Invalid email or password" });
    }
  // TODO 13: Generate accessToken and refreshToken using your helper functions
    const newRefreshToken = generateRefreshToken({id:user.id,email:parsed.data.email});
    const newAccessToken = generateAccessToken({id:user.id,email:parsed.data.email});
  // TODO 14: Save the refreshToken in `refreshTokens` array
    refreshTokens.push(newRefreshToken);
  // TODO 15: Return { accessToken, refreshToken } in response
    return res.status(200).json({accessToken:newAccessToken,refreshToken:newRefreshToken});

});

// =================================================================
// STEP 5: REFRESH TOKEN ROUTE (Exchange Refresh -> New Access)
// =================================================================

router.post("/refresh", (req: Request, res: Response) => {
  // TODO 16: Extract `refreshToken` from req.body
  // If missing -> return res.status(401).json({ message: "Refresh token required" })
    const {refreshToken } = req.body;
    if(!refreshToken ) return res.status(401).json({ message: "Refresh token required" })
  // TODO 17: Check if refreshToken exists in `refreshTokens` array
  // If not found -> return res.status(403).json({ message: "Refresh token is invalid or revoked" })
    // const valid = refreshTokens.find(refreshToken );
    if(!refreshTokens.includes(refreshToken )) return res.status(403).json({ message: "Refresh token is invalid or revoked" })
  // TODO 18: Verify refreshToken with jwt.verify(refreshToken, REFRESH_TOKEN_SECRET)
  // If error -> return res.status(403).json({ message: "Token expired or corrupted" })
  // If valid -> generate a NEW accessToken and send it back: res.json({ accessToken: newAccessToken })
  try{
    const decoded = jwt.verify(refreshToken ,REFRESH_TOKEN_SECRET) as {id:string;email:string};
    const newAccessToken = generateAccessToken({ id: decoded.id, email: decoded.email });
    res.json({ accessToken: newAccessToken })
  }catch(err){return res.status(403).json({ message: "Token expired or corrupted" })} 
    
});

// =================================================================
// STEP 6: LOGOUT ROUTE (Revokes Refresh Token)
// =================================================================

router.post("/logout", (req: Request, res: Response) => {
  // TODO 19: Extract `refreshToken` from req.body
  const {refreshToken} = req.body;
 if (!refreshToken) {
    return res.status(400).json({ message: "Refresh token required" });
  }
  // Filter the string directly and reassign:
//   refreshTokens = refreshTokens.filter((token) => token !== refreshToken);
  // TODO 20: Remove `refreshToken` from `refreshTokens` array (e.g. using .filter())
    refreshTokens.filter((e) => e !== refreshToken);

  // TODO 21: Return res.json({ message: "Logged out successfully" })
  res.json({ message: "Logged out successfully" })
});

// =================================================================
// STEP 7: PROTECTED ROUTE (Test the Access Token)
// =================================================================

router.get("/me", authenticateToken, (req: Request, res: Response) => {
  // TODO 22: Return the authenticated user info attached to req
  res.json({ message: "Access granted!", user: req.userInfo });
});

export default router;
