import { WebSocketServer } from "ws";
import { ChatRoom } from "../models/chats.js";

export default function initWebsocketServer(server:any){
    const wss: WebSocketServer = new WebSocketServer({server});
    
    function createRoomId() {
        return Math.random().toString(36).substring(2, 9);
    }

    wss.on('connection', (ws) => {
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

