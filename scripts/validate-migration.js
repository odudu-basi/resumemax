#!/usr/bin/env node

/**
 * Migration Validation Script
 * 
 * Validates that the migration completed successfully
 * by comparing source and target database counts and relationships
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Configuration
const sourceDb = createClient(
  process.env.SOURCE_SUPABASE_URL,
  process.env.SOURCE_SUPABASE_SERVICE_KEY
);

const targetDb = createClient(
  process.env.TARGET_SUPABASE_URL,
  process.env.TARGET_SUPABASE_SERVICE_KEY
);

/**
 * Log with formatting
 */
function log(message, type = 'info') {
  const symbols = { info: 'ℹ️', success: '✅', warning: '⚠️', error: '❌' };
  console.log(`${symbols[type]} ${message}`);
}

/**
 * Get table counts from a database
 */
async function getTableCounts(db, dbName) {
  try {
    const [profiles, resumes, analyses] = await Promise.all([
      db.from('user_profiles').select('*', { count: 'exact', head: true }),
      db.from('resumes').select('*', { count: 'exact', head: true }),
      db.from('resume_analyses').select('*', { count: 'exact', head: true })
    ]);

    return {
      user_profiles: profiles.count || 0,
      resumes: resumes.count || 0,
      resume_analyses: analyses.count || 0
    };
  } catch (error) {
    log(`Failed to get counts from ${dbName}: ${error.message}`, 'error');
    return null;
  }
}

/**
 * Check for data integrity issues
 */
async function checkDataIntegrity(db, dbName) {
  const issues = [];
  
  try {
    // Check for orphaned resumes
    const { data: orphanedResumes } = await db
      .from('resumes')
      .select('id')
      .not('user_id', 'in', '(SELECT id FROM user_profiles)');
    
    if (orphanedResumes?.length > 0) {
      issues.push(`${orphanedResumes.length} resumes without valid user_id`);
    }

    // Check for orphaned analyses
    const { data: orphanedAnalyses } = await db
      .from('resume_analyses')
      .select('id')
      .not('user_id', 'in', '(SELECT id FROM user_profiles)');
    
    if (orphanedAnalyses?.length > 0) {
      issues.push(`${orphanedAnalyses.length} analyses without valid user_id`);
    }

    // Check for analyses without resumes
    const { data: analysesWithoutResumes } = await db
      .from('resume_analyses')
      .select('id')
      .not('resume_id', 'in', '(SELECT id FROM resumes)');
    
    if (analysesWithoutResumes?.length > 0) {
      issues.push(`${analysesWithoutResumes.length} analyses without valid resume_id`);
    }

  } catch (error) {
    issues.push(`Error checking integrity: ${error.message}`);
  }
  
  return issues;
}

/**
 * Sample some records to verify content
 */
async function sampleRecords(db, dbName) {
  try {
    const samples = {};
    
    // Sample user profiles
    const { data: profiles } = await db
      .from('user_profiles')
      .select('id, email, full_name, created_at')
      .limit(3);
    samples.user_profiles = profiles;
    
    // Sample resumes
    const { data: resumes } = await db
      .from('resumes')
      .select('id, title, user_id, created_at')
      .limit(3);
    samples.resumes = resumes;
    
    // Sample analyses
    const { data: analyses } = await db
      .from('resume_analyses')
      .select('id, job_title, user_id, created_at')
      .limit(3);
    samples.resume_analyses = analyses;
    
    return samples;
    
  } catch (error) {
    log(`Failed to sample records from ${dbName}: ${error.message}`, 'error');
    return null;
  }
}

/**
 * Main validation function
 */
async function validateMigration() {
  log('🔍 Starting migration validation...');
  
  try {
    // Test connections
    log('Testing database connections...');
    await Promise.all([
      sourceDb.from('user_profiles').select('count', { count: 'exact', head: true }),
      targetDb.from('user_profiles').select('count', { count: 'exact', head: true })
    ]);
    log('Database connections successful', 'success');
    
    // Get counts from both databases
    log('Comparing record counts...');
    const [sourceCounts, targetCounts] = await Promise.all([
      getTableCounts(sourceDb, 'source'),
      getTableCounts(targetDb, 'target')
    ]);
    
    if (!sourceCounts || !targetCounts) {
      log('Failed to retrieve counts from one or both databases', 'error');
      return;
    }
    
    // Compare counts
    log('📊 Record Count Comparison:');
    const tables = ['user_profiles', 'resumes', 'resume_analyses'];
    let allMatch = true;
    
    tables.forEach(table => {
      const source = sourceCounts[table];
      const target = targetCounts[table];
      const match = source === target;
      const status = match ? '✅' : '❌';
      
      log(`  ${table}: Source(${source}) → Target(${target}) ${status}`);
      
      if (!match) {
        allMatch = false;
        const diff = target - source;
        log(`    Difference: ${diff > 0 ? '+' : ''}${diff}`, 'warning');
      }
    });
    
    if (allMatch) {
      log('All record counts match perfectly!', 'success');
    } else {
      log('Some record counts do not match', 'warning');
    }
    
    // Check data integrity
    log('Checking data integrity...');
    const targetIssues = await checkDataIntegrity(targetDb, 'target');
    
    if (targetIssues.length === 0) {
      log('No data integrity issues found', 'success');
    } else {
      log('Data integrity issues found:', 'warning');
      targetIssues.forEach(issue => log(`  - ${issue}`, 'warning'));
    }
    
    // Sample records
    log('Sampling records for content verification...');
    const targetSamples = await sampleRecords(targetDb, 'target');
    
    if (targetSamples) {
      log('Sample records from target database:');
      
      if (targetSamples.user_profiles?.length > 0) {
        log(`  User Profiles (${targetSamples.user_profiles.length}):`);
        targetSamples.user_profiles.forEach(profile => {
          log(`    - ${profile.email} (${profile.full_name || 'No name'})`);
        });
      }
      
      if (targetSamples.resumes?.length > 0) {
        log(`  Resumes (${targetSamples.resumes.length}):`);
        targetSamples.resumes.forEach(resume => {
          log(`    - "${resume.title}" (User: ${resume.user_id?.substring(0, 8)}...)`);
        });
      }
      
      if (targetSamples.resume_analyses?.length > 0) {
        log(`  Analyses (${targetSamples.resume_analyses.length}):`);
        targetSamples.resume_analyses.forEach(analysis => {
          log(`    - "${analysis.job_title || 'No title'}" (User: ${analysis.user_id?.substring(0, 8)}...)`);
        });
      }
    }
    
    // Final verdict
    log('🎯 Migration Validation Summary:');
    if (allMatch && targetIssues.length === 0) {
      log('Migration appears to be successful! ✅', 'success');
    } else if (allMatch && targetIssues.length > 0) {
      log('Migration completed but with data integrity issues ⚠️', 'warning');
    } else {
      log('Migration may have issues - record counts do not match ❌', 'error');
    }
    
  } catch (error) {
    log(`Validation failed: ${error.message}`, 'error');
  }
}

// Run validation
if (require.main === module) {
  validateMigration();
}

module.exports = { validateMigration };
