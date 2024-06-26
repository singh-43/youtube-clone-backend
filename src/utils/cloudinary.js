import fs from "fs";
import { v2 as cloudinary } from 'cloudinary';
import { ApiError } from "./ApiError.js";
          
cloudinary.config({ 
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

const uploadOnCloudinary = async ( localFilePath ) => {
    try {
        if (!localFilePath) return null;
        const response = await cloudinary.uploader.upload(localFilePath, {
            resource_type: "auto",
            folder: "ytfeature",
        })
        fs.unlinkSync(localFilePath)
        // console.log("File successfully uploaded on Cloudinary", response.url);
        return response;
    } catch (error) {
        fs.unlinkSync(localFilePath) // remove the locally saved temp file as the upload operation failed
        return null;
    }
}

const deleteOnCloudinary = async ( publicId, resourceType ) => {
    try {
        if (!publicId) {
            throw new ApiError(404, "Media's url and public id is required")
        }

        const result = await cloudinary.uploader.destroy(
            publicId,
            { resource_type: resourceType },
        )

    } catch (error) {
        throw new ApiError(error.statusCode || 500, error?.message || "Server error")
    }
}

export { uploadOnCloudinary, deleteOnCloudinary }