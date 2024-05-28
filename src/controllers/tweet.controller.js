import mongoose, { isValidObjectId } from "mongoose";
import { ApiError } from "../utils/ApiError.js";
import { User } from './../models/user.model.js';
import { Tweet } from './../models/tweet.model.js';
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const createTweet = asyncHandler ( async (req, res) => {
    const { content } = req.body;

    if (!content) {
        throw new ApiError(404, "Content is required")
    }

    const user = await User.findById(
        req.user._id,
        //just return id
        {
            _id: 1,
        }
    );
    
    if (!user) {
        throw new ApiError(404, "User not found")
    }

    const tweet = await Tweet.create({
        content,
        owner: user?._id,
    })

    return res.status(200)
        .json(new ApiResponse(200, tweet, "Tweet successfully posted"))

} )

const deleteTweet = asyncHandler ( async (req, res) => {
    const { tweetId } = req.params;

    if (!isValidObjectId(tweetId) || !tweetId) {
        throw new ApiError(404, "Invalid tweet id");
    }

    const user = await User.findById(req.user?._id, {
            _id: 1
        }
    )

    if (!user) {
        throw new ApiError(404, "User not found")
    }

    // const deletedTweet = await Tweet.findByIdAndDelete(tweetId);

    // if (!deletedTweet) {
    //     throw new ApiError(404, "Tweet not found")
    // }

    const deletedTweet = await Tweet.deleteOne({
        _id: tweetId
    })

    if (deletedTweet?.deletedCount === 0) {
        throw new ApiError(404, "Tweet not found")
    }

    return res.status(200)
        .json(new ApiResponse(200, {}, "Tweet deleted successfully"))
} )

const getUserTweets = asyncHandler ( async (req, res) => {
    const { userId } = req.params;

    const { page = 1, limit = 10 } = req.query;

    if (!isValidObjectId(userId) || !userId) {
        throw new ApiError(404, "Invalid user id")
    }

    const user = await User.findById(req.user?._id, {
            _id: 1
        }
    )

    if (!user) {
        throw new ApiError(404, "User not found")
    }

    /* Method: 1 */

    // const tweetAggregate = Tweet.aggregate([
    //     {
    //         $match: {
    //             owner : new mongoose.Types.ObjectId(user?._id)
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
    //                         fullName: 1,
    //                         _id: 1
    //                     }    
    //                 }
    //             ]
    //         }
    //     },
    //     {
    //         $addFields: {
    //             owner: {
    //                 $first: "$owner"
    //             }
    //         }
    //     },
    //     {
    //         $sort: {
    //             createdAt: -1
    //         } 
    //     }
    // ])

    // const options = {
    //     page: parseInt(page),
    //     limit: parseInt(limit),
    //     customLabels: {
    //         totalDocs: "totalTweets",
    //         docs: "tweets"
    //     },
    //     $skip: (page - 1) * limit
        
    // }
    // Tweet.aggregatePaginate(
    //     tweetAggregate,
    //     options
    // )
    // .then(
    //     result => {
    //         if (result.length === 0) {
    //             return res.status(200)
    //                         .json(new ApiResponse(
    //                             200,
    //                             [],
    //                             "No tweets found"
    //                         ))
    //         }
    //         return res.status(200)
    //             .json(new ApiResponse(
    //                 200,    
    //                 result,
    //                 "Tweets fetched successfully"
    //             )
    //         )
    //     }

    // )
    // .catch(error => {
    //     console.error("Error in aggregation:", error);
    //     throw new ApiError(500, error?.message || "Internal server error in tweet aggregation");
    // })

    /*METHOD 2 */

    // const userTweets = await Tweet.find({ owner: userId }, {content: 1});

    // const userTweets = await Tweet.find({ owner: userId })
    //     .populate('owner', 'username'); 

    // return res.status(200)
    //     .json(new ApiResponse(200, userTweets, "All owner tweets fetched successfully"))

    /*METHOD 3 */

    const tweetAggregate = await User.aggregate([
        {
            $match: {
                _id:  new mongoose.Types.ObjectId(userId)
            }
        },
        {
            $lookup: {
                from: "tweets",
                localField: "_id",
                foreignField: "owner",
                as: "ownerTweets",
                pipeline: [
                    {
                        $project: {
                            content: 1,
                            _id: 0,
                            createdAt: 1,
                            updatedAt: 1,
                        }
                    }
                ]
            }
        },
        {
            $project: {
                ownerTweets: 1,
                _id: 0
            }
        },
    ])    

    if (!tweetAggregate[0]?.ownerTweets?.length) {
        return res.status(201).json(new ApiResponse(201, {}, "User has not send any tweets yet"))
    }

    return res.status(200)
        .json(new ApiResponse(200, tweetAggregate[0], "Successfully fetched all user tweets"))

} )

const updateTweet = asyncHandler ( async (req, res) => {
    const { content } = req.body;
    const { tweetId } = req.params;

    if (!content || content?.trim() === "") {
        throw new ApiError(404, "Content is required")

    }

    if (!isValidObjectId(tweetId) || !tweetId) {
        throw new ApiError(404, "Invalid tweet id")
    }

    // const user = await User.findById(req.user?._id, {
    //         _id: 1
    //     }
    // )

    // if (!user) {
    //     throw new ApiError(404, "User not found")
    // }

    const updatedTweet = await Tweet.findByIdAndUpdate(
        tweetId,
        {
            $set: {
                content,
            }
        },
        {
            new: true,
        }
    )

    if (!updatedTweet) {
        throw new ApiError(404, "Tweet not found")
    }

    return res.status(200)
        .json(new ApiResponse(200, updatedTweet, "Tweet updated successfully"))
} )

export {
    createTweet,
    deleteTweet,
    getUserTweets,
    updateTweet,
}