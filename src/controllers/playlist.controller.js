import mongoose, { isValidObjectId } from "mongoose";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { Playlist } from "../models/playlist.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const createPlaylist = asyncHandler( async (req, res) => {
    let { name, privacy, description = "" } = req.body;

    if (!name || name.trim() === "") {
        throw new ApiError(404, "Playlist name is required")
    }

    const playlistCreated = await Playlist.create({
        name,
        description,
        privacy,
        owner: req?.user?._id,
    })

    if (!playlistCreated) {
        throw new ApiError(500, "Error in creating playlist. Try again")
    }

    return res.status(200)
        .json(new ApiResponse(200, playlistCreated, "Playlist has been successfully created"))

} )

const getUserPlaylists = asyncHandler( async (req, res) => {
    let { userId } = req.params;

    if (!userId || !isValidObjectId(userId)) {
        throw new ApiError(404, "Invalid user id")
    }

    const playlist = await Playlist.find({owner: mongoose.Types.ObjectId.createFromHexString(userId)})

    if (!playlist) {
        throw new ApiError(404, "Playlist not found")
    }

    return res.status(200)
        .json(new ApiResponse(200, playlist, playlist ? "User has not created any playlist" : "Playlist fetched successfully"))

} )

const getPlaylistById = asyncHandler( async (req, res) => {
    let { playlistId } = req.params;

    if (!playlistId || !isValidObjectId(playlistId)) {
        throw new ApiError(404, "Playlist id is required")
    }

    playlistId = mongoose.Types.ObjectId.createFromHexString(playlistId);

    const playlist = await Playlist.findById(playlistId)

    if (!playlist) {
        throw new ApiError(404, "Playlist not found")
    }

    return res.status(200)
        .json(new ApiResponse(200, playlist, "Playlist fetched successfully"))

} )

const addVideoToPlaylist = asyncHandler( async (req, res) => {
    const { playlistId, videoId } = req.params;

    if (!playlistId || !isValidObjectId(playlistId) || !videoId || !isValidObjectId(videoId)) {
        throw new ApiError(404, "Enter a valid playlist id and video id")
    }
    
    const playlist = await Playlist.findByIdAndUpdate(
        mongoose.Types.ObjectId.createFromHexString(playlistId),
        {
            $addToSet: {
                videos: videoId
            }
        },
        {
            new: true
        }
    );
    
    if (!playlist) {
        throw new ApiError(500, "Error updating playlist. Try again")
    }

    return res.status(200)
        .json(new ApiResponse(200, playlist, "Video added to playlist successfully"))

} )

const removeVideoFromPlaylist = asyncHandler( async (req, res) => {
    const { playlistId, videoId } = req.params;

    if (!playlistId || !isValidObjectId(playlistId) || !videoId || !isValidObjectId(videoId)) {
        throw new ApiError(404, "Enter a valid playlist id and video id")
    }

    const isVideoInPlaylist = await Playlist.findOne({
        _id: playlistId,
        videos: videoId
    })

    if (!isVideoInPlaylist) throw new ApiError(404, "Video not found in playlist");

    const removedVideo = await Playlist.findByIdAndUpdate(
        playlistId,
        {
            $pull: {
                videos: videoId
            }
        },
        {
            new: true
        }
    )

    if (!removedVideo) {
        throw new ApiError(500, "Error while removing video from playlist. Try again")
    }

    return res.status(200)
        .json(new ApiResponse(200, removedVideo, "Video removed from playlist successfully"))

} )

const deletePlaylist = asyncHandler( async (req, res) => {
    let { playlistId } = req.params;

    if (!playlistId || !isValidObjectId(playlistId)) {
        throw new ApiError(404, "Enter a valid playlist id")
    }

    playlistId = mongoose.Types.ObjectId.createFromHexString(playlistId)

    // const deletedPlaylist = await Playlist.deleteOne({
    //     _id: playlistId
    // })

    // if (deletedPlaylist?.deletedCount === 0) {
    //     throw new ApiError(404, "Playlist not found")
    // }

    const playlistData = await playlistId.findById(playlistId)

    if (!playlistData) {
        throw new ApiError(404, "Playlist not found")
    }

    if (req?.user?._id?.toString() !== playlistData?.owner?.toString()) {
        throw new ApiError(401, "Unauthorized Access. You are not allowed to delete this playlist")
    }

    const deletedPlaylist = await Playlist.findByIdAndDelete({
        _id: playlistId
    })

    if (!deletePlaylist) {
        throw new ApiError(500, "Error while deleting playlist. Try again")
    }

    return res.status(200)
        .json(new ApiResponse(200, deletedPlaylist, "Playlist successfully deleted"))

} )

const updatePlaylist = asyncHandler( async (req, res) => {
    let { playlistId } = req.params;
    const { name, privacy, description } = req.body;

    if (!playlistId || !isValidObjectId(playlistId)) {
        throw new ApiError(404, "Enter a valid playlist id")
    }

    playlistId = mongoose.Types.ObjectId.createFromHexString(playlistId)

    if (name?.trim() === "") {
        throw new ApiError(404, "Playlist name cannot be empty")
    }

    if (!name && !privacy) {
        throw new ApiError(404, "Please provide playlist name or privacy setting or both")
    }

    const updatedPlaylist = await Playlist.findByIdAndUpdate(
        playlistId,
        {
            name,
            description,
            privacy,
        }
    )

    if (!updatedPlaylist) {
        throw new ApiError(404, "Playlist not found")
    }

    return res.status(200)
        .json(new ApiResponse(200, updatedPlaylist, "Playlist has been successfully updated"))

} )

export {
    addVideoToPlaylist,
    createPlaylist,
    deletePlaylist,
    getPlaylistById,
    getUserPlaylists,
    removeVideoFromPlaylist,
    updatePlaylist,
}