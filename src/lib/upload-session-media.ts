import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error('Supabase URL or Service Role Key is not defined');
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

export interface MediaUploadResult {
  screenshotUrl?: string;
  videoUrl?: string;
  error?: string;
}

/**
 * Upload screenshot and video to Supabase storage
 * @param sessionId - Auto-apply session ID
 * @param screenshotPath - Local path to screenshot file
 * @param videoPath - Local path to video file
 * @returns Public URLs for uploaded files
 */
export async function uploadSessionMedia(
  sessionId: string,
  screenshotPath?: string,
  videoPath?: string
): Promise<MediaUploadResult> {
  const result: MediaUploadResult = {};

  try {
    // Upload screenshot
    if (screenshotPath && fs.existsSync(screenshotPath)) {
      console.log(`📤 Uploading screenshot: ${screenshotPath}`);

      const screenshotBuffer = fs.readFileSync(screenshotPath);
      const screenshotFileName = `${sessionId}/screenshot.png`;

      const { data: screenshotData, error: screenshotError } = await supabase.storage
        .from('application-media')
        .upload(screenshotFileName, screenshotBuffer, {
          contentType: 'image/png',
          upsert: true
        });

      if (screenshotError) {
        console.error('Error uploading screenshot:', screenshotError);
        result.error = screenshotError.message;
      } else {
        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('application-media')
          .getPublicUrl(screenshotFileName);

        result.screenshotUrl = publicUrl;
        console.log(`✅ Screenshot uploaded: ${publicUrl}`);

        // Delete local file to save space
        try {
          fs.unlinkSync(screenshotPath);
          console.log(`🗑️  Deleted local screenshot`);
        } catch (err) {
          console.log(`⚠️  Could not delete local screenshot: ${err}`);
        }
      }
    }

    // Upload video
    if (videoPath && fs.existsSync(videoPath)) {
      console.log(`📤 Uploading video: ${videoPath}`);

      const videoBuffer = fs.readFileSync(videoPath);
      const videoFileName = `${sessionId}/recording.webm`;

      const { data: videoData, error: videoError } = await supabase.storage
        .from('application-media')
        .upload(videoFileName, videoBuffer, {
          contentType: 'video/webm',
          upsert: true
        });

      if (videoError) {
        console.error('Error uploading video:', videoError);
        result.error = videoError.message;
      } else {
        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('application-media')
          .getPublicUrl(videoFileName);

        result.videoUrl = publicUrl;
        console.log(`✅ Video uploaded: ${publicUrl}`);

        // Delete local file to save space
        try {
          fs.unlinkSync(videoPath);
          console.log(`🗑️  Deleted local video`);
        } catch (err) {
          console.log(`⚠️  Could not delete local video: ${err}`);
        }
      }
    }

    return result;

  } catch (error: any) {
    console.error('Error in uploadSessionMedia:', error);
    return {
      error: error.message
    };
  }
}

/**
 * Ensure application-media storage bucket exists with proper policies
 * Run this once during setup
 */
export async function ensureMediaBucketExists() {
  try {
    // Check if bucket exists
    const { data: buckets } = await supabase.storage.listBuckets();
    const bucketExists = buckets?.some(b => b.name === 'application-media');

    if (!bucketExists) {
      console.log('Creating application-media storage bucket...');

      // Create bucket
      const { data, error } = await supabase.storage.createBucket('application-media', {
        public: true,
        fileSizeLimit: 104857600, // 100MB
        allowedMimeTypes: ['image/png', 'image/jpeg', 'video/webm', 'video/mp4']
      });

      if (error) {
        console.error('Error creating bucket:', error);
        return false;
      }

      console.log('✅ Bucket created successfully');
    }

    return true;

  } catch (error) {
    console.error('Error ensuring bucket exists:', error);
    return false;
  }
}
