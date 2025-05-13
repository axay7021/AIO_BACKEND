import { Injectable } from '@nestjs/common';
import { v2 as cloudinary, UploadApiErrorResponse, UploadApiResponse } from 'cloudinary';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

dotenv.config();

@Injectable()
export class CloudinaryService {
  constructor() {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });
  }

  // Function to upload an image from file path
  async uploadImage(filePath: string, folder: string): Promise<UploadApiResponse> {
    return new Promise((resolve, reject) => {
      cloudinary.uploader.upload(
        filePath,
        {
          folder: folder,
        },
        (error: UploadApiErrorResponse, result: UploadApiResponse) => {
          if (error) {
            this.deleteLocalFile(filePath); // Delete file if upload fails
            reject(error);
          } else {
            this.deleteLocalFile(filePath); // Delete file after successful upload
            resolve(result);
          }
        },
      );
    });
  }

  // Function to delete an image by public ID
  async deleteImage(publicId: string): Promise<{ result: string }> {
    return new Promise((resolve, reject) => {
      cloudinary.uploader.destroy(publicId, (error, result) => {
        if (error) {
          reject(error);
        } else {
          resolve(result as { result: string });
        }
      });
    });
  }

  // Helper function to delete local file
  private deleteLocalFile(filePath: string): void {
    fs.unlink(filePath, err => {
      if (err) {
        console.error(`Failed to delete local file: ${filePath}`, err);
      } else {
        // console.log(`Successfully deleted local file: ${filePath}`);
      }
    });
  }
}

export const CLOUDINARY_FOLDERS = {
  ORGANIZATION_PROFILES: 'organizations/profile-images',
  USER_PROFILE: 'users/profile-images',
  CHAT_MEDIA: 'chats/media',
  LEAD_ATTACHMENTS: 'leads/attachments',
} as const;
