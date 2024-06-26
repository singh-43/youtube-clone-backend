import fs from 'fs';
import mongoose, { isValidObjectId } from "mongoose";
import { User } from './../models/user.model.js';
import { ApiError } from "../utils/ApiError.js";
import { Video } from './../models/video.model.js';
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js"
import { deleteOnCloudinary, uploadOnCloudinary } from "../utils/cloudinary.js";

const getAllVideos = asyncHandler ( async (req, res) => {

    let { page = 1,
        limit = 10,
        query = "",
        sortBy,
        sortType = "asc",
        userId 
    } = req.query;

    page = ( isNaN(page) || page <= 0 ) ? 1 : Number(page);
    limit = ( isNaN(limit) || limit <= 0 ) ? 1 : Number(limit);
    
    /* METHOD 1 */

    // let sortCriteria = {}, videoQuery = {};

    // if (query.trim() !== "") {
    //     videoQuery.$or = [
    //         { title: { $regex: query, $options: 'i' } },
    //         { description: { $regex: query, $options: 'i' } }
    //     ]
    // }
    
    // if (userId && isValidObjectId(userId)) {
    //     videoQuery.owner = mongoose.Types.ObjectId.createFromHexString(userId);
    // } else if(userId) {
    //     throw new ApiError(404, "Invalid user id")
    // }

    // if (sortBy) {
    //     sortCriteria[sortBy] = sortType === "asc" ? 1 : -1
    // }

    // const videoData = await Video.find(videoQuery)
    // .populate("owner", "username")
    // .sort(sortCriteria)
    // .skip((page - 1) * limit)
    // .limit(limit)

    // if (!videoData) {
    //     throw new ApiError(404, "Error while fetching videos");
    // }

    // const totalVideos = await Video.find(videoQuery);

    // let videos = []

    // videoData?.forEach((element) => {
    //     element = element?._doc;
    //     let obj = {
    //         ...element,
    //         videoFile: element?.videoFile.url,
    //         thumbnail: element?.thumbnail.url,
    //     };
    //     videos.push(obj);
    // })


    // const totalPages = totalVideos?.length > limit ? Math.ceil(totalVideos?.length / limit) : 1;
    // const hasNextPage = page < totalPages;
    // const hasPrevPage = page !== 1 && page <= totalPages;
    // const prevPage = hasPrevPage ? page - 1 : null;
    // const nextPage = hasNextPage ? page + 1 : null;

    // return res.status(200)
    //     .json(new ApiResponse(200, {
    //         videos,
    //         totalVideos: totalVideos?.length,
    //         limit,
    //         page,
    //         totalPages,
    //         hasPrevPage,
    //         hasNextPage,
    //         prevPage,
    //         nextPage,
    //     }, "All videos fetched successfully"))

    /* METHOD 2 */

    let videoQuery = {}

    if (query.trim() !== "") {
        videoQuery = {
            $or: [
                { title: { $regex: query, $options: "i" } },
                { description: { $regex: query, $options: "i" } }
            ]
        }
    }

    if (userId && isValidObjectId(userId)) {
        videoQuery.owner = mongoose.Types.ObjectId.createFromHexString(userId);
    }

    const videosData = Video.aggregate([
        {
            $match: videoQuery
        },
        {
            $lookup: {
                from: "users",
                localField: "owner",
                foreignField: "_id",
                as: "owner",
                pipeline: [
                    {
                        $project: {
                            username: 1,
                            email: 1
                        }
                    }
                ]
            }
        },
        {
            $addFields: {
                owner: {
                    $first: "$owner"
                }
            }
        },        
        {
            $project: {
                videoFile: "$videoFile.url",
                thumbnail: "$thumbnail.url",
                title: 1,
                description: 1,
                views: 1,
                owner: 1,
                isPublished: 1,
                createdAt: 1,
                updatedAt: 1,
                duration: 1,
            }
        },
        {
            $sort: {
                [sortBy || "createdAt"]: sortType === "asc" ? 1 : -1 || 1
            }
        }
    ])

    const options = {
        page: page,
        limit: limit,
        customLabels: {
            totalDocs: "totalVideos",
            docs: "videos",

        },
        skip: (page - 1) * limit,
        limit: limit,
    }

    Video.aggregatePaginate(videosData, options)
    .then((videos) => {
        return res.status(200)
            .json(new ApiResponse(200, videos, "All videos fetched successfully"))
    })
    .catch((error) => {
        throw new ApiError(error?.statusCode || 500, error?.message || "Server Error")
    })
    
} )

const publishAVideo = asyncHandler ( async (req, res) => {
    const { title, description } = req.body;
    
    let thumbnailLocalPath, videoLocalPath, thumbnail, video;
    
    if (req.files && Array.isArray(req.files.thumbnail) && req.files.thumbnail.length > 0) {
        thumbnailLocalPath = req.files.thumbnail[0].path;
    }

    if (req.files && Array.isArray(req.files.videoFile) && req.files.videoFile.length > 0) {
        videoLocalPath = req.files.videoFile[0].path;
    }
    
    try {

        if (
            (!title || !description) || [title, description].some((field) => field?.trim() === "")
        ) {
            throw new ApiError(404, "All fields are required")
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

        let uploadedVideoData = {
            ...videoUploaded._doc,
            videoFile: videoUploaded._doc?.videoFile.url,
            thumbnail: videoUploaded._doc?.thumbnail.url,
        }
    
        return res.status(200)
            .json(new ApiResponse(200, uploadedVideoData, "Video published successfully"))
            
    } catch (error) {
        if (thumbnailLocalPath && error.message === "All fields are required") fs.unlinkSync(thumbnailLocalPath)
        if (videoLocalPath && error.message === "All fields are required") fs.unlinkSync(videoLocalPath)
        try {
            if (thumbnail) {
                await Promise.all([
                    deleteOnCloudinary(thumbnail.publicId, thumbnail.resourceType)
                ])
            }
            if (video) {
                await Promise.all([
                    deleteOnCloudinary(video.publicId, video.resourceType)
                ])
            }
        } catch (error) {
            throw new ApiError(error.statusCode|| 500, error.message || "Error while deleting file on cloudinary")
        }
        throw new ApiError(error.statusCode || 500, error.message || "Server error")
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

    let thumbnailLocalPath, videoLocalPath, thumbnail, videoFile, duration;
    
    if (req.files && Array.isArray(req.files.thumbnail) && req.files.thumbnail.length > 0) {
        thumbnailLocalPath = req.files.thumbnail[0].path;
    }

    if (req.files && Array.isArray(req.files.videoFile) && req.files.videoFile.length > 0) {
        videoLocalPath = req.files.videoFile[0].path;
    }

    const { title, description } = req.body;

    try {
        if (!isValidObjectId(videoId)) {
            throw new ApiError(404, "Invalid video id")
        }
    
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
            duration = res?.duration;
        }
    
        const updatedVideo = await Video.findByIdAndUpdate(
            videoId,
            {
                $set: {
                    description,
                    title,
                    thumbnail,
                    videoFile,
                    duration,
                }
            }
        )
        // .select("title description videoFile thumbnail -_id")
    
        if (!updatedVideo) {
            throw new ApiError(400, "Error updating video. Try again")
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
        updatedVideo.description = description || updatedVideo.description;

        let updatedVideoData = {
            ...updatedVideo._doc,
            videoFile: updatedVideo._doc?.videoFile?.url,
            thumbnail: updatedVideo._doc?.thumbnail?.url,
        }
    
        return res.status(200)
            .json(new ApiResponse(200, updatedVideoData, "Video updated successfully"))

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
        throw new ApiError(error.statusCode || 500, error.message || "Server error")
    }
    
} )

const deleteVideo = asyncHandler ( async (req, res) => {
    const { videoId } = req.params;

    if (!isValidObjectId(videoId)) {
        throw new ApiError(404, "Video id is invalid")
    }

    const deletedVideo = await Video.findByIdAndDelete(videoId, {
        thumbnail: 1,
        videoFile: 1,   
    })

    if (!deletedVideo) {
        throw new ApiError(400, "Error deleting video. Try again")
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
} )

const togglePublishStatus = asyncHandler ( async (req, res) => {
    const { videoId } = req.params;

    const oldVideoData = await Video.findById(videoId)

    if (!oldVideoData) {
        throw new ApiError(404, "Video not found")
    }

    oldVideoData.isPublished = !oldVideoData?.isPublished
    await oldVideoData.save()
    
    let videoData = {
        ...oldVideoData._doc,
        videoFile: oldVideoData._doc.videoFile.url,
        thumbnail: oldVideoData._doc.thumbnail.url,
    }

    return res.status(200)
        .json(new ApiResponse(200, videoData, "Video status is changed successfully"))

} )

export {
    getAllVideos,
    publishAVideo,
    getVideoById,
    updateVideo,
    deleteVideo,
    togglePublishStatus,
}
