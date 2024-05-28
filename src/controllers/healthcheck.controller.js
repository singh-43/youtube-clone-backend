import { mongoose } from "mongoose";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const healthcheck = asyncHandler ( async (req, res) => {
    const dbStatus = mongoose.connection.readyState ? "db connected" : "db disconnected"
    try {
        const healthCheck = {
            dbStatus,
            uptime: process.uptime(),
            message: "OK",
            timestamp: Date.now(),
            hrtime: process.hrtime(),
            serverStatus: `Server is running on port ${process.env.PORT}`
        }
        return res
            .status(200)
            .json(new ApiResponse(200, healthCheck, "Health check successfull"))
    } catch (error) {
        const healthCheck = {
            dbStatus,
            uptime: process.uptime(),
            message: "Error",
            timestamp: Date.now(),
            hrtime: process.hrtime(),
            error : error?.message
        }
        console.error("Error in health check:", error);
        return res.status(500)
            .json(
                new ApiResponse(
                    500,
                    healthCheck,
                    "Health check failed"
            )
        )
    }
} ) 

export {
    healthcheck,
}