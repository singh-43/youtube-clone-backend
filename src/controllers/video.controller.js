import fs from 'fs';
import mongoose, { isValidObjectId } from "mongoose";
import { User } from './../models/user.model.js';
import { ApiError } from "../utils/ApiError.js";
import { Video } from './../models/video.model.js';
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js"
import { deleteOnCloudinary, uploadOnCloudinary } from "../utils/cloudinary.js";

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

    
    let thumbnailLocalPath, videoLocalPath, thumbnail, video;
    
    try {

        if (
            (!title || !description) || [title, description].some((field) => field?.trim() === "")
        ) {
            throw new ApiError(404, "All fields are required")
        }

        if (req.files && Array.isArray(req.files.thumbnail) && req.files.thumbnail.length > 0) {
            thumbnailLocalPath = req.files.thumbnail[0].path;
        }
    
        if (req.files && Array.isArray(req.files.videoFile) && req.files.videoFile.length > 0) {
            videoLocalPath = req.files.videoFile[0].path;
        }
    
        if (!(thumbnailLocalPath && videoLocalPath )) {
            if (thumbnailLocalPath) fs.unlinkSync(thumbnailLocalPath);
            if (videoLocalPath) fs.unlinkSync(videoLocalPath);
            throw new ApiError(404, "Video thumbnail and video file both are required")
        }
    
        thumbnail = await uploadOnCloudinary(thumbnailLocalPath);
        video = await uploadOnCloudinary(videoLocalPath);
    
        if (!(thumbnail || video)) {
            fs.unlinkSync(thumbnailLocalPath);
            fs.unlinkSync(videoLocalPath);
            throw new ApiError(500, "Their was an error in uploading video. Try again.")
        }
    
        const videoUploaded = await Video.create({
            title,
            description,
            duration: video.duration,
            owner: req.user._id,
            thumbnail: {
                publicId: thumbnail.public_id,
                url: thumbnail.url,
                resourceType: thumbnail.resource_type,
            },
            videoFile: {
                publicId: video.public_id,
                url: video.url,
                resourceType: video.resource_type,
            },
        })
    
        if (!videoUploaded) {
            throw new ApiError(500, "Their was an error in uploading video. Try again.")
        }
    
        return res.status(200)
            .json(new ApiResponse(200, videoUploaded, "Video published successfully"))
            
    } catch (error) {
        if (thumbnailLocalPath) fs.unlinkSync(thumbnailLocalPath)
        if (videoLocalPath) fs.unlinkSync(videoLocalPath)
        if (thumbnail || video) {
            try {
                await Promise.all([
                    deleteOnCloudinary(thumbnail.publicId, thumbnail.resourceType),
                    deleteOnCloudinary(video.publicId, video.resourceType)
                ])
            } catch (error) {
                throw new ApiError(500, "Error while deleting file on cloudinary")
            }
        }
        throw new ApiError(500, error || "Server error")
    }

} )

const getVideoById = asyncHandler ( async (req, res) => {
    const { videoId } = req.params;

    if (!isValidObjectId(videoId)) {
        throw new ApiError(404, "Invalid video id")
    }

    /* METHOD 1 */
    let videoData = await Video.findById(videoId)

    if (!videoData) {
        throw new ApiError(404, "Video not found")
    }

    let video = {
        ...videoData?._doc,
        videoFile: videoData?._doc.videoFile.url,
        thumbnail: videoData?._doc.thumbnail.url,
    }


    const user = await User.findById(req.user?._id, {
        watchHistory: 1
    })

    if (!user) {
        throw new ApiError(404, "User not found")
    }

    // increment video views if watched for the first time

    if (!user.watchHistory.includes(videoId)) {
        video = await Video.findByIdAndUpdate(
            videoId,
            {
                $inc: {
                    views: 1
                },
            },
            {
                new: true
            }
        )

        // add video to user's watchHistory
    
        await User.findByIdAndUpdate(
            req.user?._id,
            {
                $addToSet: {
                    watchHistory: videoId
                }
            },
            {
                new: true
            },
        )
    }

    return res.status(200)
        .json(new ApiResponse(200, video, "Video fetched successfully"))
} )

const updateVideo = asyncHandler ( async (req, res) => {
    const { videoId } = req.params;

    let thumbnailLocalPath, videoLocalPath, thumbnail, videoFile;
    
    if (req.files && Array.isArray(req.files.thumbnail) && req.files.thumbnail.length > 0) {
        thumbnailLocalPath = req.files.thumbnail[0].path;
    }

    if (req.files && Array.isArray(req.files.videoFile) && req.files.videoFile.length > 0) {
        videoLocalPath = req.files.videoFile[0].path;
    }

    try {
        if (!isValidObjectId(videoId)) {
            throw new ApiError(404, "Invalid video id")
        }
    
        const { title, description } = req.body;
    
        if ( title?.trim().length === 0 || description?.trim().length === 0 ) {
            throw new ApiError(404, "Video title and description cannot be empty")
        }
    
        if (thumbnailLocalPath) {
            const res = await uploadOnCloudinary(thumbnailLocalPath);
            thumbnail = {
                url: res?.url,
                publicId: res?.public_id,
                resourceType: res?.resource_type
            }
        }

        if (videoLocalPath) {
            const res = await uploadOnCloudinary(videoLocalPath);
            videoFile = {
                url: res?.url,
                publicId: res?.public_id,
                resourceType: res?.resource_type
            }
        }
    
        const updatedVideo = await Video.findByIdAndUpdate(
            videoId,
            {
                $set: {
                    description,
                    title,
                    thumbnail,
                    videoFile,
                }
            }
        ).select("title description videoFile thumbnail -_id")
    
        if (!updatedVideo) {
            throw new ApiError(400, "Video not found")
        }

        if (thumbnailLocalPath) {
            await Promise.all([
                deleteOnCloudinary(updatedVideo?.thumbnail?.publicId, updatedVideo?.thumbnail?.resourceType),
            ])
            updatedVideo.thumbnail = thumbnail;
        }

        if (videoLocalPath) {
            await Promise.all([
                deleteOnCloudinary(updatedVideo?.videoFile?.publicId, updatedVideo?.videoFile?.resourceType)
            ])
            updatedVideo.videoFile = videoFile;
        }

        updatedVideo.title = title || updatedVideo.title;
        updatedVideo.description = description || updatedVideo.title;
    
        return res.status(200)
            .json(new ApiResponse(200, updatedVideo, "Video updated successfully"))

    } catch (error) {
        
        if(thumbnailLocalPath && error.message === "Video title and description cannot be empty") fs.unlinkSync(thumbnailLocalPath)
        if(videoFile && error.message === "Video title and description cannot be empty") fs.unlinkSync(videoFile)

        try {
            if (thumbnail) {
                await deleteOnCloudinary(thumbnail?.publicId, thumbnail?.resourceType)
            }
            if (videoFile) {
                await deleteOnCloudinary(videoFile?.publicId, videoFile?.resourceType)
            }
        } catch (error) {
            throw new ApiError(error.statusCode || 500, error || "Error while deleting files on cloudinary")
        }
        throw new ApiError(error.statusCode || 500, error || "Server error")
    }
    
} )

const deleteVideo = asyncHandler ( async (req, res) => {
    const { videoId } = req.params;

    if (!isValidObjectId(videoId)) {
        throw new ApiError(404, "Video id is invalid")
    }

    try {
        const deletedVideo = await Video.findByIdAndDelete(videoId, {
            thumbnail: 1,
            videoFile: 1,   
        })
    
        if (!deletedVideo) {
            throw new ApiError(400, "Video not found")
        }
    
        await Promise.all([
            deleteOnCloudinary(deletedVideo.videoFile.publicId, deletedVideo.videoFile.resourceType),
            deleteOnCloudinary(deletedVideo.thumbnail.publicId, deletedVideo.thumbnail.resourceType)
        ])
    
        // Remove video from related collections (optimized updates)
        // const updatePromises = [
        //   User.updateMany({ watchHistory: videoId }, { $pull: { watchHistory: videoId } }),
        //   Comment.deleteMany({ video: videoId }),
        //   Playlist.updateMany({ videos: videoId }, { $pull: { videos: videoId } }),
        //   Like.deleteMany({ video: videoId })
        // ];
    
        // await Promise.all(updatePromises);
    
        return res.status(200)
            .json(new ApiResponse(200, {}, "Video has been successfully deleted"))
    } catch (error) {
        throw new ApiError(error.statusCode || 500, error || "Server error")
    }
} )

const getUserVideos = asyncHandler ( async (req, res) => {

    const { userId } = req.params;

    if (!isValidObjectId(userId)) {
        throw new ApiError(404, "Invalid user id")
    }

    const user = await User.findById(mongoose.Types.ObjectId.createFromHexString(userId));

    if (!user) {
        throw new ApiError(404, "User does not exist")
    }

    /* METHOD 1 */
    // const userData = await Video.find({owner: userId})
    const userData = await Video.find({owner: userId})
    .populate('owner', 'username email');

    if (!userData) throw new ApiError(404, "Error while fetching videos")

    let userVideos = [];
    userData.forEach(element => {
        element = element?._doc;
        let obj  = {
            ...element,
            videoFile: element?.videoFile.url,
            thumbnail: element?.thumbnail.url,
            // if using 2nd find method i.e. using find with populate
            // owner: element.owner.username,
        }   
        userVideos.push(obj)
    });

    /* METHOD 2 */

    // const userVideos = await Video.aggregate([
    //     {
    //         $match: {
    //             owner: mongoose.Types.ObjectId.createFromHexString(userId)
    //         }
    //     }
    // ])

    // const userVideos = await Video.aggregate([
    //     {
    //         $match: {
    //             owner: mongoose.Types.ObjectId.createFromHexString(userId)
    //         }
    //     },
    //     {
    //         $project: {
    //             title: 1,
    //             description: 1,
    //             duration: 1,
    //             views: 1,
    //             isPublished: 1,
    //             owner: 1,
    //             videoFile: "$videoFile.url",
    //             thumbnail: "$thumbnail.url",
    //             createdAt: 1,
    //             updatedAt: 1,
    //         }
    //     },
    //     // below code is to populate owner data
    //     {
    //         $lookup: {
    //             from: "users",
    //             localField: "owner",
    //             foreignField: "_id",
    //             as: "owner",
    //             pipeline: [
    //                 {
    //                     $project: {
    //                         username: 1,
    //                         email: 1,
    //                     }
    //                 }
    //             ]
    //         }
    //     }
    // ])
    
    /* METHOD 3 */

    // const userVideos = await User.aggregate([
    //     {
    //         $match: {
    //             // _id: new mongoose.Types.ObjectId(userId)
    //             //above constructor method is deprecated
    //             _id: mongoose.Types.ObjectId.createFromHexString(userId)
    //         }
    //     },
    //     {
    //         $lookup: {
    //             from: "videos",
    //             localField: "_id",
    //             foreignField: "owner",
    //             as: "videosData",
    //             pipeline: [
    //                 {
    //                     $project: {
    //                         title: 1,
    //                         description: 1,
    //                         duration: 1,
    //                         views: 1,
    //                         isPublished: 1,
    //                         owner: 1,
    //                         videoFile: "$videoFile.url",
    //                         thumbnail: "$thumbnail.url",
    //                         createdAt: 1,
    //                         updatedAt: 1,
    //                     }
    //                 },
    //                 // below logic is to populate owner data
    //                 {
    //                     $lookup: {
    //                         from: "users",
    //                         localField: "owner",
    //                         foreignField: "_id",
    //                         as: "owner",
    //                         pipeline: [
    //                             {
    //                                 $project: {
    //                                     username: 1,
    //                                     email: 1
    //                                 }
    //                             },
    //                         ]
    //                     }
    //                 },
    //             ]
    //         }
    //     },
    // ])

    return res.status(200)
        .json(new ApiResponse(200, userVideos, "All videos fetched"))

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
    getUserVideos,
}
