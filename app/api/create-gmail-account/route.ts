import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { supabase } from '@/src/lib/supabase';

// Initialize Google Admin SDK with JWT
async function getGoogleAuth() {
  try {
    const serviceAccountKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;

    if (!serviceAccountKey) {
      throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY environment variable is not set');
    }

    console.log('🔍 Service account key length:', serviceAccountKey.length);
    const credentials = JSON.parse(serviceAccountKey);
    console.log('✅ Parsed credentials, client_email:', credentials.client_email);

    // Ensure private key has proper newlines
    const privateKey = credentials.private_key.replace(/\\n/g, '\n');
    console.log('🔑 Private key exists:', !!privateKey);
    console.log('🔑 Private key length:', privateKey?.length);
    console.log('🔑 Private key starts with:', privateKey?.substring(0, 30));

    const jwtClient = new google.auth.JWT({
      email: credentials.client_email,
      key: privateKey,
      scopes: [
        'https://www.googleapis.com/auth/admin.directory.user',
        'https://www.googleapis.com/auth/admin.directory.user.alias',
        'https://www.googleapis.com/auth/admin.directory.orgunit',
        'https://www.googleapis.com/auth/gmail.settings.sharing',
      ],
      subject: process.env.GOOGLE_ADMIN_EMAIL
    });

    console.log('📡 Attempting to authorize...');
    await jwtClient.authorize();
    console.log('✅ Authorization successful');
    return jwtClient;
  } catch (error) {
    console.error('Error initializing Google Auth:', error);
    throw error;
  }
}

// Generate a secure random password
function generateSecurePassword(length: number = 16): string {
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const numbers = '0123456789';
  const symbols = '!@#$%^&*()_+-=[]{}|;:,.<>?';

  const allChars = uppercase + lowercase + numbers + symbols;
  let password = '';

  // Ensure at least one of each type
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += symbols[Math.floor(Math.random() * symbols.length)];

  // Fill the rest randomly
  for (let i = password.length; i < length; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }

  // Shuffle the password
  return password.split('').sort(() => Math.random() - 0.5).join('');
}

export async function POST(request: NextRequest) {
  try {
    const { userId, firstName, lastName } = await request.json();

    // Validate inputs
    if (!userId || !firstName || !lastName) {
      return NextResponse.json(
        { error: 'Missing required fields: userId, firstName, lastName' },
        { status: 400 }
      );
    }

    // Validate environment variables
    if (!process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
      return NextResponse.json(
        { error: 'Google Service Account credentials not configured' },
        { status: 500 }
      );
    }

    if (!process.env.GOOGLE_ADMIN_EMAIL) {
      return NextResponse.json(
        { error: 'Google Admin email not configured' },
        { status: 500 }
      );
    }

    if (!process.env.GOOGLE_WORKSPACE_DOMAIN) {
      return NextResponse.json(
        { error: 'Google Workspace domain not configured' },
        { status: 500 }
      );
    }

    const domain = process.env.GOOGLE_WORKSPACE_DOMAIN;
    const orgPath = process.env.GOOGLE_WORKSPACE_ORG_PATH || '/';

    // Check if user already has a work email
    const { data: existingProfile, error: profileError } = await supabase
      .from('user_profiles')
      .select('work_email, first_name, last_name')
      .eq('user_id', userId)
      .single();

    if (profileError && profileError.code !== 'PGRST116') {
      console.error('Error checking existing profile:', profileError);
      return NextResponse.json(
        { error: 'Failed to check existing profile' },
        { status: 500 }
      );
    }

    // If work email already exists, return it
    if (existingProfile?.work_email) {
      return NextResponse.json({
        success: true,
        email: existingProfile.work_email,
        alreadyExists: true,
        message: 'Work email already exists for this user',
      });
    }

    // Create the email address: firstname.lastname@nuclei-mail.com
    const emailUsername = `${firstName.toLowerCase()}.${lastName.toLowerCase()}`;
    const workEmail = `${emailUsername}@${domain}`;

    // Initialize Google Admin SDK
    const auth = await getGoogleAuth();
    const admin = google.admin({ version: 'directory_v1', auth });

    // DEBUG: List all organizational units to find the correct path
    try {
      console.log('🔍 Listing all organizational units...');
      const orgUnitsResponse = await admin.orgunits.list({
        customerId: 'my_customer',
        type: 'all'
      });
      console.log('📋 Available Organizational Units:');
      orgUnitsResponse.data.organizationUnits?.forEach((ou: any) => {
        console.log(`   - Name: "${ou.name}", Path: "${ou.orgUnitPath}", ID: "${ou.orgUnitId}"`);
      });
    } catch (listError) {
      console.warn('⚠️  Could not list organizational units:', listError);
    }

    // Check if email already exists in Google Workspace
    try {
      await admin.users.get({ userKey: workEmail });

      // Email exists in Google Workspace, just update our database
      const { error: updateError } = await supabase
        .from('user_profiles')
        .update({
          first_name: firstName,
          last_name: lastName,
          work_email: workEmail,
          work_email_created_at: new Date().toISOString(),
        })
        .eq('user_id', userId);

      if (updateError) {
        console.error('Error updating profile:', updateError);
        return NextResponse.json(
          { error: 'Failed to update profile with existing email' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        email: workEmail,
        alreadyExists: true,
        message: 'Email already exists in Google Workspace',
      });
    } catch (error: any) {
      // Email doesn't exist, proceed with creation
      if (error.code !== 404) {
        console.error('Error checking Google Workspace user:', error);
        throw error;
      }
    }

    // Generate a secure password
    const password = generateSecurePassword();

    // Create the user in Google Workspace
    console.log('🔧 ===== GMAIL ACCOUNT CREATION DEBUG =====');
    console.log(`📧 Creating Gmail account: ${workEmail}`);
    console.log(`👤 First Name: ${firstName}`);
    console.log(`👤 Last Name: ${lastName}`);
    console.log(`🏢 Domain: ${domain}`);
    console.log(`📂 Org Unit Path: "${orgPath}"`);
    console.log(`📂 Org Unit Path Type: ${typeof orgPath}`);
    console.log(`📂 Org Unit Path Length: ${orgPath?.length}`);
    console.log('🔧 =========================================');

    const requestBody = {
      primaryEmail: workEmail,
      name: {
        givenName: firstName,
        familyName: lastName,
      },
      password: password,
      changePasswordAtNextLogin: false, // Use the initial password without requiring a change
      isEnrolledIn2Sv: false, // Don't enroll in 2-Step Verification
      isEnforcedIn2Sv: false, // Don't enforce 2-Step Verification
      orgUnitPath: orgPath,
    };

    console.log('📤 Request body being sent to Google:', JSON.stringify(requestBody, null, 2));

    let createResponse;
    try {
      createResponse = await admin.users.insert({
        requestBody: requestBody,
      });
    } catch (insertError: any) {
      console.error('❌ Google API Insert Error:');
      console.error('Error Code:', insertError.code);
      console.error('Error Message:', insertError.message);
      console.error('Error Details:', JSON.stringify(insertError.errors || insertError, null, 2));
      throw insertError;
    }

    console.log('Gmail account created successfully:', createResponse.data.primaryEmail);

    // Update the user profile in database using upsert
    console.log(`💾 Updating database for user_id: ${userId}`);
    const { data: upsertData, error: updateError } = await supabase
      .from('user_profiles')
      .upsert({
        user_id: userId,
        first_name: firstName,
        last_name: lastName,
        work_email: workEmail,
        work_email_password: password,
        work_email_created_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id'
      })
      .select();

    if (updateError) {
      console.error('❌ Error updating user profile:');
      console.error('Error code:', updateError.code);
      console.error('Error message:', updateError.message);
      console.error('Error details:', updateError.details);
      console.error('User ID attempted:', userId);
      // Gmail account was created but database update failed
      // You might want to handle this edge case differently
      return NextResponse.json(
        {
          error: 'Gmail account created but failed to update database',
          email: workEmail,
          password: password,
        },
        { status: 500 }
      );
    }

    console.log('✅ Database updated successfully:', upsertData);

    // Get user's personal email from auth.users
    const { data: authUser } = await supabase.auth.admin.getUserById(userId);
    const personalEmail = authUser?.user?.email;

    // Set up automatic email forwarding to user's personal email
    if (personalEmail) {
      try {
        console.log(`📧 Setting up email forwarding: ${workEmail} → ${personalEmail}`);

        // Create a new JWT client with the created user's email as subject
        const userAuth = new google.auth.JWT({
          email: credentials.client_email,
          key: privateKey,
          scopes: ['https://www.googleapis.com/auth/gmail.settings.sharing'],
          subject: workEmail, // Impersonate the newly created user
        });

        await userAuth.authorize();
        const gmail = google.gmail({ version: 'v1', auth: userAuth });

        // Step 1: Add forwarding address
        console.log(`📝 Adding forwarding address: ${personalEmail}`);
        await gmail.users.settings.forwardingAddresses.create({
          userId: 'me',
          requestBody: {
            forwardingEmail: personalEmail,
          },
        });

        // Step 2: Enable auto-forwarding
        console.log(`⚙️  Enabling auto-forwarding...`);
        await gmail.users.settings.updateAutoForwarding({
          userId: 'me',
          requestBody: {
            enabled: true,
            emailAddress: personalEmail,
            disposition: 'leaveInInbox', // Keep a copy in the work inbox
          },
        });

        console.log(`✅ Email forwarding successfully configured!`);
      } catch (forwardError: any) {
        console.error('⚠️  Failed to set up email forwarding:');
        console.error('Error:', forwardError.message);
        console.error('Details:', forwardError.errors || forwardError);
        // Don't fail the entire account creation if forwarding fails
        // The account is still created successfully
      }
    } else {
      console.warn('⚠️  No personal email found for user, skipping forwarding setup');
    }

    // TODO: Send email with credentials to user's personal email
    // For now, we'll return the password in the response
    // In production, you should send this via email and not return it in the API response

    return NextResponse.json({
      success: true,
      email: workEmail,
      password: password, // TEMPORARY: Remove this in production and send via email instead
      message: 'Gmail account created successfully. Password will be sent to your email.',
      personalEmail: personalEmail,
    });

  } catch (error: any) {
    console.error('Error creating Gmail account:', error);

    // Check for specific Google API errors
    if (error.code === 409) {
      return NextResponse.json(
        { error: 'Email already exists in Google Workspace' },
        { status: 409 }
      );
    }

    if (error.code === 403) {
      return NextResponse.json(
        { error: 'Insufficient permissions. Check domain-wide delegation setup.' },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { error: error.message || 'Failed to create Gmail account' },
      { status: 500 }
    );
  }
}
