import { Router } from 'express';
import {
    addComment,
    deleteComment,
    getVideoComments,
    updateComment,
} from "../controllers/comment.controller.js"
import { Comment } from './../models/comment.model.js';
import {verifyJWT} from "../middlewares/auth.middleware.js"
import { checkOwner } from './../middlewares/owner.middleware.js';

const router = Router();

router.use(verifyJWT); // Apply verifyJWT middleware to all routes in this file

router.route("/:videoId").get(getVideoComments).post(addComment);
router.route("/c/:commentId").all(checkOwner("commentId", Comment)).delete(deleteComment).patch(updateComment);

export default router