import { NextResponse } from 'next/server';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: Request) {
  try {
    const { feedback, userEmail, userId } = await request.json();

    if (!feedback || !feedback.trim()) {
      return NextResponse.json(
        { error: 'Feedback is required' },
        { status: 400 }
      );
    }

    // Send email to you using Resend
    const { data, error } = await resend.emails.send({
      from: 'ResumeMax Feedback <onboarding@resend.dev>', // You'll need to update this with your verified domain
      to: ['oduduabasiav@gmail.com'],
      subject: 'New Feedback from ResumeMax User',
      html: `
        <h2>New Feedback Received</h2>
        <p><strong>From:</strong> ${userEmail}</p>
        <p><strong>User ID:</strong> ${userId}</p>
        <hr />
        <h3>Feedback:</h3>
        <p>${feedback.replace(/\n/g, '<br>')}</p>
      `,
    });

    if (error) {
      console.error('Error sending feedback email:', error);
      return NextResponse.json(
        { error: 'Failed to send feedback' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { success: true, message: 'Feedback sent successfully' },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error in send-feedback API:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
