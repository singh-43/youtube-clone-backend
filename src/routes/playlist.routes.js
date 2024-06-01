import { Router } from "express";
import { Playlist } from './../models/playlist.model.js';
import { verifyJWT } from './../middlewares/auth.middleware.js';
import { checkOwner } from './../middlewares/owner.middleware.js';
import {
    addVideoToPlaylist,
    createPlaylist,
    deletePlaylist,
    getPlaylistById,
    getUserPlaylists,
    removeVideoFromPlaylist,
    updatePlaylist,
} from "../controllers/playlist.controller.js";

const router = Router();

router.use(verifyJWT);

router.route("/").post(createPlaylist);

router.route("/:playlistId")
    .get(getPlaylistById)
    .all(checkOwner('playlistId', Playlist))
    .patch(updatePlaylist)
    .delete(deletePlaylist);

router.route("/add/:videoId/:playlistId").all(checkOwner('playlistId', Playlist)).patch(addVideoToPlaylist);

router.route("/remove/:videoId/:playlistId").all(checkOwner('playlistId', Playlist)).patch(removeVideoFromPlaylist);

router.route("/user/:userId").get(getUserPlaylists);

export default router;