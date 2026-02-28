"""
Backend API Tests for Ticket/Task Management System
Tests CRUD operations for tickets, comments, and attachments
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://trekker-platform.preview.emergentagent.com').rstrip('/')

# Test credentials
TEST_EMAIL = "admin@bengalurutrekkers.com"
TEST_PASSWORD = "admin123456"


class TestHealthEndpoint:
    """Health check endpoint tests"""
    
    def test_health_check(self):
        """Test health endpoint returns healthy status"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        
        data = response.json()
        assert data["status"] == "healthy"
        assert "firebase_initialized" in data
        assert "firestore_connected" in data
        print(f"Health check passed: {data}")


class TestTicketCRUD:
    """Ticket CRUD operation tests"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get Firebase auth token for testing"""
        # For Firebase auth, we need to use the Firebase Auth REST API
        import requests
        
        FIREBASE_API_KEY = "AIzaSyCFl3n1PmSTN6eO4NdNDevIvFAmO78fV_M"
        
        # Sign in with email/password
        auth_url = f"https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key={FIREBASE_API_KEY}"
        
        response = requests.post(auth_url, json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD,
            "returnSecureToken": True
        })
        
        if response.status_code == 200:
            token = response.json().get("idToken")
            print(f"Authentication successful")
            return token
        else:
            print(f"Authentication failed: {response.text}")
            pytest.skip("Authentication failed - skipping authenticated tests")
    
    @pytest.fixture
    def auth_headers(self, auth_token):
        """Get headers with auth token"""
        return {
            "Authorization": f"Bearer {auth_token}",
            "Content-Type": "application/json"
        }
    
    def test_list_tickets(self, auth_headers):
        """Test listing all tickets"""
        response = requests.get(f"{BASE_URL}/api/tickets", headers=auth_headers)
        assert response.status_code == 200
        
        data = response.json()
        assert "tickets" in data or isinstance(data, list)
        print(f"Listed tickets successfully. Count: {len(data.get('tickets', data))}")
    
    def test_create_ticket(self, auth_headers):
        """Test creating a new ticket"""
        timestamp = int(time.time())
        ticket_data = {
            "title": f"TEST_API_Ticket_{timestamp}",
            "description": "Test ticket created by API test",
            "priority": "Medium",
            "status": "Backlog",
            "category": "Operations",
            "assignees": [],
            "dueDate": "2026-03-01",
            "estimatedHours": 5
        }
        
        response = requests.post(f"{BASE_URL}/api/tickets", json=ticket_data, headers=auth_headers)
        assert response.status_code == 200
        
        data = response.json()
        assert "id" in data
        assert data["title"] == ticket_data["title"]
        assert data["priority"] == ticket_data["priority"]
        print(f"Created ticket: {data['id']}")
        
        # Store ticket ID for later tests
        return data["id"]
    
    def test_get_ticket(self, auth_headers):
        """Test getting a single ticket by ID"""
        # First create a ticket
        timestamp = int(time.time())
        create_response = requests.post(f"{BASE_URL}/api/tickets", json={
            "title": f"TEST_GET_Ticket_{timestamp}",
            "description": "Test for GET endpoint",
            "priority": "High",
            "status": "To Do",
            "category": "Development"
        }, headers=auth_headers)
        
        assert create_response.status_code == 200
        ticket_id = create_response.json()["id"]
        
        # Now get the ticket
        response = requests.get(f"{BASE_URL}/api/tickets/{ticket_id}", headers=auth_headers)
        assert response.status_code == 200
        
        data = response.json()
        assert data["id"] == ticket_id
        assert data["title"] == f"TEST_GET_Ticket_{timestamp}"
        print(f"Got ticket: {data['title']}")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/tickets/{ticket_id}", headers=auth_headers)
    
    def test_update_ticket(self, auth_headers):
        """Test updating a ticket"""
        # First create a ticket
        timestamp = int(time.time())
        create_response = requests.post(f"{BASE_URL}/api/tickets", json={
            "title": f"TEST_UPDATE_Ticket_{timestamp}",
            "description": "Original description",
            "priority": "Low",
            "status": "Backlog",
            "category": "Operations"
        }, headers=auth_headers)
        
        assert create_response.status_code == 200
        ticket_id = create_response.json()["id"]
        
        # Update the ticket
        update_data = {
            "title": f"TEST_UPDATE_Ticket_{timestamp}_MODIFIED",
            "priority": "High",
            "status": "In Progress",
            "description": "Updated description"
        }
        
        response = requests.patch(f"{BASE_URL}/api/tickets/{ticket_id}", json=update_data, headers=auth_headers)
        assert response.status_code == 200
        
        # Verify the update
        get_response = requests.get(f"{BASE_URL}/api/tickets/{ticket_id}", headers=auth_headers)
        assert get_response.status_code == 200
        
        data = get_response.json()
        assert data["priority"] == "High"
        assert data["status"] == "In Progress"
        assert "MODIFIED" in data["title"]
        print(f"Updated ticket: {data['title']}")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/tickets/{ticket_id}", headers=auth_headers)
    
    def test_delete_ticket(self, auth_headers):
        """Test deleting a ticket"""
        # First create a ticket
        timestamp = int(time.time())
        create_response = requests.post(f"{BASE_URL}/api/tickets", json={
            "title": f"TEST_DELETE_Ticket_{timestamp}",
            "description": "This ticket will be deleted",
            "priority": "Medium",
            "status": "Backlog",
            "category": "Operations"
        }, headers=auth_headers)
        
        assert create_response.status_code == 200
        ticket_id = create_response.json()["id"]
        
        # Delete the ticket
        response = requests.delete(f"{BASE_URL}/api/tickets/{ticket_id}", headers=auth_headers)
        assert response.status_code == 200
        
        # Verify deletion
        get_response = requests.get(f"{BASE_URL}/api/tickets/{ticket_id}", headers=auth_headers)
        assert get_response.status_code == 404
        print(f"Deleted ticket: {ticket_id}")


class TestComments:
    """Comment functionality tests"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get Firebase auth token"""
        import requests
        FIREBASE_API_KEY = "AIzaSyCFl3n1PmSTN6eO4NdNDevIvFAmO78fV_M"
        
        auth_url = f"https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key={FIREBASE_API_KEY}"
        response = requests.post(auth_url, json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD,
            "returnSecureToken": True
        })
        
        if response.status_code == 200:
            return response.json().get("idToken")
        pytest.skip("Authentication failed")
    
    @pytest.fixture
    def auth_headers(self, auth_token):
        return {"Authorization": f"Bearer {auth_token}", "Content-Type": "application/json"}
    
    @pytest.fixture
    def test_ticket(self, auth_headers):
        """Create a test ticket for comment tests"""
        timestamp = int(time.time())
        response = requests.post(f"{BASE_URL}/api/tickets", json={
            "title": f"TEST_COMMENT_Ticket_{timestamp}",
            "description": "Ticket for comment testing",
            "priority": "Medium",
            "status": "Backlog",
            "category": "Operations"
        }, headers=auth_headers)
        
        ticket_id = response.json()["id"]
        yield ticket_id
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/tickets/{ticket_id}", headers=auth_headers)
    
    def test_add_comment(self, auth_headers, test_ticket):
        """Test adding a comment to a ticket"""
        timestamp = int(time.time())
        comment_data = {"text": f"Test comment {timestamp}"}
        
        response = requests.post(
            f"{BASE_URL}/api/tickets/{test_ticket}/comments",
            json=comment_data,
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "comment" in data
        assert data["comment"]["text"] == comment_data["text"]
        print(f"Added comment to ticket {test_ticket}")
        
        # Verify comment is in ticket
        get_response = requests.get(f"{BASE_URL}/api/tickets/{test_ticket}", headers=auth_headers)
        ticket_data = get_response.json()
        assert len(ticket_data.get("comments", [])) > 0


class TestAttachments:
    """Attachment functionality tests"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get Firebase auth token"""
        import requests
        FIREBASE_API_KEY = "AIzaSyCFl3n1PmSTN6eO4NdNDevIvFAmO78fV_M"
        
        auth_url = f"https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key={FIREBASE_API_KEY}"
        response = requests.post(auth_url, json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD,
            "returnSecureToken": True
        })
        
        if response.status_code == 200:
            return response.json().get("idToken")
        pytest.skip("Authentication failed")
    
    @pytest.fixture
    def auth_headers(self, auth_token):
        return {"Authorization": f"Bearer {auth_token}"}
    
    @pytest.fixture
    def test_ticket(self, auth_headers):
        """Create a test ticket for attachment tests"""
        timestamp = int(time.time())
        headers_with_json = {**auth_headers, "Content-Type": "application/json"}
        response = requests.post(f"{BASE_URL}/api/tickets", json={
            "title": f"TEST_ATTACH_Ticket_{timestamp}",
            "description": "Ticket for attachment testing",
            "priority": "Medium",
            "status": "Backlog",
            "category": "Operations"
        }, headers=headers_with_json)
        
        ticket_id = response.json()["id"]
        yield ticket_id
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/tickets/{ticket_id}", headers=headers_with_json)
    
    def test_upload_attachment(self, auth_headers, test_ticket):
        """Test uploading a file attachment"""
        # Create a test file
        test_content = b"This is test file content for attachment testing"
        files = {"file": ("test_file.txt", test_content, "text/plain")}
        
        response = requests.post(
            f"{BASE_URL}/api/tickets/{test_ticket}/attachments",
            files=files,
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "id" in data
        assert data["name"] == "test_file.txt"
        assert data["contentType"] == "text/plain"
        print(f"Uploaded attachment: {data['name']}")
        
        return data["id"]
    
    def test_download_attachment(self, auth_headers, test_ticket):
        """Test downloading an attachment"""
        # First upload a file
        test_content = b"Download test content"
        files = {"file": ("download_test.txt", test_content, "text/plain")}
        
        upload_response = requests.post(
            f"{BASE_URL}/api/tickets/{test_ticket}/attachments",
            files=files,
            headers=auth_headers
        )
        
        assert upload_response.status_code == 200
        file_id = upload_response.json()["id"]
        
        # Download the file
        download_response = requests.get(
            f"{BASE_URL}/api/attachments/{file_id}?ticket_id={test_ticket}",
            headers=auth_headers
        )
        
        assert download_response.status_code == 200
        assert download_response.content == test_content
        print(f"Downloaded attachment successfully")
    
    def test_delete_attachment(self, auth_headers, test_ticket):
        """Test deleting an attachment"""
        # First upload a file
        test_content = b"File to be deleted"
        files = {"file": ("delete_test.txt", test_content, "text/plain")}
        
        upload_response = requests.post(
            f"{BASE_URL}/api/tickets/{test_ticket}/attachments",
            files=files,
            headers=auth_headers
        )
        
        assert upload_response.status_code == 200
        file_id = upload_response.json()["id"]
        
        # Delete the attachment
        headers_with_json = {**auth_headers, "Content-Type": "application/json"}
        delete_response = requests.delete(
            f"{BASE_URL}/api/tickets/{test_ticket}/attachments/{file_id}",
            headers=headers_with_json
        )
        
        assert delete_response.status_code == 200
        print(f"Deleted attachment: {file_id}")
        
        # Verify it's gone
        ticket_response = requests.get(f"{BASE_URL}/api/tickets/{test_ticket}", headers=headers_with_json)
        ticket_data = ticket_response.json()
        attachment_ids = [a["id"] for a in ticket_data.get("attachments", [])]
        assert file_id not in attachment_ids


class TestFilters:
    """Filter and search functionality tests"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get Firebase auth token"""
        import requests
        FIREBASE_API_KEY = "AIzaSyCFl3n1PmSTN6eO4NdNDevIvFAmO78fV_M"
        
        auth_url = f"https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key={FIREBASE_API_KEY}"
        response = requests.post(auth_url, json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD,
            "returnSecureToken": True
        })
        
        if response.status_code == 200:
            return response.json().get("idToken")
        pytest.skip("Authentication failed")
    
    @pytest.fixture
    def auth_headers(self, auth_token):
        return {"Authorization": f"Bearer {auth_token}", "Content-Type": "application/json"}
    
    def test_filter_by_status(self, auth_headers):
        """Test filtering tickets by status"""
        response = requests.get(
            f"{BASE_URL}/api/tickets?status=To Do",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        tickets = data.get("tickets", data)
        
        # Verify all returned tickets have the correct status
        for ticket in tickets:
            assert ticket.get("status") == "To Do"
        print(f"Filtered by status 'To Do': {len(tickets)} tickets")
    
    def test_filter_by_priority(self, auth_headers):
        """Test filtering tickets by priority"""
        response = requests.get(
            f"{BASE_URL}/api/tickets?priority=High",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        tickets = data.get("tickets", data)
        
        for ticket in tickets:
            assert ticket.get("priority") == "High"
        print(f"Filtered by priority 'High': {len(tickets)} tickets")
    
    def test_search_tickets(self, auth_headers):
        """Test searching tickets by title/description"""
        # Create a unique ticket for search
        timestamp = int(time.time())
        unique_title = f"SEARCHTEST_{timestamp}"
        
        requests.post(f"{BASE_URL}/api/tickets", json={
            "title": unique_title,
            "description": "Unique ticket for search testing",
            "priority": "Medium",
            "status": "Backlog",
            "category": "Operations"
        }, headers=auth_headers)
        
        # Search for it
        response = requests.get(
            f"{BASE_URL}/api/tickets?search={unique_title}",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        tickets = data.get("tickets", data)
        
        # Should find the ticket
        found = any(unique_title in t.get("title", "") for t in tickets)
        assert found, f"Search did not find ticket with title {unique_title}"
        print(f"Search found ticket: {unique_title}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
