import fs from 'fs';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { User } from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiRespnse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { deleteOnCloudinary, uploadOnCloudinary } from "../utils/cloudinary.js";

const options = {
    httpOnly: true,
    secure: true,
}

const generateAccessAndRefreshTokens = async (user) => {
    try {
        const accessToken = user.generateAccessToken();
        const refreshToken = user.generateRefreshToken();

        user.refreshToken = refreshToken;
        await user.save({ validateBeforeSave: false });

        return { accessToken, refreshToken, user }
    } catch (error) {
        throw new ApiError(500, "Something went wrong while generating access and refresh token")
    }
}

const registerUser = asyncHandler( async (req, res) => {

    const { fullName, email, password, username } = req.body;

    if (
        [fullName, email, username, password].some((field) => field?.trim() === "")
    ) {
        throw new ApiError(400, "All fields are required")
    }

    const avatarLocalPath = req.files?.avatar[0]?.path;
    let coverImageLocalPath;

    if (req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0) {
        coverImageLocalPath = req.files.coverImage[0].path;
    }

    const existingUser = await User.findOne({ 
        $or: [{ email }, { username }]
    })
    

    if (existingUser) {

        fs.unlinkSync(avatarLocalPath)
        fs.unlinkSync(coverImageLocalPath)
        
        throw new ApiError(409, "User with this email or username already exists")
    }

    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar file is required")
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath);
    const coverImage = await uploadOnCloudinary(coverImageLocalPath);

    if (!avatar) {
        throw new ApiError(400, "Avatar file is required")
    }

    const user = await User.create({
        fullName,
        avatar: {
            url: avatar?.url,
            publicId: avatar?.public_id,
            resourceType: avatar?.resource_type,
        },
        coverImage: {
            url: coverImage?.url || "",
            publicId: coverImage?.public_id || "",
            resourceType: coverImage?.resource_type,
        },
        email,
        password,
        username: username.toLowerCase(),
    })

    const { password: _password, refreshToken, ...rest } = user._doc;

    if (!rest) {
        await deleteOnCloudinary(avatar?.url, avatar?.public_id, avatar?.resourceType)
        await deleteOnCloudinary(coverImage?.url, coverImage?.public_id, coverImage?.resourceType)
        throw new ApiError(500, "Something went wrong while registering the user")
    }

    return res.status(201).json(
        new ApiResponse(200, rest, "User registered successfully")
    )
} )

const loginUser = asyncHandler( async (req, res) => {
    const { email, username, password } = req.body;

    if (!username && !email) {
        throw new ApiError(400, "Username or password is required")
    }

    const user = await User.findOne({ 
        $or: [
            {email},
            {username}
        ]
    })

    if (!user) {
        throw new ApiError(404, "User doesnot exists")
    }

    const isPasswordValid = await user.isPasswordCorrect(password)

    if (!isPasswordValid) {
        throw new ApiError(401, "Invalid user credentials")
    }

    const { accessToken, refreshToken, user: loggedInUser } = await generateAccessAndRefreshTokens(user);

    const { password: _password, refreshToken: _refreshToken, ...rest } = loggedInUser._doc;

    return res.status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", refreshToken, options)
        .json(
            new ApiResponse(200, {
                    user: rest, accessToken, refreshToken
                },
                "User logged in successfully"
            )
        )
} )

const logoutUser = asyncHandler( async (req, res) => {
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $unset: {
                refreshToken: 1,
            }
        },
        {
            new: true
        }
    )

    return res
        .status(200)
        .clearCookie("accessToken", options)
        .clearCookie("refreshToken", options)
        .json(new ApiResponse(200, {}, "User logged out"))
} )

const refreshAccessToken = asyncHandler ( async (req, res) => {
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken;

    if (!incomingRefreshToken) {
        throw new ApiError(401, "Unauthorized request")
    }

    try {
    
        const decodedToken = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET)
    
        const user = await User.findById(decodedToken?._id);
    
        if (!user) {
            throw new ApiError(401, "Invalid refresh token")
        }
    
        if ( incomingRefreshToken !== user?.refreshToken ) {
            throw new ApiError(401, "Refresh token is expired or used")
        }
    
        const { accessToken, refreshToken: newRefreshToken } = await generateAccessAndRefreshTokens(user);
    
        return res
            .status(200)
            .cookie("accessToken", accessToken, options)
            .cookie("refreshToken", newRefreshToken, options)
            .json(
                new ApiResponse(
                    200,
                    {
                        accessToken, refreshToken: newRefreshToken
                    },
                    "Access token refreshed"
                )
            )
    } catch (error) {
        throw new ApiError(401, error?.message || "Invalid refresh token")
    }
} )

const changeCurrentPassword = asyncHandler ( async (req, res) => {
    const { oldPassword, newPassword } = req.body;

    const user = await User.findById(req.user?._id);

    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);

    if (!isPasswordCorrect) {
        throw new ApiError(400, "Invalid password");
    }

    user.password = newPassword;

    await user.save({ validateBeforeSave: false });
    return res
        .status(200)
        .json(new ApiResponse(200, {}, "Password changed successfully"))
} )

const getCurrentUser = asyncHandler ( async (req, res) => {
    return res
        .status(200)
        .json(new ApiResponse(200, req.user, "current user fetched successfully"))
} )

const updateAccountDetails = asyncHandler ( async (req, res) => {
    const { fullName, email } = req.body;

    if (!fullName || !email) {
        throw new ApiError(400, "All fields are required")
    } 

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                fullName, email: email
            }
        },
        {
            new: true
        }
    ).select("-password -refreshToken");

    return res
        .status(200)
        .json(new ApiResponse(
            200,
            user,
            "Account details updated successfully"
        ))
} )

const updateUserCoverImage = asyncHandler ( async (req, res) => {

    const { url, publicId, resourceType } = req?.user.coverImage;

    if (!(url || publicId || resourceType)) {
        throw new ApiError(404, "Something went wrong while updating user cover image")
    }

    const coverImageLocalPath = req?.file.path;
    if (!coverImageLocalPath) {
        throw new ApiError(400, "Cover image file is required")
    }

    const coverImage = await uploadOnCloudinary(coverImageLocalPath);

    if (!coverImage.url) {
        throw new ApiError(500, "Error while uploading cover image")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                coverImage: {
                    url: coverImage?.url,
                    resourceType: coverImage?.resource_type,
                    publicId: coverImage?.public_id,
                }
            }
        },
        {
            new: true
        }
    ).select("-password -refreshToken")

    if (!user) {
        await deleteOnCloudinary(coverImage?.url, coverImage?.publicId, coverImage?.resourceType);
        throw new ApiError(404, "User not found")
    }

    if (url) {
        try {
            await deleteOnCloudinary(url, publicId, resourceType);
        } catch (error) {
            console.log(`Failed to Delete Old Image From Cloudinary Server ${error}`);
            throw new ApiError(500, error?.message || 'Server Error');
        }
    }

    return res
        .status(200)
        .json(new ApiResponse(
            200,
            user,
            "Cover image successfully updated"
        ))
} )

const updateUserAvatar = asyncHandler ( async (req, res) => {

    const { url, publicId, resourceType } = req?.user.avatar;

    if (!(url || publicId || resourceType)) {
        throw new ApiError(404, "Something went wrong while updating user avatar")
    }

    const avatarLocalPath = req?.file.path;
    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar file is required")
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath);

    if (!avatar.url) {
        throw new ApiError(500, "Error while uploading avatar")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                avatar: {
                    url: avatar?.url,
                    publicId: avatar?.public_id,
                    resourceType: avatar?.resource_type,
                }
            }
        },
        {
            new: true
        }
    ).select("-password -refreshToken")

    if (!user) {
        await deleteOnCloudinary(avatar?.url, avatar?.publicId, avatar?.resourceType);
        throw new ApiError(404, "User not found")
    }

    if (url) {
        try {
            await deleteOnCloudinary(url, publicId, resourceType);
        } catch (error) {
            console.log(`Failed to Delete Old Image From Cloudinary Server ${error}`);
            throw new ApiError(500, error?.message || 'Server Error');
        }
    }

    return res
        .status(200)
        .json(new ApiResponse(
            200,
            user,
            "Avatar successfully updated"
        ))
} )

const getUserChannelProfile = asyncHandler( async (req, res) => {
    const { username } = req.params;

    if (!username?.trim()) {
        throw new ApiError(400, "Username is missing")
    }

    const channel = await User.aggregate([
        {
            $match: {
                username: username?.toLowerCase()
            }
        },
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "channel",
                as: "subscribers",
            }
        },
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "subscriber",
                as: "subscribedTo",
            }
        },
        {
            $addFields: {
                subscribersCount: {
                    $size: "$subscribers"
                },
                channelSubscribedToCount: {
                    $size: "$subscribedTo"
                },
                isSubscribed: {
                    $cond: {
                        if: {$in: [req.user?._id, "$subscribers.subscriber"]},
                        then: true,
                        else: false,
                    }
                }
            }
        },
        {
            $project: {
                fullName: 1,
                username: 1,
                subscribersCount: 1,
                channelSubscribedToCount: 1,
                isSubscribed: 1,
                avatar: "$avatar.url",
                coverImage: "$coverImage.url",
                email: 1,
                createdAt: 1,
            }
        },
    ])

    if (!channel?.length) {
        throw new ApiError(404, "Channel does not exist")
    }

    return res
        .status(200)
        .json(new ApiResponse(
            200,
            channel[0],
            "User channel fetched successfully"
        ))
} )

const getWatchHistory = asyncHandler ( async (req, res) => {
    const user = await User.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId(req.user._id)
            }
        },
        {
            $lookup: {
                from: "videos",
                localField: "watchHistory",
                foreignField: "_id",
                as: "watchHistory",
                pipeline: [
                    {
                        $lookup: {
                            from: "Users",
                            localField: "owner",
                            foreignField: "_id",
                            as: "owner",
                            pipeline: [
                                {
                                    $project: {
                                        fullName: 1,
                                        username: 1,
                                        avatar: 1,
                                    }
                                },
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
                ]
            }
        }
    ])

    return res
        .status(200)
        .json(new ApiResponse(
            200,
            user[0].watchHistory,
            "User watch history fetched successfully"
        ))
} )

export { 
    registerUser, loginUser, logoutUser, refreshAccessToken, 
    changeCurrentPassword, getCurrentUser, updateAccountDetails, 
    updateUserCoverImage, updateUserAvatar, getUserChannelProfile, 
    getWatchHistory,
}