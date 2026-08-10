import { WebSocketServer, WebSocket } from "ws";
import { ChatRoom } from "../models/chats.js";
import jwt from "jsonwebtoken";
import url from "url";

interface AuthenticatedWebSocket extends WebSocket {
    userId?: string;
    email?: string;
    roomId?: string; // tracks current active room
    isAlive?: boolean;
}

export default function initWebsocketServer(server:any){
    const wss: WebSocketServer = new WebSocketServer({server});
    
    function createRoomId() {
        return Math.random().toString(36).substring(2, 9);
    }

    const interval = setInterval(() => {
        wss.clients.forEach((client) => {
            const ws = client as AuthenticatedWebSocket;
            if (ws.isAlive === false) {
                console.log(`Terminating dead socket for user: ${ws.email || 'unknown'}`);
                return ws.terminate();
            }
            ws.isAlive = false;
            ws.ping();
        });
    }, 30000);

    wss.on('close', () => {
        clearInterval(interval);
    });

    wss.on('connection', (ws:AuthenticatedWebSocket,req) => {
        ws.isAlive = true;
        ws.on('pong', () => {
            ws.isAlive = true;
        });

        const location = url.parse(req.url||"",true);
        console.log(location);
        const token = location.query.token as string;
        if(!token){
            ws.close(4001,"auth is required");
            return;
        }

        let payload : {
            id: string;
            email: string;
            userId: string;
        }
        try{
            payload = jwt.verify(token,process.env.ACCESS_TOKEN_SECRET!) as {
                id:string;
                email:string;
                userId:string;
            };
            ws.userId=payload.userId;
            ws.email=payload.email;
            console.log("user connected:",payload.email);
        }
        catch(err){
            ws.close(4003,"invalid or expired token");
            return;
        }

        ws.on('message', async (data) => {
            try {
                const d = JSON.parse(data.toString());

                if (d.type === "create_room") {
                    const roomId = createRoomId();
                    await ChatRoom.create({
                        roomId: roomId,
                        participants: [d.userId],
                        chats: [],
                    });

                    ws.send(JSON.stringify({ type: "roomCreated", roomId: roomId }));
                }

                if (d.type === "join_room") {
                    const roomId = d.roomId;
                    const room = await ChatRoom.findOne({ roomId: roomId });
                    
                    if (!room) {
                        return ws.send(JSON.stringify({ type: "roomNotFound" }));
                    }

                    console.log(room.participants);
                    console.log(d.userId);

                    
                    if (!room.participants.includes(d.userId)) {
                        room.participants.push(d.userId);
                        await room.save();
                    }
                    
                    ws.send(JSON.stringify({ type: "roomJoined", roomId: roomId }));
                }

                if(d.type === 'chat'){
                    const roomId=d.roomId;
                    const room = await ChatRoom.findOne({roomId:roomId});
                    if(!room) return ws.send(JSON.stringify({type:"roomNotFound"}));
                    room.chats.push({
                        userId:d.userId,
                        roomId:d.roomId,
                        message:d.message,
                    });
                    await room.save();
                    ws.send(JSON.stringify({type:"chatAdded",chat:room.chats}));
                }

                if(d.type === "leave_room"){
                    const roomId = d.roomId;
                    const room = await ChatRoom.findOne({roomId:roomId});
                    if(!room) return ws.send(JSON.stringify({type:"roomNotFound"}));
                    room.participants = room.participants.filter((userId:string)=>userId!==d.userId);
                    // if(room.participants.length === 0){
                    //     await ChatRoom.deleteOne({roomId:roomId});
                    //     return ws.send(JSON.stringify({type:"roomDeleted",roomId:roomId}));
                    // }
                    await room.save();
                    ws.send(JSON.stringify({type:"roomLeft",roomId:roomId}));
                }
            } catch (err) {
                console.error("WebSocket message error:", err);
                ws.send(JSON.stringify({ type: "error", message: "Invalid message format" }));
            }
        });
    });

    return wss;
}

