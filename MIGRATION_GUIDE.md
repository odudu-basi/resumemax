# 📦 **Supabase Database Migration Guide**

## 🎯 **Migration Overview**

This guide helps you migrate users, resumes, and analyses from your old Supabase database to your new ResumeMax database.

## 📋 **Pre-Migration Checklist**

### **Information Needed:**
- [ ] **Old database URL** and **service role key**
- [ ] **New database URL** and **service role key** 
- [ ] **Schema differences** between old and new databases
- [ ] **Data volume** (number of users, resumes, analyses)

### **Tables to Migrate:**
1. ✅ **Auth Users** (`auth.users`) - User accounts
2. ✅ **User Profiles** (`user_profiles`) - Profile data  
3. ✅ **Resumes** (`resumes`) - Resume content
4. ✅ **Resume Analyses** (`resume_analyses`) - Analysis results
5. ⚠️ **Storage Files** (if any) - Resume files in storage

## 🚀 **Migration Methods**

### **Method 1: SQL Export/Import (Recommended)**
- ✅ **Fast** for large datasets
- ✅ **Maintains relationships**
- ✅ **Preserves UUIDs**

### **Method 2: Programmatic Migration**  
- ✅ **Data transformation** capabilities
- ✅ **Error handling** and validation
- ✅ **Progress tracking**

### **Method 3: CSV Export/Import**
- ✅ **Simple** for small datasets
- ⚠️ **Manual** UUID handling needed

## 📊 **Current Target Schema**

Your new database has these tables:
- `auth.users` - Supabase auth users
- `user_profiles` - Profile info (id, full_name, email, avatar_url)
- `resumes` - Resume data (id, user_id, title, file_url, content JSONB)
- `resume_analyses` - Analysis results (id, resume_id, user_id, job_title, analysis_results JSONB)

## ⚠️ **Important Considerations**

### **Auth Users Migration:**
- **Complex:** Supabase Auth has encrypted passwords
- **Recommendation:** Use Supabase CLI or admin API
- **Alternative:** Invite users to reset passwords

### **UUID Preservation:**
- **Critical:** Maintain user IDs to keep relationships
- **Foreign Keys:** Ensure user_id references stay intact

### **JSONB Data:**
- **Validate:** JSON structure between old/new schemas
- **Transform:** If field names/structure changed

## 🛠️ **Tools Provided**

1. **Schema Comparison Script** - Compare old vs new schemas
2. **Data Export Script** - Extract data from old database  
3. **Data Import Script** - Insert into new database
4. **Validation Script** - Verify migration success
5. **Rollback Script** - Undo migration if needed

## 📝 **Next Steps**

1. **Provide Source Database Info** - URL, key, schema differences
2. **Choose Migration Method** - SQL, programmatic, or CSV
3. **Test Migration** - Start with small dataset
4. **Full Migration** - Complete transfer
5. **Validation** - Verify all data transferred correctly

## 🔒 **Security Notes**

- ✅ **Service Role Keys** - Keep them secure
- ✅ **RLS Policies** - Will be automatically applied
- ✅ **Data Validation** - Check sensitive data handling
- ✅ **Backup** - Always backup before migration

Ready to start? Let's begin with understanding your source database structure!
