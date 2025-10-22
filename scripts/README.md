# 🚀 **ResumeMax Database Migration Scripts**

Complete toolkit for migrating users, profiles, resumes, and analyses between Supabase databases.

## 📋 **Quick Start**

### **1. Setup Environment**
```bash
cd scripts/
npm install
cp env.template .env
# Edit .env with your database credentials
```

### **2. Test Migration (Dry Run)**
```bash
npm run migrate:dry-run
```

### **3. Run Full Migration**
```bash
npm run migrate
```

### **4. Validate Results**
```bash
npm run validate
```

## 🛠️ **Available Methods**

### **Method 1: Node.js Script (Recommended)**
- ✅ **Automated** - Handles everything
- ✅ **Error handling** and retry logic
- ✅ **Progress tracking** and reporting
- ✅ **Data validation** included

**Commands:**
```bash
npm run migrate          # Full migration
npm run migrate:dry-run  # Test run (no changes)
npm run migrate:no-auth  # Skip auth users migration
npm run validate         # Validate migration results
```

### **Method 2: SQL Export/Import**
- ✅ **Fast** for large datasets  
- ✅ **Direct** database-to-database
- ⚠️ **Manual** process required

**Files:**
- `compare-schemas.sql` - Compare database structures
- `export-data.sql` - Export data to CSV files
- `import-data.sql` - Import CSV files to new database

### **Method 3: Manual CSV Process**
- ✅ **Simple** for small datasets
- ✅ **Visual** verification possible
- ⚠️ **Time-consuming** for large data

## 📁 **File Overview**

| File | Purpose |
|------|---------|
| `migrate-database.js` | Main migration script (Node.js) |
| `validate-migration.js` | Validation and verification |
| `compare-schemas.sql` | Compare database structures |
| `export-data.sql` | Export data from source DB |
| `import-data.sql` | Import data to target DB |
| `env.template` | Environment variables template |
| `package.json` | Node.js dependencies |

## ⚙️ **Configuration**

### **Environment Variables (.env)**
```bash
# Source database (migrating FROM)
SOURCE_SUPABASE_URL=https://old-project.supabase.co
SOURCE_SUPABASE_SERVICE_KEY=eyJ...old_service_key

# Target database (migrating TO)  
TARGET_SUPABASE_URL=https://new-project.supabase.co
TARGET_SUPABASE_SERVICE_KEY=eyJ...new_service_key
```

### **Migration Options**
Edit `migrate-database.js` to customize:
```javascript
const config = {
  options: {
    batchSize: 100,        // Records per batch
    dryRun: false,         // Test mode (no changes)
    preserveIds: true,     // Keep original UUIDs
    migrateAuth: true,     // Include auth.users
    skipExisting: true,    // Skip duplicate records
  }
};
```

## 🔍 **What Gets Migrated**

### **✅ Included Data:**
- **Auth Users** (`auth.users`) - User accounts
- **User Profiles** (`user_profiles`) - Profile information
- **Resumes** (`resumes`) - Resume content and metadata
- **Resume Analyses** (`resume_analyses`) - Analysis results

### **⚠️ Manual Steps Required:**
- **Storage Files** - Resume file uploads (if any)
- **Custom Extensions** - Database functions/triggers
- **Environment Variables** - API keys, secrets
- **Domain Configuration** - Update API endpoints

## 📊 **Migration Process**

### **Step 1: Pre-Migration**
1. ✅ **Backup** both databases
2. ✅ **Compare schemas** using `compare-schemas.sql`
3. ✅ **Test connections** with dry run
4. ✅ **Estimate time** based on data volume

### **Step 2: Migration**
1. ✅ **Auth Users** (creates accounts)
2. ✅ **User Profiles** (preserves relationships)  
3. ✅ **Resumes** (maintains user associations)
4. ✅ **Resume Analyses** (preserves resume links)

### **Step 3: Post-Migration**
1. ✅ **Validate counts** and relationships
2. ✅ **Test functionality** in new database
3. ✅ **Update app configuration** 
4. ✅ **Monitor for issues**

## 🚨 **Important Notes**

### **Auth Migration Considerations:**
- **Passwords:** Users will need to reset passwords
- **Sessions:** All users will be logged out
- **OAuth:** Social logins may need re-authorization
- **Permissions:** Service role key required

### **Data Integrity:**
- **UUIDs preserved** to maintain relationships
- **Foreign keys validated** after migration
- **JSON data** preserved exactly as-is
- **Timestamps** maintained from original

### **Performance Tips:**
- **Large datasets:** Increase batch size to 500-1000
- **Slow networks:** Decrease batch size to 50-100
- **Memory issues:** Run during off-peak hours
- **Timeouts:** Use `--no-auth` if auth migration fails

## 🔧 **Troubleshooting**

### **Common Issues:**

**"Auth migration failed"**
```bash
# Skip auth migration, handle manually
npm run migrate:no-auth
```

**"Foreign key violations"**
```bash
# Check for missing relationships
npm run validate
```

**"Batch insert failed"**  
```bash
# Reduce batch size in config
# Edit migrate-database.js: batchSize: 50
```

**"Connection timeout"**
```bash
# Check your service role keys
# Verify database URLs are correct
```

### **Debug Mode:**
Enable detailed logging by editing the script:
```javascript
// Add this for more verbose output
console.log('DEBUG:', data);
```

## 📈 **Success Metrics**

After migration, you should see:
- ✅ **Matching record counts** between source and target
- ✅ **No orphaned records** (foreign key violations)
- ✅ **Sample data verification** shows correct content
- ✅ **Application functionality** works with new database

## 🎯 **Next Steps After Migration**

1. **Update App Configuration:**
   - Change `SUPABASE_URL` in your app
   - Update `SUPABASE_ANON_KEY` 
   - Test all functionality

2. **User Communication:**
   - Notify users about password reset requirement
   - Send re-authentication instructions
   - Monitor support channels for issues

3. **Monitoring:**
   - Watch error logs for migration issues
   - Monitor app performance
   - Track user sign-in success rates

## 🆘 **Need Help?**

1. **Check validation results:** `npm run validate`
2. **Review migration report** (auto-generated JSON file)
3. **Compare schemas** with `compare-schemas.sql`
4. **Test with small dataset** first using dry-run mode

**Your migration toolkit is ready! 🚀**
