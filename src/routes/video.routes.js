import { Router } from "express";
import { upload } from './../middlewares/multer.middleware.js';
import { verifyJWT } from './../middlewares/auth.middleware.js';
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

router.route("/toggle/publish/:videoId").patch(togglePublishStatus)

export default router;