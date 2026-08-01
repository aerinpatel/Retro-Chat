import mongoose, { Document, Schema } from "mongoose";
export interface IRefreshToken extends Document {
    token: string;
    userId: string;
}

const refreshTokens = new Schema<IRefreshToken>({
    token:{
        type: String,
        required: true,
    },
    userId:{
        type: String,
        required: true,
    },
})

export const RefreshToken = mongoose.model<IRefreshToken>("RefreshToken", refreshTokens);