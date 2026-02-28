"""
Phase 3: Batch Expense Sheet API Tests
Testing expense CRUD endpoints: 
- GET /api/batches/{id}/expenses - list all expenses for a batch
- GET /api/batches/{id}/expenses/my - get current user's expense
- POST /api/batches/{id}/expenses - create/update expense (upsert)
- DELETE /api/batches/{id}/expenses/{eid} - delete expense
"""
import pytest
import requests
import os
import time
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test data
TEST_EMAIL = "admin@bengalurutrekkers.com"
TEST_PASSWORD = "admin123456"

# Firebase Auth API
FIREBASE_API_KEY = "AIzaSyCFl3n1PmSTN6eO4NdNDevIvFAmO78fV_M"
FIREBASE_AUTH_URL = f"https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key={FIREBASE_API_KEY}"


class TestBatchExpenses:
    """Batch Expense Sheet API Tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session with authentication"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Authenticate
        auth_response = requests.post(FIREBASE_AUTH_URL, json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD,
            "returnSecureToken": True
        })
        assert auth_response.status_code == 200, f"Auth failed: {auth_response.text}"
        
        auth_data = auth_response.json()
        self.token = auth_data.get("idToken")
        assert self.token, "No token received"
        
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        print(f"Authenticated as {TEST_EMAIL}")
        
        # Get a valid batch ID for testing
        batches_response = self.session.get(f"{BASE_URL}/api/batches")
        assert batches_response.status_code == 200, f"Failed to get batches: {batches_response.text}"
        batches = batches_response.json()
        assert len(batches) > 0, "No batches available for testing"
        
        self.batch_id = batches[0]["id"]
        self.batch_code = batches[0].get("batchCode", "Unknown")
        print(f"Using batch ID: {self.batch_id} ({self.batch_code})")
        
        yield
        
        # Cleanup - no specific cleanup needed as upsert handles it

    def test_01_health_check(self):
        """Test API health endpoint"""
        response = self.session.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200, f"Health check failed: {response.text}"
        data = response.json()
        assert data.get("status") == "healthy", "API not healthy"
        print("PASS: Health check - API is healthy")

    def test_02_get_all_expenses_empty_or_existing(self):
        """Test GET /api/batches/{id}/expenses - list all expenses"""
        response = self.session.get(f"{BASE_URL}/api/batches/{self.batch_id}/expenses")
        assert response.status_code == 200, f"Failed to get expenses: {response.text}"
        
        expenses = response.json()
        assert isinstance(expenses, list), "Response should be a list"
        print(f"PASS: GET expenses - returned {len(expenses)} expense(s)")
        
        # If expenses exist, verify structure
        if len(expenses) > 0:
            exp = expenses[0]
            assert "id" in exp, "Expense should have id"
            assert "batchId" in exp, "Expense should have batchId"
            assert "userId" in exp, "Expense should have userId"
            assert "leadName" in exp, "Expense should have leadName"
            assert "totalSpent" in exp, "Expense should have calculated totalSpent"
            assert "remaining" in exp, "Expense should have calculated remaining"
            print(f"PASS: Expense structure validated - leadName: {exp.get('leadName')}")

    def test_03_get_my_expense_initial(self):
        """Test GET /api/batches/{id}/expenses/my - get current user's expense"""
        response = self.session.get(f"{BASE_URL}/api/batches/{self.batch_id}/expenses/my")
        # Should return 200 with either null or an expense object
        assert response.status_code == 200, f"Failed to get my expense: {response.text}"
        
        data = response.json()
        if data is None:
            print("PASS: GET my expense - no expense exists yet (null)")
        else:
            assert "id" in data, "Expense should have id"
            assert "totalSpent" in data, "Expense should have totalSpent"
            assert "remaining" in data, "Expense should have remaining"
            print(f"PASS: GET my expense - found existing expense with id: {data.get('id')}")

    def test_04_create_expense(self):
        """Test POST /api/batches/{id}/expenses - create new expense"""
        expense_data = {
            "amountCollected": "10000",
            "paidToDriver": "2000",
            "lunchPacking": "500",
            "parkingCharges": "200",
            "jeepCharges": "1500",
            "refundToCustomer": "0",
            "tickets": "800",
            "localGuide": "300",
            "leadsLunchExpenses": "400",
            "otherExpenses": "200",
            "otherExpensesRemarks": "TEST_Misc supplies"
        }
        
        response = self.session.post(
            f"{BASE_URL}/api/batches/{self.batch_id}/expenses",
            json=expense_data
        )
        assert response.status_code == 200, f"Failed to create expense: {response.text}"
        
        data = response.json()
        assert "id" in data, "Response should have expense id"
        assert data.get("batchId") == self.batch_id, "Batch ID should match"
        
        # Verify numeric conversion
        assert data.get("amountCollected") == 10000.0, f"amountCollected should be 10000.0, got {data.get('amountCollected')}"
        assert data.get("paidToDriver") == 2000.0, f"paidToDriver should be 2000.0, got {data.get('paidToDriver')}"
        
        # Verify calculations
        expected_spent = 2000 + 500 + 200 + 1500 + 0 + 800 + 300 + 400 + 200  # 5900
        expected_remaining = 10000 - expected_spent  # 4100
        
        assert data.get("totalSpent") == expected_spent, f"totalSpent should be {expected_spent}, got {data.get('totalSpent')}"
        assert data.get("remaining") == expected_remaining, f"remaining should be {expected_remaining}, got {data.get('remaining')}"
        
        print(f"PASS: Create expense - id: {data.get('id')}")
        print(f"       amountCollected: {data.get('amountCollected')}")
        print(f"       totalSpent: {data.get('totalSpent')}")
        print(f"       remaining: {data.get('remaining')}")
        
        self.expense_id = data.get("id")

    def test_05_verify_expense_persisted(self):
        """Test that created expense is persisted by GET"""
        response = self.session.get(f"{BASE_URL}/api/batches/{self.batch_id}/expenses/my")
        assert response.status_code == 200, f"Failed to get my expense: {response.text}"
        
        data = response.json()
        assert data is not None, "Expense should exist after creation"
        assert data.get("amountCollected") == 10000.0, "amountCollected should persist"
        assert data.get("otherExpensesRemarks") == "TEST_Misc supplies", "Remarks should persist"
        
        print("PASS: Expense persisted correctly")
        print(f"       leadName: {data.get('leadName')}")
        print(f"       totalSpent: {data.get('totalSpent')}")
        print(f"       remaining: {data.get('remaining')}")

    def test_06_update_expense_upsert(self):
        """Test POST /api/batches/{id}/expenses - update existing expense (upsert)"""
        updated_data = {
            "amountCollected": "15000",
            "paidToDriver": "3000",
            "lunchPacking": "600",
            "parkingCharges": "250",
            "jeepCharges": "2000",
            "refundToCustomer": "500",
            "tickets": "1000",
            "localGuide": "400",
            "leadsLunchExpenses": "500",
            "otherExpenses": "300",
            "otherExpensesRemarks": "TEST_Updated remarks"
        }
        
        response = self.session.post(
            f"{BASE_URL}/api/batches/{self.batch_id}/expenses",
            json=updated_data
        )
        assert response.status_code == 200, f"Failed to update expense: {response.text}"
        
        data = response.json()
        assert data.get("amountCollected") == 15000.0, "amountCollected should be updated to 15000"
        assert data.get("otherExpensesRemarks") == "TEST_Updated remarks", "Remarks should be updated"
        
        # Verify recalculated values
        expected_spent = 3000 + 600 + 250 + 2000 + 500 + 1000 + 400 + 500 + 300  # 8550
        expected_remaining = 15000 - expected_spent  # 6450
        
        assert data.get("totalSpent") == expected_spent, f"totalSpent should be {expected_spent}, got {data.get('totalSpent')}"
        assert data.get("remaining") == expected_remaining, f"remaining should be {expected_remaining}, got {data.get('remaining')}"
        
        print("PASS: Update expense (upsert) - values updated correctly")
        print(f"       amountCollected: {data.get('amountCollected')}")
        print(f"       totalSpent: {data.get('totalSpent')}")
        print(f"       remaining: {data.get('remaining')}")

    def test_07_get_all_expenses_contains_mine(self):
        """Test GET /api/batches/{id}/expenses - verify my expense in list"""
        response = self.session.get(f"{BASE_URL}/api/batches/{self.batch_id}/expenses")
        assert response.status_code == 200, f"Failed to get expenses: {response.text}"
        
        expenses = response.json()
        assert len(expenses) > 0, "Should have at least one expense"
        
        # Find my expense (admin's expense)
        my_expense = None
        for exp in expenses:
            if "TEST_Updated remarks" in str(exp.get("otherExpensesRemarks", "")):
                my_expense = exp
                break
        
        assert my_expense is not None, "My expense should be in the list"
        assert my_expense.get("totalSpent") > 0, "totalSpent should be calculated"
        assert my_expense.get("remaining") is not None, "remaining should be calculated"
        
        print(f"PASS: All expenses list contains my expense")
        print(f"       Total expenses in batch: {len(expenses)}")

    def test_08_expense_with_zero_values(self):
        """Test expense with zero/empty values handles correctly"""
        zero_data = {
            "amountCollected": "5000",
            "paidToDriver": "",
            "lunchPacking": "0",
            "parkingCharges": "",
            "jeepCharges": "",
            "refundToCustomer": "",
            "tickets": "",
            "localGuide": "",
            "leadsLunchExpenses": "",
            "otherExpenses": "",
            "otherExpensesRemarks": ""
        }
        
        response = self.session.post(
            f"{BASE_URL}/api/batches/{self.batch_id}/expenses",
            json=zero_data
        )
        assert response.status_code == 200, f"Failed with zero values: {response.text}"
        
        data = response.json()
        assert data.get("amountCollected") == 5000.0, "amountCollected should handle string '5000'"
        assert data.get("paidToDriver") == 0.0, "Empty string should become 0"
        assert data.get("lunchPacking") == 0.0, "String '0' should become 0.0"
        assert data.get("totalSpent") == 0.0, "totalSpent should be 0 with all zeros"
        assert data.get("remaining") == 5000.0, "remaining should equal amountCollected"
        
        print("PASS: Zero/empty values handled correctly")
        print(f"       totalSpent: {data.get('totalSpent')}")
        print(f"       remaining: {data.get('remaining')}")

    def test_09_expense_negative_remaining(self):
        """Test expense where totalSpent > amountCollected (negative remaining)"""
        overspent_data = {
            "amountCollected": "1000",
            "paidToDriver": "2000",  # Already more than collected
            "lunchPacking": "500",
            "parkingCharges": "100",
            "jeepCharges": "0",
            "refundToCustomer": "0",
            "tickets": "0",
            "localGuide": "0",
            "leadsLunchExpenses": "0",
            "otherExpenses": "0",
            "otherExpensesRemarks": "TEST_Overspent scenario"
        }
        
        response = self.session.post(
            f"{BASE_URL}/api/batches/{self.batch_id}/expenses",
            json=overspent_data
        )
        assert response.status_code == 200, f"Failed with overspent values: {response.text}"
        
        data = response.json()
        expected_spent = 2000 + 500 + 100  # 2600
        expected_remaining = 1000 - expected_spent  # -1600 (negative)
        
        assert data.get("totalSpent") == expected_spent, f"totalSpent should be {expected_spent}"
        assert data.get("remaining") == expected_remaining, f"remaining should be negative: {expected_remaining}"
        
        print("PASS: Negative remaining handled correctly")
        print(f"       amountCollected: {data.get('amountCollected')}")
        print(f"       totalSpent: {data.get('totalSpent')}")
        print(f"       remaining: {data.get('remaining')} (negative)")

    def test_10_invalid_batch_id(self):
        """Test expense endpoints with invalid batch ID"""
        invalid_batch = "INVALID_BATCH_ID_12345"
        
        # GET all expenses for invalid batch - should return empty list or 404
        response = self.session.get(f"{BASE_URL}/api/batches/{invalid_batch}/expenses")
        # This might return empty list [] or 404 depending on implementation
        assert response.status_code in [200, 404], f"Unexpected status: {response.status_code}"
        
        # POST to invalid batch should return 404
        response = self.session.post(
            f"{BASE_URL}/api/batches/{invalid_batch}/expenses",
            json={"amountCollected": "100"}
        )
        assert response.status_code == 404, f"Should return 404 for invalid batch: {response.status_code}"
        
        print("PASS: Invalid batch ID handled correctly")

    def test_11_cleanup_expense(self):
        """Cleanup: Reset expense to known state for future tests"""
        cleanup_data = {
            "amountCollected": "0",
            "paidToDriver": "0",
            "lunchPacking": "0",
            "parkingCharges": "0",
            "jeepCharges": "0",
            "refundToCustomer": "0",
            "tickets": "0",
            "localGuide": "0",
            "leadsLunchExpenses": "0",
            "otherExpenses": "0",
            "otherExpensesRemarks": ""
        }
        
        response = self.session.post(
            f"{BASE_URL}/api/batches/{self.batch_id}/expenses",
            json=cleanup_data
        )
        assert response.status_code == 200, f"Cleanup failed: {response.text}"
        
        print("PASS: Expense cleaned up successfully")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
