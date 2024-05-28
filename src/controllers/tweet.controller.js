import mongoose from "mongoose";
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
            id: 1,
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

} )

const getUserTweets = asyncHandler ( async (req, res) => {

} )

const updateTweet = asyncHandler ( async (req, res) => {

} )

export {
    createTweet,
    deleteTweet,
    getUserTweets,
    updateTweet,
}