import { Router } from "express";
import { Tweet } from './../models/tweet.model.js';
import { verifyJWT } from './../middlewares/auth.middleware.js';
import { checkOwner } from './../middlewares/owner.middleware.js';
import {
    createTweet,
    deleteTweet,
    getUserTweets,
    updateTweet,
} from "../controllers/tweet.controller.js";

const router = Router();

router.use(verifyJWT);

router.route("/").post(createTweet);
router.route("/user/:userId").get(getUserTweets);
router.route("/:tweetId").all(checkOwner("tweetId", Tweet)).patch(updateTweet).delete(deleteTweet);

export default router;