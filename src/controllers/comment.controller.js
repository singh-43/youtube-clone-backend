import mongoose, { isValidObjectId } from "mongoose"
import {ApiError} from "../utils/ApiError.js"
import { Video } from './../models/video.model.js';
import {Comment} from "../models/comment.model.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"

const getVideoComments = asyncHandler(async (req, res) => {
    
    const {videoId} = req.params
    let { page, limit } = req.query;

    page = (isNaN(page) || page <= 0) ? 1 : Number(page);
    limit = (isNaN(limit) || limit <= 0) ? 1 : Number(limit);

    if (!isValidObjectId(videoId)) {
        throw new ApiError(404, "Enter a valid video id")
    }

    /* METHOD 1 */

    const allComments = await Comment.find({video: mongoose.Types.ObjectId.createFromHexString(videoId)})
    .populate("owner", "username email")
    .skip((page - 1) * limit)
    .limit(limit)
    //to use populate use await but that conflicts with mongoose pagination

    const totalComments = await Comment.find({video: mongoose.Types.ObjectId.createFromHexString(videoId)});

    const totalPages = totalComments?.length > limit ? Math.ceil(totalComments?.length / limit) : 1 ;
    const hasNextPage = page < totalPages;
    const hasPrevPage = (page !== 1) && (page <= totalPages);
    const prevPage = hasPrevPage ? page - 1: null;
    const nextPage = hasNextPage ? page + 1 : null;


    return res.status(200)
        .json(new ApiResponse(200, {
            allComments,
            totalComments: totalComments?.length,
            limit,
            page,
            totalPages,
            hasNextPage,
            hasPrevPage,
            prevPage,
            nextPage,

        }, "All comments fetched"))

    /* METHOD 2 */

    // const allComments = Comment.aggregate([
    //     {
    //         $match: {
    //             video: mongoose.Types.ObjectId.createFromHexString(videoId)
    //         }
    //     },
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
    //                         avatar: "$avatar.url",
    //                     }
    //                 }
    //             ]
    //         }
    //     },
    //     {
    //         $addFields: {
    //             owner: {
    //                 $arrayElemAt: [ "$owner", 0]
    //             }
    //         }
    //     }
    // ])

    // const options = {
    //     page,
    //     limit,
    //     customLabels: {
    //         docs: "comments",
    //         totalDocs: "totalComments",

    //     },
    //     skip: (page - 1) * limit,
    // }

    // Comment.aggregatePaginate(allComments, options)
    // .then((comments) => {
    //     return res.status(200)
    //         .json(new ApiResponse(200, comments, "All comments fetched successfully"))
    // })
    // .catch((error) => {
    //     throw new ApiError(500, "Error while comments pagination")
    // })
})

const addComment = asyncHandler(async (req, res) => {
    const { content } = req.body;
    const { videoId } = req.params;

    if (!content || content.trim() === "") {
        throw new ApiError(404, "Comment cannot be empty")
    }

    if (!videoId || !isValidObjectId(videoId)) {
        throw new ApiError(404, "Please enter valid video id")
    }

    const videoFound = await Video.findById(videoId);

    if (!videoFound) {
        throw new ApiError(404, "Video not found")
    }

    const addedComment = await Comment.create({
        content,
        video: videoId,
        owner: req?.user?.id,
    })

    if (!addedComment) {
        throw new ApiError(500,"There was an error creating comment. Try again")
    }

    return res.status(200)
        .json(new ApiResponse(200, addedComment, "Comment added successfully"))

})

const updateComment = asyncHandler(async (req, res) => {
    const { content } = req.body;
    const { commentId } = req.params;

    if (!content || content.trim() === "") {
        throw new ApiError(404, "Comment cannot be empty")
    }

    if (!isValidObjectId(commentId)) {
        throw new ApiError(404, "Enter a valid commentId")
    }

    const updatedComment = await Comment.findByIdAndUpdate(
        commentId,
        {
            content
        },
        {
            new: true
        }
    )

    if (!updatedComment) {
        throw new ApiError(500, "Error while updating comment. Try again")
    }

    return res.status(200)
        .json(new ApiResponse(200, updatedComment, "Comment updated successfully"))
})

const deleteComment = asyncHandler(async (req, res) => {
    const { commentId } = req.params;

    if (!isValidObjectId(commentId)) {
        throw new ApiError(404, "Enter a valid commentId")
    }

    const deletedComment = await Comment.findByIdAndDelete(commentId);

    if (!deletedComment) {
        throw new ApiError(404, "Error while deleting comment. Try again")
    }

    return res.status(200)
        .json(new ApiResponse(200, deletedComment, "Comment deleted successfully"))
})

export {
    getVideoComments, 
    addComment, 
    updateComment,
    deleteComment
}