import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'No authorization header' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Get user demographics
    const { data: demographics, error } = await supabase
      .from('user_demographics')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 is "not found" error
      console.error('Error fetching demographics:', error);
      return NextResponse.json({ error: 'Failed to fetch demographics' }, { status: 500 });
    }

    return NextResponse.json({ demographics: demographics || null });
  } catch (error) {
    console.error('Error in demographics GET:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'No authorization header' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const body = await request.json();
    const {
      race,
      gender,
      age_range,
      education_level,
      employment_status,
      veteran_status,
      disability_status
    } = body;

    // Validate required fields (all are optional, but validate format if provided)
    const validRaces = [
      'american_indian_alaska_native',
      'asian',
      'black_african_american',
      'hispanic_latino',
      'native_hawaiian_pacific_islander',
      'white',
      'two_or_more_races',
      'prefer_not_to_say'
    ];

    const validGenders = [
      'male',
      'female',
      'non_binary',
      'transgender',
      'other',
      'prefer_not_to_say'
    ];

    const validAgeRanges = [
      'under_18',
      '18_24',
      '25_34',
      '35_44',
      '45_54',
      '55_64',
      '65_plus',
      'prefer_not_to_say'
    ];

    const validEducationLevels = [
      'high_school',
      'some_college',
      'associate_degree',
      'bachelor_degree',
      'master_degree',
      'doctoral_degree',
      'professional_degree',
      'prefer_not_to_say'
    ];

    const validEmploymentStatuses = [
      'employed_full_time',
      'employed_part_time',
      'self_employed',
      'unemployed_seeking',
      'unemployed_not_seeking',
      'student',
      'retired',
      'prefer_not_to_say'
    ];

    const validVeteranStatuses = [
      'veteran',
      'not_veteran',
      'prefer_not_to_say'
    ];

    const validDisabilityStatuses = [
      'yes',
      'no',
      'prefer_not_to_say'
    ];

    // Validate values if provided
    if (race && !validRaces.includes(race)) {
      return NextResponse.json({ error: 'Invalid race value' }, { status: 400 });
    }
    if (gender && !validGenders.includes(gender)) {
      return NextResponse.json({ error: 'Invalid gender value' }, { status: 400 });
    }
    if (age_range && !validAgeRanges.includes(age_range)) {
      return NextResponse.json({ error: 'Invalid age_range value' }, { status: 400 });
    }
    if (education_level && !validEducationLevels.includes(education_level)) {
      return NextResponse.json({ error: 'Invalid education_level value' }, { status: 400 });
    }
    if (employment_status && !validEmploymentStatuses.includes(employment_status)) {
      return NextResponse.json({ error: 'Invalid employment_status value' }, { status: 400 });
    }
    if (veteran_status && !validVeteranStatuses.includes(veteran_status)) {
      return NextResponse.json({ error: 'Invalid veteran_status value' }, { status: 400 });
    }
    if (disability_status && !validDisabilityStatuses.includes(disability_status)) {
      return NextResponse.json({ error: 'Invalid disability_status value' }, { status: 400 });
    }

    // Prepare data for upsert (only include non-null values)
    const demographicsData: any = {
      user_id: user.id,
    };

    if (race) demographicsData.race = race;
    if (gender) demographicsData.gender = gender;
    if (age_range) demographicsData.age_range = age_range;
    if (education_level) demographicsData.education_level = education_level;
    if (employment_status) demographicsData.employment_status = employment_status;
    if (veteran_status) demographicsData.veteran_status = veteran_status;
    if (disability_status) demographicsData.disability_status = disability_status;

    // Upsert demographics data
    const { data, error } = await supabase
      .from('user_demographics')
      .upsert(demographicsData, {
        onConflict: 'user_id'
      })
      .select()
      .single();

    if (error) {
      console.error('Error saving demographics:', error);
      return NextResponse.json({ error: 'Failed to save demographics' }, { status: 500 });
    }

    return NextResponse.json({ 
      message: 'Demographics saved successfully',
      demographics: data
    });
  } catch (error) {
    console.error('Error in demographics POST:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  // PUT uses the same logic as POST for upsert
  return POST(request);
}

export async function DELETE(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'No authorization header' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Delete user demographics
    const { error } = await supabase
      .from('user_demographics')
      .delete()
      .eq('user_id', user.id);

    if (error) {
      console.error('Error deleting demographics:', error);
      return NextResponse.json({ error: 'Failed to delete demographics' }, { status: 500 });
    }

    return NextResponse.json({ message: 'Demographics deleted successfully' });
  } catch (error) {
    console.error('Error in demographics DELETE:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
