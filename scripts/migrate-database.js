#!/usr/bin/env node

/**
 * Supabase Database Migration Script
 * 
 * This script migrates users, profiles, resumes, and analyses 
 * from one Supabase database to another.
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Configuration
const config = {
  // SOURCE DATABASE (OLD)
  source: {
    url: process.env.SOURCE_SUPABASE_URL || 'YOUR_OLD_SUPABASE_URL',
    key: process.env.SOURCE_SUPABASE_SERVICE_KEY || 'YOUR_OLD_SERVICE_KEY',
  },
  
  // TARGET DATABASE (NEW) 
  target: {
    url: process.env.TARGET_SUPABASE_URL || 'YOUR_NEW_SUPABASE_URL', 
    key: process.env.TARGET_SUPABASE_SERVICE_KEY || 'YOUR_NEW_SERVICE_KEY',
  },
  
  // Migration options
  options: {
    batchSize: 100,
    dryRun: false, // Set to true for testing
    preserveIds: true,
    migrateAuth: true,
    skipExisting: true,
  }
};

// Initialize Supabase clients
const sourceDb = createClient(config.source.url, config.source.key);
const targetDb = createClient(config.target.url, config.target.key);

// Migration statistics
let stats = {
  users: { total: 0, migrated: 0, errors: 0 },
  profiles: { total: 0, migrated: 0, errors: 0 },
  resumes: { total: 0, migrated: 0, errors: 0 },
  analyses: { total: 0, migrated: 0, errors: 0 },
  errors: []
};

/**
 * Log with timestamp
 */
function log(message, type = 'info') {
  const timestamp = new Date().toISOString();
  const prefix = type === 'error' ? '❌' : type === 'success' ? '✅' : 'ℹ️';
  console.log(`${prefix} [${timestamp}] ${message}`);
}

/**
 * Save migration report
 */
function saveMigrationReport() {
  const report = {
    timestamp: new Date().toISOString(),
    config: { ...config, source: { url: 'HIDDEN' }, target: { url: 'HIDDEN' } },
    statistics: stats,
    errors: stats.errors
  };
  
  const filename = `migration-report-${Date.now()}.json`;
  fs.writeFileSync(filename, JSON.stringify(report, null, 2));
  log(`Migration report saved: ${filename}`, 'success');
}

/**
 * Migrate auth users (requires admin privileges)
 */
async function migrateAuthUsers() {
  log('🔄 Starting auth users migration...');
  
  try {
    // Get all users from source
    const { data: sourceUsers, error: sourceError } = await sourceDb.auth.admin.listUsers();
    
    if (sourceError) {
      throw new Error(`Failed to fetch source users: ${sourceError.message}`);
    }
    
    stats.users.total = sourceUsers.users?.length || 0;
    log(`Found ${stats.users.total} users in source database`);
    
    if (config.options.dryRun) {
      log('DRY RUN: Would migrate auth users');
      return sourceUsers.users;
    }
    
    // Migrate users in batches
    for (let i = 0; i < sourceUsers.users.length; i += config.options.batchSize) {
      const batch = sourceUsers.users.slice(i, i + config.options.batchSize);
      
      for (const user of batch) {
        try {
          // Create user in target database
          const { data, error } = await targetDb.auth.admin.createUser({
            id: config.options.preserveIds ? user.id : undefined,
            email: user.email,
            password: Math.random().toString(36), // Temporary password
            email_confirm: true,
            user_metadata: user.user_metadata,
            app_metadata: user.app_metadata
          });
          
          if (error && !error.message.includes('already registered')) {
            throw error;
          }
          
          stats.users.migrated++;
          log(`Migrated user: ${user.email}`);
          
        } catch (error) {
          stats.users.errors++;
          stats.errors.push({
            type: 'auth_user',
            id: user.id,
            email: user.email,
            error: error.message
          });
          log(`Failed to migrate user ${user.email}: ${error.message}`, 'error');
        }
      }
    }
    
    return sourceUsers.users;
    
  } catch (error) {
    log(`Auth migration failed: ${error.message}`, 'error');
    throw error;
  }
}

/**
 * Migrate user profiles
 */
async function migrateUserProfiles() {
  log('🔄 Starting user profiles migration...');
  
  try {
    // Get all profiles from source
    const { data: sourceProfiles, error: sourceError } = await sourceDb
      .from('user_profiles')
      .select('*')
      .order('created_at');
    
    if (sourceError) {
      throw new Error(`Failed to fetch source profiles: ${sourceError.message}`);
    }
    
    stats.profiles.total = sourceProfiles?.length || 0;
    log(`Found ${stats.profiles.total} profiles in source database`);
    
    if (config.options.dryRun) {
      log('DRY RUN: Would migrate user profiles');
      return;
    }
    
    // Migrate profiles in batches
    for (let i = 0; i < sourceProfiles.length; i += config.options.batchSize) {
      const batch = sourceProfiles.slice(i, i + config.options.batchSize);
      
      const { data, error } = await targetDb
        .from('user_profiles')
        .upsert(batch, { onConflict: 'id', ignoreDuplicates: config.options.skipExisting });
      
      if (error) {
        log(`Batch migration failed: ${error.message}`, 'error');
        
        // Try individual inserts for this batch
        for (const profile of batch) {
          try {
            const { error: individualError } = await targetDb
              .from('user_profiles')
              .upsert(profile, { onConflict: 'id' });
            
            if (!individualError) {
              stats.profiles.migrated++;
            } else {
              stats.profiles.errors++;
              stats.errors.push({
                type: 'user_profile',
                id: profile.id,
                error: individualError.message
              });
            }
          } catch (err) {
            stats.profiles.errors++;
            stats.errors.push({
              type: 'user_profile', 
              id: profile.id,
              error: err.message
            });
          }
        }
      } else {
        stats.profiles.migrated += batch.length;
        log(`Migrated ${batch.length} profiles (batch ${Math.floor(i/config.options.batchSize) + 1})`);
      }
    }
    
  } catch (error) {
    log(`Profiles migration failed: ${error.message}`, 'error');
    throw error;
  }
}

/**
 * Migrate resumes
 */
async function migrateResumes() {
  log('🔄 Starting resumes migration...');
  
  try {
    // Get all resumes from source
    const { data: sourceResumes, error: sourceError } = await sourceDb
      .from('resumes')
      .select('*')
      .order('created_at');
    
    if (sourceError) {
      throw new Error(`Failed to fetch source resumes: ${sourceError.message}`);
    }
    
    stats.resumes.total = sourceResumes?.length || 0;
    log(`Found ${stats.resumes.total} resumes in source database`);
    
    if (config.options.dryRun) {
      log('DRY RUN: Would migrate resumes');
      return;
    }
    
    // Migrate resumes in batches
    for (let i = 0; i < sourceResumes.length; i += config.options.batchSize) {
      const batch = sourceResumes.slice(i, i + config.options.batchSize);
      
      const { data, error } = await targetDb
        .from('resumes')
        .upsert(batch, { onConflict: 'id', ignoreDuplicates: config.options.skipExisting });
      
      if (error) {
        log(`Batch migration failed: ${error.message}`, 'error');
        
        // Try individual inserts
        for (const resume of batch) {
          try {
            const { error: individualError } = await targetDb
              .from('resumes')
              .upsert(resume, { onConflict: 'id' });
            
            if (!individualError) {
              stats.resumes.migrated++;
            } else {
              stats.resumes.errors++;
              stats.errors.push({
                type: 'resume',
                id: resume.id,
                error: individualError.message
              });
            }
          } catch (err) {
            stats.resumes.errors++;
            stats.errors.push({
              type: 'resume',
              id: resume.id, 
              error: err.message
            });
          }
        }
      } else {
        stats.resumes.migrated += batch.length;
        log(`Migrated ${batch.length} resumes (batch ${Math.floor(i/config.options.batchSize) + 1})`);
      }
    }
    
  } catch (error) {
    log(`Resumes migration failed: ${error.message}`, 'error');
    throw error;
  }
}

/**
 * Migrate resume analyses
 */
async function migrateResumeAnalyses() {
  log('🔄 Starting resume analyses migration...');
  
  try {
    // Get all analyses from source
    const { data: sourceAnalyses, error: sourceError } = await sourceDb
      .from('resume_analyses')
      .select('*')
      .order('created_at');
    
    if (sourceError) {
      throw new Error(`Failed to fetch source analyses: ${sourceError.message}`);
    }
    
    stats.analyses.total = sourceAnalyses?.length || 0;
    log(`Found ${stats.analyses.total} analyses in source database`);
    
    if (config.options.dryRun) {
      log('DRY RUN: Would migrate resume analyses');
      return;
    }
    
    // Migrate analyses in batches
    for (let i = 0; i < sourceAnalyses.length; i += config.options.batchSize) {
      const batch = sourceAnalyses.slice(i, i + config.options.batchSize);
      
      const { data, error } = await targetDb
        .from('resume_analyses')
        .upsert(batch, { onConflict: 'id', ignoreDuplicates: config.options.skipExisting });
      
      if (error) {
        log(`Batch migration failed: ${error.message}`, 'error');
        
        // Try individual inserts
        for (const analysis of batch) {
          try {
            const { error: individualError } = await targetDb
              .from('resume_analyses')
              .upsert(analysis, { onConflict: 'id' });
            
            if (!individualError) {
              stats.analyses.migrated++;
            } else {
              stats.analyses.errors++;
              stats.errors.push({
                type: 'resume_analysis',
                id: analysis.id,
                error: individualError.message
              });
            }
          } catch (err) {
            stats.analyses.errors++;
            stats.errors.push({
              type: 'resume_analysis',
              id: analysis.id,
              error: err.message
            });
          }
        }
      } else {
        stats.analyses.migrated += batch.length;
        log(`Migrated ${batch.length} analyses (batch ${Math.floor(i/config.options.batchSize) + 1})`);
      }
    }
    
  } catch (error) {
    log(`Analyses migration failed: ${error.message}`, 'error');
    throw error;
  }
}

/**
 * Validate migration
 */
async function validateMigration() {
  log('🔍 Validating migration...');
  
  try {
    // Count records in target database
    const [profiles, resumes, analyses] = await Promise.all([
      targetDb.from('user_profiles').select('*', { count: 'exact', head: true }),
      targetDb.from('resumes').select('*', { count: 'exact', head: true }),
      targetDb.from('resume_analyses').select('*', { count: 'exact', head: true })
    ]);
    
    log(`Target database counts:`);
    log(`  - User Profiles: ${profiles.count}`);
    log(`  - Resumes: ${resumes.count}`);
    log(`  - Analyses: ${analyses.count}`);
    
    // Check for missing relationships
    const { data: orphanedResumes } = await targetDb
      .from('resumes')
      .select('id, user_id')
      .not('user_id', 'in', `(SELECT id FROM user_profiles)`);
    
    if (orphanedResumes?.length > 0) {
      log(`⚠️ Found ${orphanedResumes.length} resumes with missing user profiles`);
    }
    
  } catch (error) {
    log(`Validation failed: ${error.message}`, 'error');
  }
}

/**
 * Main migration function
 */
async function runMigration() {
  log('🚀 Starting Supabase database migration...');
  log(`Mode: ${config.options.dryRun ? 'DRY RUN' : 'LIVE MIGRATION'}`);
  
  try {
    // Test connections
    log('Testing database connections...');
    await sourceDb.from('user_profiles').select('count', { count: 'exact', head: true });
    await targetDb.from('user_profiles').select('count', { count: 'exact', head: true });
    log('✅ Database connections successful');
    
    // Run migrations in order (preserving relationships)
    if (config.options.migrateAuth) {
      await migrateAuthUsers();
    }
    
    await migrateUserProfiles();
    await migrateResumes(); 
    await migrateResumeAnalyses();
    
    // Validate results
    if (!config.options.dryRun) {
      await validateMigration();
    }
    
    // Print final statistics
    log('📊 Migration Statistics:');
    log(`  Users: ${stats.users.migrated}/${stats.users.total} (${stats.users.errors} errors)`);
    log(`  Profiles: ${stats.profiles.migrated}/${stats.profiles.total} (${stats.profiles.errors} errors)`);
    log(`  Resumes: ${stats.resumes.migrated}/${stats.resumes.total} (${stats.resumes.errors} errors)`);
    log(`  Analyses: ${stats.analyses.migrated}/${stats.analyses.total} (${stats.analyses.errors} errors)`);
    
    if (stats.errors.length > 0) {
      log(`⚠️ Total errors: ${stats.errors.length}`);
    }
    
    // Save report
    if (!config.options.dryRun) {
      saveMigrationReport();
    }
    
    log('🎉 Migration completed!', 'success');
    
  } catch (error) {
    log(`Migration failed: ${error.message}`, 'error');
    saveMigrationReport();
    process.exit(1);
  }
}

// Handle command line arguments
if (process.argv.includes('--dry-run')) {
  config.options.dryRun = true;
}

if (process.argv.includes('--no-auth')) {
  config.options.migrateAuth = false;
}

// Run migration
if (require.main === module) {
  runMigration();
}

module.exports = { runMigration, config, stats };
