import { Router } from "express";
import { Video } from './../models/video.model.js';
import { upload } from './../middlewares/multer.middleware.js';
import { verifyJWT } from './../middlewares/auth.middleware.js';
import { checkOwner } from './../middlewares/owner.middleware.js';
import { 
    getAllVideos, getVideoById, publishAVideo,
    deleteVideo, updateVideo, togglePublishStatus,
} from "../controllers/video.controller.js";

const router = Router();

router.use(verifyJWT); //apply verifyjwt middleware to all routes in this file

router.route("/")
    .get(getAllVideos)
    .post(
        upload.fields([
            {
                name: "videoFile",
                maxCount: 1,
            },
            {
                name: "thumbnail",
                maxCount: 1,
            },
        ]),
        publishAVideo
    );

router.route("/:videoId")
    .get(getVideoById)
    .all(checkOwner('videoId', Video))
    .delete(deleteVideo)
    .patch(
        upload.fields([
            {
                name: "videoFile",
                maxCount: 1,
            },
            {
                name: "thumbnail",
                maxCount: 1,
            },
        ]),
        updateVideo)

router.route("/toggle/publish/:videoId").all(checkOwner('videoId', Video)).patch(togglePublishStatus)

export default router;