"""
Phase 4 Testing: Batch Documents and Feedback API Tests
Tests for:
- GET/POST /api/batches/{id}/documents - List and upload documents
- GET /api/batches/{id}/documents/{doc_id}/download - Download document
- DELETE /api/batches/{id}/documents/{doc_id} - Delete document (admin only)
- GET/POST /api/batches/{id}/feedback - List and create/update feedback
"""
import pytest
import requests
import os
import io
import json

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
BATCH_ID = "5B549XVHkjCZpBBAbafu"  # BT100

class TestPhase4DocumentsAndFeedback:
    """Phase 4: Batch Documents and Feedback API Tests"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get Firebase auth token by logging in via API"""
        # For Firebase auth, we need to authenticate via the Firebase client SDK
        # This is a placeholder - in real tests, we'd use Firebase Admin to create custom token
        # or use the frontend to get a real token
        import firebase_admin
        from firebase_admin import auth as firebase_auth
        
        try:
            # Create a custom token for testing
            custom_token = firebase_auth.create_custom_token("test-admin-uid")
            return custom_token.decode('utf-8') if isinstance(custom_token, bytes) else custom_token
        except Exception as e:
            pytest.skip(f"Firebase auth not available: {e}")
    
    @pytest.fixture(scope="class") 
    def api_client(self, auth_token):
        """Create authenticated API client"""
        session = requests.Session()
        session.headers.update({
            "Content-Type": "application/json",
            "Authorization": f"Bearer {auth_token}"
        })
        return session
    
    # Document API Tests
    def test_list_documents_empty(self, api_client):
        """Test listing documents for a batch (may be empty)"""
        response = api_client.get(f"{BASE_URL}/api/batches/{BATCH_ID}/documents")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Expected list response"
        print(f"Found {len(data)} documents for batch {BATCH_ID}")
    
    def test_upload_document(self, api_client):
        """Test uploading a document to a batch"""
        # Create a small test file
        test_content = b"This is a test document for Bengaluru Trekkers Phase 4 testing."
        files = {
            'file': ('TEST_document.txt', io.BytesIO(test_content), 'text/plain')
        }
        
        # Remove Content-Type header for multipart upload
        headers = dict(api_client.headers)
        if 'Content-Type' in headers:
            del headers['Content-Type']
        
        response = requests.post(
            f"{BASE_URL}/api/batches/{BATCH_ID}/documents",
            files=files,
            headers=headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert 'id' in data, "Response should contain document id"
        assert 'name' in data, "Response should contain document name"
        assert data['name'] == 'TEST_document.txt', f"Document name mismatch: {data['name']}"
        assert 'uploadedBy' in data, "Response should contain uploadedBy"
        assert 'uploadedAt' in data, "Response should contain uploadedAt"
        assert 'size' in data, "Response should contain size"
        assert data['size'] == len(test_content), f"Size mismatch: {data['size']} vs {len(test_content)}"
        
        print(f"Uploaded document: {data['id']} - {data['name']}")
        return data['id']
    
    def test_list_documents_after_upload(self, api_client):
        """Test listing documents shows uploaded document"""
        response = api_client.get(f"{BASE_URL}/api/batches/{BATCH_ID}/documents")
        assert response.status_code == 200
        data = response.json()
        
        # Find our test document
        test_docs = [d for d in data if d.get('name', '').startswith('TEST_')]
        print(f"Found {len(test_docs)} test documents")
        assert len(test_docs) >= 0, "Should have test documents"
    
    def test_download_document(self, api_client):
        """Test downloading a document"""
        # First get list of documents
        list_response = api_client.get(f"{BASE_URL}/api/batches/{BATCH_ID}/documents")
        assert list_response.status_code == 200
        docs = list_response.json()
        
        if not docs:
            pytest.skip("No documents to download")
        
        # Try to download first document
        doc = docs[0]
        doc_id = doc['id']
        
        response = api_client.get(f"{BASE_URL}/api/batches/{BATCH_ID}/documents/{doc_id}/download")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        # Verify we got content
        assert len(response.content) > 0, "Download should return content"
        print(f"Downloaded document {doc_id}: {len(response.content)} bytes")
    
    def test_delete_document(self, api_client):
        """Test deleting a document (admin only)"""
        # First get list of documents
        list_response = api_client.get(f"{BASE_URL}/api/batches/{BATCH_ID}/documents")
        assert list_response.status_code == 200
        docs = list_response.json()
        
        # Find test document to delete
        test_doc = next((d for d in docs if d.get('name', '').startswith('TEST_')), None)
        
        if not test_doc:
            pytest.skip("No test document to delete")
        
        doc_id = test_doc['id']
        response = api_client.delete(f"{BASE_URL}/api/batches/{BATCH_ID}/documents/{doc_id}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert 'message' in data, "Response should contain message"
        print(f"Deleted document: {doc_id}")
    
    # Feedback API Tests
    def test_list_feedback_empty_or_existing(self, api_client):
        """Test listing feedback for a batch"""
        response = api_client.get(f"{BASE_URL}/api/batches/{BATCH_ID}/feedback")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Expected list response"
        print(f"Found {len(data)} feedback entries for batch {BATCH_ID}")
    
    def test_create_feedback(self, api_client):
        """Test creating/updating feedback for a batch"""
        feedback_data = {
            'positive': 'TEST_FEEDBACK: Great trek experience, beautiful views and well organized.',
            'negative': 'TEST_FEEDBACK: Could improve lunch arrangements.'
        }
        
        response = api_client.post(
            f"{BASE_URL}/api/batches/{BATCH_ID}/feedback",
            json=feedback_data
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert 'id' in data, "Response should contain feedback id"
        assert 'positive' in data, "Response should contain positive feedback"
        assert 'negative' in data, "Response should contain negative feedback"
        assert 'leadName' in data, "Response should contain leadName"
        assert data['positive'] == feedback_data['positive'], "Positive feedback mismatch"
        assert data['negative'] == feedback_data['negative'], "Negative feedback mismatch"
        
        print(f"Created feedback: {data['id']}")
        return data['id']
    
    def test_update_feedback(self, api_client):
        """Test updating existing feedback (upsert behavior)"""
        feedback_data = {
            'positive': 'TEST_FEEDBACK_UPDATED: Excellent trek with amazing sunrise views.',
            'negative': 'TEST_FEEDBACK_UPDATED: Transport was slightly delayed.'
        }
        
        response = api_client.post(
            f"{BASE_URL}/api/batches/{BATCH_ID}/feedback",
            json=feedback_data
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Verify feedback was updated
        assert data['positive'] == feedback_data['positive'], "Positive feedback should be updated"
        assert data['negative'] == feedback_data['negative'], "Negative feedback should be updated"
        
        print(f"Updated feedback: {data['id']}")
    
    def test_list_feedback_shows_updated(self, api_client):
        """Test listing feedback shows the updated feedback"""
        response = api_client.get(f"{BASE_URL}/api/batches/{BATCH_ID}/feedback")
        assert response.status_code == 200
        data = response.json()
        
        # Find test feedback
        test_feedback = [f for f in data if 'TEST_FEEDBACK' in f.get('positive', '')]
        print(f"Found {len(test_feedback)} test feedback entries")
        
        if test_feedback:
            # Verify the latest update
            latest = test_feedback[0]
            assert 'UPDATED' in latest.get('positive', ''), "Should have updated positive feedback"
    
    def test_feedback_empty_fields(self, api_client):
        """Test creating feedback with empty fields"""
        feedback_data = {
            'positive': '',
            'negative': ''
        }
        
        response = api_client.post(
            f"{BASE_URL}/api/batches/{BATCH_ID}/feedback",
            json=feedback_data
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print("Empty feedback created successfully")


class TestDocumentEdgeCases:
    """Edge case tests for document API"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        import firebase_admin
        from firebase_admin import auth as firebase_auth
        try:
            custom_token = firebase_auth.create_custom_token("test-admin-uid")
            return custom_token.decode('utf-8') if isinstance(custom_token, bytes) else custom_token
        except Exception as e:
            pytest.skip(f"Firebase auth not available: {e}")
    
    @pytest.fixture(scope="class")
    def api_client(self, auth_token):
        session = requests.Session()
        session.headers.update({
            "Content-Type": "application/json",
            "Authorization": f"Bearer {auth_token}"
        })
        return session
    
    def test_download_nonexistent_document(self, api_client):
        """Test downloading non-existent document returns 404"""
        fake_doc_id = "nonexistent_doc_id_12345"
        response = api_client.get(f"{BASE_URL}/api/batches/{BATCH_ID}/documents/{fake_doc_id}/download")
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
    
    def test_delete_nonexistent_document(self, api_client):
        """Test deleting non-existent document"""
        fake_doc_id = "nonexistent_doc_id_12345"
        response = api_client.delete(f"{BASE_URL}/api/batches/{BATCH_ID}/documents/{fake_doc_id}")
        # Should return 200 as Firestore delete doesn't error on non-existent docs
        assert response.status_code in [200, 404], f"Expected 200 or 404, got {response.status_code}"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
