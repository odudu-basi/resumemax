import { google } from 'googleapis';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error('Supabase URL or Service Role Key is not defined');
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

export interface VerificationEmail {
  id: string;
  subject: string;
  from: string;
  body: string;
  verificationCode?: string;
  verificationLink?: string;
  receivedAt: Date;
}

/**
 * Initialize Gmail OAuth2 client with user tokens
 */
export async function getGmailClient(userId: string) {
  try {
    // Fetch user's Gmail OAuth tokens from Supabase
    const { data: userProfile, error } = await supabase
      .from('user_profiles')
      .select('gmail_access_token, gmail_refresh_token')
      .eq('user_id', userId)
      .single();

    if (error || !userProfile?.gmail_access_token) {
      console.log('❌ No Gmail OAuth tokens found for user');
      return null;
    }

    const oauth2Client = new google.auth.OAuth2(
      process.env.GMAIL_CLIENT_ID,
      process.env.GMAIL_CLIENT_SECRET,
      process.env.GMAIL_REDIRECT_URI || `${process.env.NEXT_PUBLIC_BASE_URL}/api/auth/gmail/callback`
    );

    oauth2Client.setCredentials({
      access_token: userProfile.gmail_access_token,
      refresh_token: userProfile.gmail_refresh_token,
    });

    // Handle token refresh
    oauth2Client.on('tokens', async (tokens) => {
      if (tokens.refresh_token) {
        // Update refresh token in database
        await supabase
          .from('user_profiles')
          .update({
            gmail_refresh_token: tokens.refresh_token,
            gmail_access_token: tokens.access_token
          })
          .eq('user_id', userId);
      } else if (tokens.access_token) {
        // Update access token only
        await supabase
          .from('user_profiles')
          .update({ gmail_access_token: tokens.access_token })
          .eq('user_id', userId);
      }
    });

    return google.gmail({ version: 'v1', auth: oauth2Client });
  } catch (error) {
    console.error('Error initializing Gmail client:', error);
    return null;
  }
}

/**
 * Search for verification emails in Gmail
 */
export async function searchVerificationEmails(
  userId: string,
  options: {
    fromDomain?: string;
    keywords?: string[];
    maxResults?: number;
    newerThan?: Date; // Only get emails newer than this date
  } = {}
): Promise<VerificationEmail[]> {
  const gmail = await getGmailClient(userId);
  if (!gmail) {
    throw new Error('Could not initialize Gmail client');
  }

  try {
    // Build search query
    const queryParts: string[] = [];

    // Default verification keywords
    const defaultKeywords = [
      'verification',
      'verify',
      'confirm',
      'confirmation',
      'code',
      'authenticate',
      'authentication',
      'otp',
      'one-time',
      'security code'
    ];

    const searchKeywords = options.keywords || defaultKeywords;
    queryParts.push(`{${searchKeywords.join(' OR ')}}`);

    if (options.fromDomain) {
      queryParts.push(`from:*@${options.fromDomain}`);
    }

    // Only get recent emails (last 10 minutes by default)
    const timeLimit = options.newerThan || new Date(Date.now() - 10 * 60 * 1000);
    const afterTimestamp = Math.floor(timeLimit.getTime() / 1000);
    queryParts.push(`after:${afterTimestamp}`);

    // Only unread emails
    queryParts.push('is:unread');

    const query = queryParts.join(' ');
    console.log('🔍 Gmail search query:', query);

    // Search messages
    const response = await gmail.users.messages.list({
      userId: 'me',
      q: query,
      maxResults: options.maxResults || 5,
    });

    const messages = response.data.messages || [];
    console.log(`📧 Found ${messages.length} potential verification emails`);

    // Fetch full message details
    const verificationEmails: VerificationEmail[] = [];

    for (const message of messages) {
      if (!message.id) continue;

      const fullMessage = await gmail.users.messages.get({
        userId: 'me',
        id: message.id,
        format: 'full',
      });

      const headers = fullMessage.data.payload?.headers || [];
      const subject = headers.find(h => h.name === 'Subject')?.value || '';
      const from = headers.find(h => h.name === 'From')?.value || '';
      const dateStr = headers.find(h => h.name === 'Date')?.value || '';

      // Extract email body
      let body = '';
      const parts = fullMessage.data.payload?.parts || [];

      for (const part of parts) {
        if (part.mimeType === 'text/plain' || part.mimeType === 'text/html') {
          const data = part.body?.data;
          if (data) {
            body += Buffer.from(data, 'base64').toString('utf-8');
          }
        }
      }

      // If no parts, try main payload body
      if (!body && fullMessage.data.payload?.body?.data) {
        body = Buffer.from(fullMessage.data.payload.body.data, 'base64').toString('utf-8');
      }

      // Extract verification code and links
      const { code, link } = extractVerificationData(body);

      verificationEmails.push({
        id: message.id,
        subject,
        from,
        body,
        verificationCode: code,
        verificationLink: link,
        receivedAt: new Date(dateStr),
      });
    }

    return verificationEmails;
  } catch (error) {
    console.error('Error searching verification emails:', error);
    throw error;
  }
}

/**
 * Extract verification code and link from email body
 */
function extractVerificationData(body: string): { code?: string; link?: string } {
  let code: string | undefined;
  let link: string | undefined;

  // Remove HTML tags for easier parsing
  const plainText = body.replace(/<[^>]*>/g, ' ');

  // Pattern 1: Look for 6-8 digit codes
  const digitCodeMatch = plainText.match(/\b(\d{4,8})\b/);
  if (digitCodeMatch) {
    code = digitCodeMatch[1];
  }

  // Pattern 2: Look for alphanumeric codes (e.g., "Code: ABC123" or "Your code is: XYZ789")
  const alphaCodeMatch = plainText.match(/(?:code|verification|otp)[\s:]+([A-Z0-9]{4,10})/i);
  if (alphaCodeMatch) {
    code = alphaCodeMatch[1];
  }

  // Pattern 3: Look for verification links
  const linkPatterns = [
    /https?:\/\/[^\s<>"]+(?:verify|confirm|authenticate|activation)[^\s<>"]*/gi,
    /(?:verify|confirm|authenticate|activation)[^\s<>"]*https?:\/\/[^\s<>"]*/gi,
  ];

  for (const pattern of linkPatterns) {
    const matches = body.match(pattern);
    if (matches && matches.length > 0) {
      // Get the first match and clean it
      link = matches[0].replace(/[<>"'\)]+$/, '').trim();
      break;
    }
  }

  // If we found a link but no code, try to extract code from URL
  if (link && !code) {
    const urlCodeMatch = link.match(/[?&](?:code|token|verification)=([A-Za-z0-9_-]+)/i);
    if (urlCodeMatch) {
      code = urlCodeMatch[1];
    }
  }

  console.log(`   🔑 Extracted verification code: ${code || 'none'}`);
  console.log(`   🔗 Extracted verification link: ${link || 'none'}`);

  return { code, link };
}

/**
 * Mark email as read (disabled - requires gmail.modify permission)
 * Not needed for verification to work
 */
export async function markEmailAsRead(userId: string, messageId: string) {
  // Disabled - we only use gmail.readonly permission
  // Verification works fine without marking emails as read
  console.log(`ℹ️  Email ${messageId} processed (not marking as read - read-only mode)`);
}

/**
 * Generate Gmail OAuth URL for user authentication
 */
export function generateGmailAuthUrl(userId: string): string {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET,
    process.env.GMAIL_REDIRECT_URI || `${process.env.NEXT_PUBLIC_BASE_URL}/api/auth/gmail/callback`
  );

  const scopes = [
    'https://www.googleapis.com/auth/gmail.readonly',
  ];

  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    state: userId, // Pass userId in state to identify the user after OAuth
    prompt: 'consent', // Force consent screen to get refresh token
  });
}
