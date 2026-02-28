# Firebase Setup Guide for Bengaluru Trekkers OMS

This guide will help you set up Firebase for the Operations Management System.

## 📋 What You'll Need

1. Google account
2. 10-15 minutes of time
3. Access to Firebase Console

## Step-by-Step Firebase Configuration

### 1. Create Firebase Project (5 minutes)

1. Go to https://console.firebase.google.com/
2. Click **"Add project"** or **"Create a project"**
3. Enter project name: `bengaluru-trekkers-ops` (or your preference)
4. Click Continue
5. Disable Google Analytics (optional, but recommended for simplicity)
6. Click **"Create project"**
7. Wait for project creation (30-60 seconds)
8. Click **"Continue"** when ready

### 2. Enable Email/Password Authentication (2 minutes)

1. In the left sidebar, click **"Authentication"**
2. Click **"Get started"**
3. Click on the **"Sign-in method"** tab
4. Find **"Email/Password"** in the list
5. Click on it to expand
6. Toggle the switch to **Enable**
7. Click **"Save"**

### 3. Create Firestore Database (3 minutes)

1. In the left sidebar, click **"Firestore Database"**
2. Click **"Create database"**
3. Choose **"Start in production mode"**
   - Don't worry, we'll add security rules later
4. Select your location (choose closest to your users):
   - For India: `asia-south1 (Mumbai)`
   - Or use default
5. Click **"Enable"**
6. Wait for database creation (30-60 seconds)

### 4. Get Web App Configuration (5 minutes)

#### A. Register Web App

1. Go to **Project Settings** (gear icon near "Project Overview")
2. Scroll down to **"Your apps"** section
3. Click the **"</>"** icon (Web platform)
4. Enter app nickname: `Trek Ops Web App`
5. **Do NOT** check "Also set up Firebase Hosting"
6. Click **"Register app"**

#### B. Copy Configuration

You'll see a code snippet like this:

```javascript
const firebaseConfig = {
  apiKey: "AIzaSyB...",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123"
};
```

**Copy these values!** You'll need them in the next step.

### 5. Get Service Account Key for Backend (3 minutes)

1. Still in **Project Settings**
2. Click on **"Service accounts"** tab
3. Click **"Generate new private key"**
4. A warning dialog appears - click **"Generate key"**
5. A JSON file will download automatically
6. **Keep this file safe!** It contains sensitive credentials

### 6. Configure Application Environment Variables

#### Frontend Configuration

Edit the file `/app/frontend/.env` and replace these values:

```env
REACT_APP_FIREBASE_API_KEY=YOUR_API_KEY_HERE
REACT_APP_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=your-project-id
REACT_APP_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=123456789
REACT_APP_FIREBASE_APP_ID=1:123456789:web:abc123
```

Use the values from Step 4B (`firebaseConfig`).

#### Backend Configuration

1. Upload the downloaded JSON file (from Step 5) to `/app/backend/firebase-admin.json`
2. Edit `/app/backend/.env` and set:

```env
FIREBASE_CREDENTIALS_PATH="/app/backend/firebase-admin.json"
```

### 7. Set Up Firestore Security Rules (2 minutes)

1. Go to **Firestore Database** in Firebase Console
2. Click on the **"Rules"** tab
3. Replace all content with the following rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isAuthenticated() {
      return request.auth != null;
    }
    
    function getUserData() {
      return get(/databases/$(database)/documents/users/$(request.auth.uid)).data;
    }
    
    function isApproved() {
      return isAuthenticated() && getUserData().status == 'approved';
    }
    
    function hasRole(role) {
      return isApproved() && getUserData().role == role;
    }
    
    match /users/{userId} {
      allow read: if isAuthenticated();
      allow create: if isAuthenticated();
      allow update, delete: if hasRole('Super Admin');
    }
    
    match /treks/{trekId} {
      allow read: if isApproved();
      allow write: if hasRole('Super Admin') || hasRole('Operations Manager');
    }
    
    match /batches/{batchId} {
      allow read: if isApproved();
      allow write: if hasRole('Super Admin') || hasRole('Operations Manager') || hasRole('Coordinator');
    }
    
    match /leads/{leadId} {
      allow read: if isApproved();
      allow write: if hasRole('Super Admin') || hasRole('Operations Manager');
    }
    
    match /checklists/{checklistId} {
      allow read, write: if isApproved();
    }
  }
}
```

4. Click **"Publish"**

### 8. Restart Application

Run this command in your terminal:

```bash
sudo supervisorctl restart backend frontend
```

Wait for 10-15 seconds for services to restart.

### 9. Create Your Admin Account

1. Open your application URL in a browser
2. Click **"Sign Up"** tab
3. Enter:
   - Name: Your name
   - Email: `admin@bengalurutrekkers.com` (exactly this email!)
   - Password: Choose a strong password
   - Confirm Password: Same password
4. Click **"Sign Up"**
5. You'll be logged in automatically as **Super Admin**

**Important**: This email (`admin@bengalurutrekkers.com`) is hardcoded to get instant Super Admin access. Any other email will require admin approval.

## ✅ Verification Checklist

- [ ] Firebase project created
- [ ] Email/Password authentication enabled
- [ ] Firestore database created
- [ ] Web app registered and config copied
- [ ] Service account key downloaded
- [ ] Frontend `.env` updated with Firebase config
- [ ] Backend `.env` updated with credentials path
- [ ] Service account JSON file uploaded to backend
- [ ] Firestore security rules published
- [ ] Backend and frontend services restarted
- [ ] Admin account created successfully

## 🔧 Troubleshooting

### Issue: "Firebase not initialized" error

**Solution**: Check that:
1. Service account JSON file exists at `/app/backend/firebase-admin.json`
2. Path in `/app/backend/.env` is correct
3. JSON file is valid (open it to verify it's not corrupted)

### Issue: "Authentication failed" during login

**Solution**: 
1. Verify Email/Password is enabled in Firebase Console → Authentication
2. Check that frontend `.env` has correct Firebase config values
3. Clear browser cache and try again

### Issue: "Permission denied" when accessing data

**Solution**:
1. Verify Firestore security rules are published
2. Check that your user account has `status: 'approved'` in Firestore
3. Admin email must be exactly `admin@bengalurutrekkers.com`

### Issue: Services won't start after configuration

**Solution**:
```bash
# Check backend logs
tail -n 50 /var/log/supervisor/backend.err.log

# Check frontend logs
tail -n 50 /var/log/supervisor/frontend.err.log

# Restart again
sudo supervisorctl restart backend frontend
```

## 📞 Need Help?

If you encounter issues:

1. Check the logs (see above)
2. Verify all environment variables are set correctly
3. Ensure Firebase project is active in Firebase Console
4. Double-check that service account JSON is valid

## 🎉 You're All Set!

Once everything is configured, you can:
- Add treks
- Create batches
- Manage trek leads
- Assign team members
- Track operational checklists

Enjoy your new Operations Management System!
