import mongoose from "mongoose";
import { User } from './../models/user.model.js';
import { ApiError } from "../utils/ApiError.js";
import { Video } from './../models/video.model.js';
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js"

const getAllVideos = asyncHandler ( async (req, res) => {
    const { page = 1, limit = 10, query, sortBy, sortType, userId } = req.query;

    //TODO: get all videos based on query, sort, pagination

    const matchCondition = {
        $or: [
            { title: { $regex: query, $options: "i" } },
            { description: { $regex: query, $options: "i" } }
        ]
    };

    if (userId) {
        matchCondition.owner = new mongoose.Types.ObjectId(userId);
    }


    let videoAggregate;

    

    try {
        return res.status(200)
            .json(
                new ApiResponse(200, matchCondition, "Videos fetched successfully")
            )
    } catch (error) {
        console.log("Error in video aggregation", error);
        throw new ApiError(500, error?.message || "Internal server error in video aggregation")
    }

} )

const publishAVideo = asyncHandler ( async (req, res) => {
    const { title, description } = req.body;

    //TODO: get video, upload to cloudinary, create video
} )

const getVideoById = asyncHandler ( async (req, res) => {
    const { videoId } = req.params;

    //TODO: get video by id
} )

const updateVideo = asyncHandler ( async (req, res) => {
    const { videoId } = req.params;

    //TODO: update video details like title desc thumbnail
} )

const deleteVideo = asyncHandler ( async (req, res) => {
    const { videoId } = req.params;

    //TODO: delete video
} )

const togglePublishStatus = asyncHandler ( async (req, res) => {
    const { videoId } = req.params;

} )

export {
    getAllVideos,
    publishAVideo,
    getVideoById,
    updateVideo,
    deleteVideo,
    togglePublishStatus,
}
