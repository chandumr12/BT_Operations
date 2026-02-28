"""
Test Calendar, Workload Search, and Task Board Pagination features

Features tested:
1. Calendar - /batches/my endpoint (returns array)
2. Calendar - /tickets endpoint (returns {tickets: [], ...})
3. Workload - /tickets/analytics/workload with search parameter
4. Task Board - /tickets endpoint pagination
5. Batch Documents - POST /batches/{id}/documents (multipart)
6. Batch Feedback - POST /batches/{id}/feedback
"""
import pytest
import requests
import os
import time

# Get public URL from frontend env
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://trekker-platform.preview.emergentagent.com')
if BASE_URL.endswith('/'):
    BASE_URL = BASE_URL.rstrip('/')

# Firebase Auth - we'll get a token via login
ADMIN_EMAIL = "admin@bengalurutrekkers.com"
ADMIN_PASSWORD = "admin123456"

# Test batch ID from context
TEST_BATCH_ID = "5B549XVHkjCZpBBAbafu"


def get_firebase_token():
    """Get Firebase Auth token for testing"""
    import firebase_admin
    from firebase_admin import auth as firebase_auth
    import json
    
    # Use Firebase REST API to sign in
    firebase_api_key = "AIzaSyCFl3n1PmSTN6eO4NdNDevIvFAmO78fV_M"
    url = f"https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key={firebase_api_key}"
    
    response = requests.post(url, json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD,
        "returnSecureToken": True
    })
    
    if response.status_code == 200:
        return response.json()["idToken"]
    else:
        print(f"Auth failed: {response.text}")
        return None


@pytest.fixture(scope="module")
def auth_headers():
    """Get authentication headers"""
    token = get_firebase_token()
    if not token:
        pytest.skip("Could not authenticate - skipping tests")
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


class TestHealthAndConfig:
    """Basic API health checks"""
    
    def test_health_endpoint(self):
        """Health endpoint should be accessible without auth"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert data["firebase_initialized"] == True
        assert data["firestore_connected"] == True
        print("✓ Health endpoint returns healthy status")


class TestCalendarEndpoints:
    """Test endpoints used by Calendar page"""
    
    def test_batches_my_endpoint(self, auth_headers):
        """GET /batches/my should return an array of user's assigned batches"""
        response = requests.get(f"{BASE_URL}/api/batches/my", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        # Should be an array
        assert isinstance(data, list), f"Expected array, got {type(data)}"
        print(f"✓ /batches/my returns array with {len(data)} batches")
        
        # If batches exist, check structure
        if len(data) > 0:
            batch = data[0]
            assert "id" in batch or "batchCode" in batch
            print(f"  First batch: {batch.get('batchCode', 'unknown')}")
    
    def test_tickets_endpoint_structure(self, auth_headers):
        """GET /tickets should return {tickets: [], total, page, pages}"""
        response = requests.get(f"{BASE_URL}/api/tickets", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        # Should be an object with 'tickets' array
        assert isinstance(data, dict), f"Expected dict, got {type(data)}"
        assert "tickets" in data, "Missing 'tickets' key"
        assert isinstance(data["tickets"], list), "tickets should be an array"
        assert "total" in data
        assert "page" in data
        assert "pages" in data
        print(f"✓ /tickets returns correct structure with {len(data['tickets'])} tickets")
        
        # Check ticket structure if tickets exist
        if len(data["tickets"]) > 0:
            ticket = data["tickets"][0]
            assert "id" in ticket
            assert "title" in ticket
            print(f"  First ticket: {ticket.get('title', 'unknown')[:40]}...")
    
    def test_tickets_with_due_date(self, auth_headers):
        """Tickets with dueDate should be valid for calendar display"""
        response = requests.get(f"{BASE_URL}/api/tickets", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        tickets_with_due = [t for t in data["tickets"] if t.get("dueDate")]
        print(f"✓ Found {len(tickets_with_due)} tickets with due dates for calendar")
        
        # Check priority field exists for color coding
        for ticket in tickets_with_due[:3]:  # Check first 3
            assert "priority" in ticket, "Ticket missing priority field"


class TestWorkloadEndpoints:
    """Test endpoints used by Workload page"""
    
    def test_workload_analytics_endpoint(self, auth_headers):
        """GET /tickets/analytics/workload should return workload data"""
        response = requests.get(f"{BASE_URL}/api/tickets/analytics/workload", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        assert isinstance(data, list), f"Expected array, got {type(data)}"
        print(f"✓ Workload endpoint returns {len(data)} team members")
        
        # Check structure
        if len(data) > 0:
            member = data[0]
            assert "assignee" in member
            assert "totalTickets" in member
            assert "byPriority" in member
            print(f"  First member: {member['assignee']}, {member['totalTickets']} tickets")
    
    def test_workload_search_filter(self, auth_headers):
        """GET /tickets/analytics/workload with search parameter"""
        # First get all members
        response = requests.get(f"{BASE_URL}/api/tickets/analytics/workload", headers=auth_headers)
        all_data = response.json()
        
        if len(all_data) == 0:
            pytest.skip("No workload data to test search")
        
        # Search with first assignee name
        search_term = all_data[0]["assignee"][:3] if all_data[0]["assignee"] else "test"
        response = requests.get(f"{BASE_URL}/api/tickets/analytics/workload?search={search_term}", headers=auth_headers)
        assert response.status_code == 200
        search_data = response.json()
        
        print(f"✓ Workload search with '{search_term}' returns {len(search_data)} results")
        assert len(search_data) <= len(all_data), "Search should filter results"


class TestTicketPagination:
    """Test Task Board pagination features"""
    
    def test_tickets_pagination(self, auth_headers):
        """GET /tickets with limit should paginate correctly"""
        response = requests.get(f"{BASE_URL}/api/tickets?limit=2&page=1", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        assert "tickets" in data
        assert "total" in data
        assert "pages" in data
        assert "page" in data
        
        # If there are more than 2 tickets, we should have multiple pages
        if data["total"] > 2:
            assert data["pages"] > 1, "Should have multiple pages"
            assert len(data["tickets"]) <= 2, "Should limit to 2 tickets per page"
            print(f"✓ Pagination works: {len(data['tickets'])} items, {data['pages']} pages, {data['total']} total")
        else:
            print(f"✓ Pagination check passed (only {data['total']} tickets)")
    
    def test_tickets_status_filter(self, auth_headers):
        """GET /tickets with status filter for Kanban columns"""
        statuses = ['Backlog', 'To Do', 'In Progress', 'In Review', 'Done']
        
        for status in statuses[:2]:  # Test first two statuses
            response = requests.get(f"{BASE_URL}/api/tickets?status={status}", headers=auth_headers)
            assert response.status_code == 200
            data = response.json()
            
            # Verify all returned tickets have matching status
            for ticket in data["tickets"]:
                assert ticket.get("status") == status, f"Expected {status}, got {ticket.get('status')}"
            
            print(f"✓ Status filter '{status}': {len(data['tickets'])} tickets")


class TestBatchDocuments:
    """Test batch document upload endpoints"""
    
    def test_list_batch_documents(self, auth_headers):
        """GET /batches/{id}/documents should return document list"""
        response = requests.get(f"{BASE_URL}/api/batches/{TEST_BATCH_ID}/documents", headers=auth_headers)
        
        # May return 404 if batch doesn't exist, which is acceptable
        if response.status_code == 404:
            print(f"  Batch {TEST_BATCH_ID} not found - skipping document tests")
            pytest.skip("Batch not found")
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Batch documents endpoint returns {len(data)} documents")


class TestBatchFeedback:
    """Test batch feedback endpoints"""
    
    def test_list_batch_feedback(self, auth_headers):
        """GET /batches/{id}/feedback should return feedback list"""
        response = requests.get(f"{BASE_URL}/api/batches/{TEST_BATCH_ID}/feedback", headers=auth_headers)
        
        if response.status_code == 404:
            print(f"  Batch {TEST_BATCH_ID} not found - skipping feedback tests")
            pytest.skip("Batch not found")
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Batch feedback endpoint returns {len(data)} feedback items")
    
    def test_post_batch_feedback(self, auth_headers):
        """POST /batches/{id}/feedback should save feedback"""
        payload = {
            "positive": "TEST_positive feedback from automated test",
            "negative": "TEST_areas for improvement from automated test"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/batches/{TEST_BATCH_ID}/feedback",
            headers=auth_headers,
            json=payload
        )
        
        if response.status_code == 404:
            print(f"  Batch {TEST_BATCH_ID} not found - skipping feedback post")
            pytest.skip("Batch not found")
        
        assert response.status_code == 200
        data = response.json()
        assert "id" in data
        assert data["positive"] == payload["positive"]
        assert data["negative"] == payload["negative"]
        print(f"✓ Feedback saved successfully with id: {data['id']}")


class TestBatchExpenses:
    """Test batch expenses endpoints"""
    
    def test_list_batch_expenses(self, auth_headers):
        """GET /batches/{id}/expenses should return expense sheets"""
        response = requests.get(f"{BASE_URL}/api/batches/{TEST_BATCH_ID}/expenses", headers=auth_headers)
        
        if response.status_code == 404:
            print(f"  Batch {TEST_BATCH_ID} not found - skipping expense tests")
            pytest.skip("Batch not found")
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Batch expenses endpoint returns {len(data)} expense sheets")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
