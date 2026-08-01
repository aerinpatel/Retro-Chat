import mongoose, { Document, Schema } from "mongoose";

export interface IChat {
    userId: string;
    roomId: string;
    message: string;
    timestamp?: Date;
}

export interface IChatRoom extends Document {
    roomId: string;
    participants: string[];
    createdAt: Date;
    chats: IChat[];
}

const chatSchema = new Schema<IChat>({
    userId: { type: String, required: true },
    roomId: { type: String, required: true },
    message: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
});

const chatRoomSchema = new Schema<IChatRoom>({
    roomId: { type: String, required: true, unique: true },
    participants: { type: [String], required: true },
    createdAt: { type: Date, default: Date.now },
    chats: { type: [chatSchema], default: [] },
});


export const ChatRoom = mongoose.model<IChatRoom>("ChatRoom", chatRoomSchema);
