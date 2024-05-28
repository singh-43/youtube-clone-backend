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

    if (!isValidObjectId(tweetId)) {
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

} )

const updateTweet = asyncHandler ( async (req, res) => {
    const { content } = req.body;
    const { tweetId } = req.params;

    if (!content || content?.trim() === "") {
        throw new ApiError(404, "Content is required")

    }

    if (!isValidObjectId(tweetId)) {
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