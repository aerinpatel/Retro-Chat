import { WebSocketServer, WebSocket } from "ws";
import { ChatRoom } from "../models/chats.js";
import jwt from "jsonwebtoken";
import url from "url";

interface AuthenticatedWebSocket extends WebSocket {
    id?: string;
    userId?: string;
    email?: string;
    roomId?: string; // tracks current active room
}

export default function initWebsocketServer(server: any) {
    const wss: WebSocketServer = new WebSocketServer({ server });

    function createRoomId() {
        return Math.random().toString(36).substring(2, 9);
    }

    wss.on('connection', (ws: AuthenticatedWebSocket, req) => {
        const location = url.parse(req.url || "", true);
        console.log(location);
        const token = location.query.token as string;
        if (!token) {
            ws.close(4001, "auth is required");
            return;
        }

        let payload: {
            id?: string;
            userId?: string;
            email: string;
        };

        try {
            payload = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET!) as {
                id?: string;
                userId?: string;
                email: string;
            };
            const currentId = payload.id || payload.userId || "";
            ws.id = currentId;
            ws.userId = currentId;
            ws.email = payload.email;
            console.log("user connected:", payload.email);
        } catch (err) {
            ws.close(4003, "invalid or expired token");
            return;
        }

        ws.on('message', async (data) => {
            try {
                const d = JSON.parse(data.toString());
                const currentUserId = ws.id || ws.userId || d.id || d.userId;

                if (d.type === "create_room") {
                    const roomId = createRoomId();
                    await ChatRoom.create({
                        roomId: roomId,
                        participants: [currentUserId],
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
                    console.log(currentUserId);

                    if (!room.participants.includes(currentUserId)) {
                        room.participants.push(currentUserId);
                        await room.save();
                    }

                    ws.send(JSON.stringify({ type: "roomJoined", roomId: roomId }));
                }

                if (d.type === 'chat') {
                    const roomId = d.roomId;
                    const room = await ChatRoom.findOne({ roomId: roomId });
                    if (!room) return ws.send(JSON.stringify({ type: "roomNotFound" }));
                    room.chats.push({
                        userId: currentUserId,
                        roomId: d.roomId,
                        message: d.message,
                    });
                    await room.save();
                    ws.send(JSON.stringify({ type: "chatAdded", chat: room.chats }));
                }

                if (d.type === "leave_room") {
                    const roomId = d.roomId;
                    const room = await ChatRoom.findOne({ roomId: roomId });
                    if (!room) return ws.send(JSON.stringify({ type: "roomNotFound" }));
                    room.participants = room.participants.filter((id: string) => id !== currentUserId);
                    await room.save();
                    ws.send(JSON.stringify({ type: "roomLeft", roomId: roomId }));
                }
            } catch (err) {
                console.error("WebSocket message error:", err);
                ws.send(JSON.stringify({ type: "error", message: "Invalid message format" }));
            }
        });
    });

    return wss;
}

