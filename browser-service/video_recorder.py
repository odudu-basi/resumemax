"""
Video recording module for browser automation sessions
Records browser activity and uploads to Supabase Storage
"""
import os
import asyncio
import logging
from typing import Optional
from pathlib import Path
from playwright.async_api import Page, BrowserContext
from supabase import create_client, Client

logger = logging.getLogger(__name__)


class VideoRecorder:
    """Handles video recording for browser automation sessions"""

    def __init__(self, supabase_url: str, supabase_key: str):
        """
        Initialize video recorder

        Args:
            supabase_url: Supabase project URL
            supabase_key: Supabase service role key
        """
        self.supabase: Client = create_client(supabase_url, supabase_key)
        self.recordings_dir = Path("/tmp/recordings")
        self.recordings_dir.mkdir(parents=True, exist_ok=True)
        logger.info(f"VideoRecorder initialized. Recordings dir: {self.recordings_dir}")

    async def get_video_path_from_context(self, page: Page) -> Optional[str]:
        """
        Get the video path from a Playwright page after recording

        Args:
            page: Playwright Page object

        Returns:
            Path to the recorded video file, or None if not found
        """
        try:
            # Playwright saves video when page/context is closed
            # The video object gives us the path
            if page.video:
                video_path = await page.video.path()
                logger.info(f"Video path obtained: {video_path}")
                return video_path
            else:
                logger.warning("No video object found on page")
                return None
        except Exception as e:
            logger.error(f"Error getting video path: {str(e)}", exc_info=True)
            return None

    async def upload_video_to_storage(
        self,
        video_path: str,
        session_id: str,
        user_id: str
    ) -> Optional[str]:
        """
        Upload video to Supabase Storage

        Args:
            video_path: Local path to video file
            session_id: Application session ID
            user_id: User ID

        Returns:
            Signed URL of uploaded video, or None if failed
        """
        try:
            if not os.path.exists(video_path):
                logger.error(f"Video file not found at {video_path}")
                return None

            # Storage path format: {user_id}/{session_id}.webm
            storage_path = f"{user_id}/{session_id}.webm"

            logger.info(f"Uploading video to storage: {storage_path}")

            # Read and upload video file
            with open(video_path, 'rb') as video_file:
                file_data = video_file.read()

                # Upload to Supabase Storage
                response = self.supabase.storage.from_('application-videos').upload(
                    path=storage_path,
                    file=file_data,
                    file_options={
                        "content-type": "video/webm",
                        "upsert": "true"  # Overwrite if exists
                    }
                )

            # Check for errors
            if hasattr(response, 'error') and response.error:
                logger.error(f"Failed to upload video: {response.error}")
                return None

            logger.info(f"Video uploaded successfully: {storage_path}")

            # Create signed URL (valid for 1 year)
            signed_url_response = self.supabase.storage.from_('application-videos').create_signed_url(
                path=storage_path,
                expires_in=31536000  # 1 year in seconds
            )

            # Handle response format
            if isinstance(signed_url_response, dict):
                if 'error' in signed_url_response and signed_url_response['error']:
                    logger.error(f"Failed to create signed URL: {signed_url_response['error']}")
                    return None

                signed_url = signed_url_response.get('signedURL')
            else:
                signed_url = signed_url_response

            if not signed_url:
                logger.error("No signed URL returned from Supabase")
                return None

            logger.info(f"Signed URL created for video: {signed_url[:50]}...")

            # Clean up local file
            try:
                os.remove(video_path)
                logger.info(f"Local video file deleted: {video_path}")
            except Exception as e:
                logger.warning(f"Failed to delete local video file: {e}")

            return signed_url

        except Exception as e:
            logger.error(f"Error uploading video to storage: {str(e)}", exc_info=True)
            return None

    async def finalize_and_upload(
        self,
        page: Page,
        session_id: str,
        user_id: str
    ) -> Optional[str]:
        """
        Finalize video recording and upload to storage

        This should be called after closing the page/context to ensure
        video is fully written.

        Args:
            page: Playwright Page object
            session_id: Application session ID
            user_id: User ID

        Returns:
            Signed URL of uploaded video, or None if failed
        """
        try:
            # Get video path before closing (Playwright keeps track of it)
            video_path = await self.get_video_path_from_context(page)

            if not video_path:
                logger.warning("No video path available to upload")
                return None

            # Wait a moment for video to be fully written to disk
            await asyncio.sleep(2)

            # Verify file exists and has content
            if not os.path.exists(video_path):
                logger.error(f"Video file does not exist: {video_path}")
                return None

            file_size = os.path.getsize(video_path)
            logger.info(f"Video file size: {file_size / (1024 * 1024):.2f} MB")

            if file_size == 0:
                logger.error(f"Video file is empty: {video_path}")
                return None

            # Upload to Supabase Storage
            video_url = await self.upload_video_to_storage(
                video_path=video_path,
                session_id=session_id,
                user_id=user_id
            )

            if video_url:
                logger.info(f"Video successfully uploaded for session {session_id}")
                return video_url
            else:
                logger.error(f"Failed to upload video for session {session_id}")
                return None

        except Exception as e:
            logger.error(f"Error finalizing and uploading video: {str(e)}", exc_info=True)
            return None

    async def update_session_with_video(
        self,
        session_id: str,
        video_url: str
    ) -> bool:
        """
        Update auto_apply_sessions table with video URL

        Args:
            session_id: Application session ID
            video_url: Signed URL of the video

        Returns:
            True if successful, False otherwise
        """
        try:
            response = self.supabase.table('auto_apply_sessions').update({
                'video_path': video_url,
            }).eq('id', session_id).execute()

            if hasattr(response, 'error') and response.error:
                logger.error(f"Failed to update session with video URL: {response.error}")
                return False

            logger.info(f"Session {session_id} updated with video URL")
            return True

        except Exception as e:
            logger.error(f"Error updating session with video: {str(e)}", exc_info=True)
            return False


async def create_context_with_recording(
    browser,
    recordings_dir: str = "/tmp/recordings"
) -> BrowserContext:
    """
    Helper function to create a browser context with video recording enabled

    Args:
        browser: Playwright Browser instance
        recordings_dir: Directory to save recordings

    Returns:
        BrowserContext with video recording enabled
    """
    context = await browser.new_context(
        viewport={'width': 1920, 'height': 1080},
        record_video_dir=recordings_dir,
        record_video_size={'width': 1920, 'height': 1080},
        # Additional context options for better recording
        user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        locale='en-US',
        timezone_id='America/New_York',
    )

    logger.info(f"Browser context created with video recording enabled")
    return context
