"""
Test suite for Phase 1 Batch Lead Assignment feature
- Batch CRUD with assignedLeads field
- Notifications endpoints
- /batches/my endpoint for Trek Leads
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@bengalurutrekkers.com"
ADMIN_PASSWORD = "admin123456"

class TestBatchLeadAssignment:
    """Test batch lead assignment functionality"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token before each test"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Get Firebase auth token
        firebase_api_key = "AIzaSyCFl3n1PmSTN6eO4NdNDevIvFAmO78fV_M"
        auth_url = f"https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key={firebase_api_key}"
        
        auth_response = self.session.post(auth_url, json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD,
            "returnSecureToken": True
        })
        
        if auth_response.status_code == 200:
            self.token = auth_response.json().get("idToken")
            self.user_id = auth_response.json().get("localId")
            self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        else:
            pytest.skip(f"Authentication failed: {auth_response.text}")
    
    # === HEALTH CHECK ===
    def test_health_endpoint(self):
        """Test API health check"""
        response = self.session.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        print("✓ Health endpoint working")
    
    # === BATCHES ENDPOINT ===
    def test_get_batches(self):
        """Test GET /api/batches endpoint"""
        response = self.session.get(f"{BASE_URL}/api/batches")
        assert response.status_code == 200
        batches = response.json()
        assert isinstance(batches, list)
        print(f"✓ GET /api/batches returned {len(batches)} batches")
    
    def test_get_my_batches(self):
        """Test GET /api/batches/my endpoint for user's assigned batches"""
        response = self.session.get(f"{BASE_URL}/api/batches/my")
        assert response.status_code == 200
        batches = response.json()
        assert isinstance(batches, list)
        # Admin may not have batches assigned directly
        print(f"✓ GET /api/batches/my returned {len(batches)} assigned batches")
    
    # === USERS BASIC ENDPOINT ===
    def test_get_users_basic(self):
        """Test GET /api/users/basic endpoint for lead selector"""
        response = self.session.get(f"{BASE_URL}/api/users/basic")
        assert response.status_code == 200
        users = response.json()
        assert isinstance(users, list)
        
        # Verify user structure
        if len(users) > 0:
            user = users[0]
            assert "uid" in user
            assert "displayName" in user
            assert "role" in user
            print(f"✓ GET /api/users/basic returned {len(users)} users")
            for u in users[:3]:
                print(f"  - {u.get('displayName')} ({u.get('role')})")
        else:
            print("✓ GET /api/users/basic returned empty list")
    
    # === NOTIFICATION ENDPOINTS ===
    def test_get_notifications(self):
        """Test GET /api/notifications endpoint"""
        response = self.session.get(f"{BASE_URL}/api/notifications")
        assert response.status_code == 200
        notifications = response.json()
        assert isinstance(notifications, list)
        print(f"✓ GET /api/notifications returned {len(notifications)} notifications")
    
    def test_get_unread_count(self):
        """Test GET /api/notifications/unread-count endpoint"""
        response = self.session.get(f"{BASE_URL}/api/notifications/unread-count")
        assert response.status_code == 200
        data = response.json()
        assert "count" in data
        assert isinstance(data["count"], int)
        print(f"✓ GET /api/notifications/unread-count returned count: {data['count']}")
    
    def test_mark_all_read(self):
        """Test PATCH /api/notifications/read-all endpoint"""
        response = self.session.patch(f"{BASE_URL}/api/notifications/read-all")
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        print("✓ PATCH /api/notifications/read-all works correctly")
    
    # === BATCH CREATION WITH LEADS ===
    def test_create_batch_with_leads(self):
        """Test creating a batch with assigned leads"""
        # First get available users
        users_response = self.session.get(f"{BASE_URL}/api/users/basic")
        assert users_response.status_code == 200
        users = users_response.json()
        
        # Get treks for batch creation
        treks_response = self.session.get(f"{BASE_URL}/api/treks")
        assert treks_response.status_code == 200
        treks = treks_response.json()
        
        if len(treks) == 0:
            pytest.skip("No treks available for batch creation")
        
        trek_id = treks[0].get("id")
        
        # Prepare assigned leads (if users available)
        assigned_leads = []
        approved_users = [u for u in users if u.get("status") == "approved"]
        
        if len(approved_users) >= 2:
            assigned_leads = [
                {"userId": approved_users[0]["uid"], "displayName": approved_users[0]["displayName"], "isSuperLead": True},
                {"userId": approved_users[1]["uid"], "displayName": approved_users[1]["displayName"], "isSuperLead": False}
            ]
        elif len(approved_users) == 1:
            assigned_leads = [
                {"userId": approved_users[0]["uid"], "displayName": approved_users[0]["displayName"], "isSuperLead": True}
            ]
        
        # Create batch with unique code
        batch_code = f"TEST_{int(time.time())}"
        batch_data = {
            "batchCode": batch_code,
            "trekId": trek_id,
            "startDate": "2026-03-15",
            "endDate": "2026-03-17",
            "maxCapacity": 25,
            "currentRegistrations": 0,
            "status": "Open",
            "assignedLeads": assigned_leads,
            "transportVendor": "Test Transport",
            "stayVendor": "Test Stay",
            "internalNotes": "Test batch for lead assignment"
        }
        
        response = self.session.post(f"{BASE_URL}/api/batches", json=batch_data)
        assert response.status_code == 200, f"Failed to create batch: {response.text}"
        
        created_batch = response.json()
        assert created_batch["batchCode"] == batch_code
        assert created_batch["assignedLeads"] == assigned_leads
        assert "id" in created_batch
        
        print(f"✓ Created batch {batch_code} with {len(assigned_leads)} assigned leads")
        
        # Verify batch is retrievable
        get_response = self.session.get(f"{BASE_URL}/api/batches/{created_batch['id']}")
        assert get_response.status_code == 200
        fetched_batch = get_response.json()
        assert fetched_batch["assignedLeads"] == assigned_leads
        print(f"✓ Verified batch {batch_code} persisted with assignedLeads")
        
        # Store batch_id for cleanup
        self.__class__.test_batch_id = created_batch["id"]
        self.__class__.test_batch_code = batch_code
        return created_batch
    
    def test_update_batch_leads(self):
        """Test updating batch with modified lead assignments"""
        # Get existing batches
        response = self.session.get(f"{BASE_URL}/api/batches")
        assert response.status_code == 200
        batches = response.json()
        
        if len(batches) == 0:
            pytest.skip("No batches available for update test")
        
        # Find a test batch or use first one
        test_batch = None
        for b in batches:
            if b.get("batchCode", "").startswith("TEST_"):
                test_batch = b
                break
        
        if not test_batch:
            test_batch = batches[0]
        
        batch_id = test_batch["id"]
        
        # Get available users
        users_response = self.session.get(f"{BASE_URL}/api/users/basic")
        assert users_response.status_code == 200
        users = users_response.json()
        approved_users = [u for u in users if u.get("status") == "approved"]
        
        # Update with new leads
        new_leads = []
        if len(approved_users) > 0:
            new_leads = [
                {"userId": approved_users[0]["uid"], "displayName": approved_users[0]["displayName"], "isSuperLead": True}
            ]
        
        update_data = {"assignedLeads": new_leads}
        response = self.session.patch(f"{BASE_URL}/api/batches/{batch_id}", json=update_data)
        assert response.status_code == 200
        
        # Verify update
        get_response = self.session.get(f"{BASE_URL}/api/batches/{batch_id}")
        assert get_response.status_code == 200
        updated_batch = get_response.json()
        assert updated_batch["assignedLeads"] == new_leads
        
        print(f"✓ Updated batch {test_batch.get('batchCode')} leads successfully")
    
    # === DASHBOARD STATS ===
    def test_dashboard_stats(self):
        """Test GET /api/dashboard/stats endpoint"""
        response = self.session.get(f"{BASE_URL}/api/dashboard/stats")
        assert response.status_code == 200
        stats = response.json()
        
        # Verify expected fields
        assert "totalUpcomingBatches" in stats
        assert "totalActiveLeads" in stats
        assert "totalActiveTreks" in stats
        assert "completedBatchesThisMonth" in stats
        
        print(f"✓ Dashboard stats: {stats}")
    
    # === TREKS ENDPOINT ===
    def test_get_treks(self):
        """Test GET /api/treks endpoint"""
        response = self.session.get(f"{BASE_URL}/api/treks")
        assert response.status_code == 200
        treks = response.json()
        assert isinstance(treks, list)
        print(f"✓ GET /api/treks returned {len(treks)} treks")
    
    # === CLEANUP ===
    @pytest.fixture(scope="class", autouse=True)
    def cleanup_test_data(self, request):
        """Cleanup test batches after all tests complete"""
        yield
        # Cleanup would go here, but we'll leave test batches for manual verification


class TestNotificationFlow:
    """Test notification creation when batch is assigned"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token before each test"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        firebase_api_key = "AIzaSyCFl3n1PmSTN6eO4NdNDevIvFAmO78fV_M"
        auth_url = f"https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key={firebase_api_key}"
        
        auth_response = self.session.post(auth_url, json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD,
            "returnSecureToken": True
        })
        
        if auth_response.status_code == 200:
            self.token = auth_response.json().get("idToken")
            self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        else:
            pytest.skip(f"Authentication failed: {auth_response.text}")
    
    def test_notification_structure(self):
        """Test notification response structure"""
        response = self.session.get(f"{BASE_URL}/api/notifications")
        assert response.status_code == 200
        notifications = response.json()
        
        if len(notifications) > 0:
            notif = notifications[0]
            # Verify notification structure
            assert "id" in notif
            assert "userId" in notif
            assert "type" in notif
            assert "title" in notif
            assert "message" in notif
            assert "read" in notif
            print(f"✓ Notification structure verified")
            print(f"  Sample: {notif.get('title')} - {notif.get('message')}")
        else:
            print("✓ No notifications to verify structure (OK for admin)")
    
    def test_mark_individual_notification_read(self):
        """Test marking individual notification as read"""
        # Get notifications
        response = self.session.get(f"{BASE_URL}/api/notifications")
        assert response.status_code == 200
        notifications = response.json()
        
        if len(notifications) == 0:
            pytest.skip("No notifications to mark as read")
        
        notif_id = notifications[0]["id"]
        
        # Mark as read
        response = self.session.patch(f"{BASE_URL}/api/notifications/{notif_id}/read")
        assert response.status_code == 200
        print(f"✓ Marked notification {notif_id} as read")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
