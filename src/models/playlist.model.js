import mongoose, { Schema, mongo } from "mongoose";

const playlistSchema = new Schema(
    {
        name: {
            type: String,
            required: true,
        },
        description: {
            type: String,
        },
        privacy: {
            type: String,
            enum: ["Unlisted", "Private", "Public"],
            default: "Private",
        },
        videos: [
            {
                type: Schema.Types.ObjectId,
                ref: "Video"
            }
        ],
        owner: {
            type: Schema.Types.ObjectId,
            ref: "User"
        },
    },
    {
        timestamps: true,
    }
)

export const Playlist = mongoose.model("Playlist", playlistSchema)