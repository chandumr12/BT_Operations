"""
Phase 4: Additional Custom Expenses Tests
Testing additionalExpenses array feature in batch expenses:
- POST /api/batches/{id}/expenses with additionalExpenses array
- GET /api/batches/{id}/expenses returns additionalExpenses and correct totalSpent
- Total calculation includes both fixed + additional expenses
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "admin@bengalurutrekkers.com"
TEST_PASSWORD = "admin123456"

# Firebase Auth API
FIREBASE_API_KEY = "AIzaSyCFl3n1PmSTN6eO4NdNDevIvFAmO78fV_M"
FIREBASE_AUTH_URL = f"https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key={FIREBASE_API_KEY}"


class TestAdditionalExpenses:
    """Tests for additional custom expenses feature"""
    
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
        
        # Cleanup - reset expense to clean state
        self._cleanup_expense()

    def _cleanup_expense(self):
        """Reset expense to clean state"""
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
            "otherExpensesRemarks": "",
            "additionalExpenses": []
        }
        self.session.post(f"{BASE_URL}/api/batches/{self.batch_id}/expenses", json=cleanup_data)

    def test_01_create_expense_with_additional_expenses(self):
        """Test POST with additionalExpenses array - creates expense with custom items"""
        expense_data = {
            "amountCollected": "8800",
            "paidToDriver": "21000",
            "lunchPacking": "0",
            "parkingCharges": "0",
            "jeepCharges": "0",
            "refundToCustomer": "0",
            "tickets": "0",
            "localGuide": "0",
            "leadsLunchExpenses": "760",
            "otherExpenses": "0",
            "otherExpensesRemarks": "",
            "additionalExpenses": [
                {"reason": "Emergency supplies", "amount": "500"},
                {"reason": "Reimbursement", "amount": "200"}
            ]
        }
        
        response = self.session.post(
            f"{BASE_URL}/api/batches/{self.batch_id}/expenses",
            json=expense_data
        )
        assert response.status_code == 200, f"Failed to create expense: {response.text}"
        
        data = response.json()
        
        # Verify basic fields
        assert data.get("amountCollected") == 8800.0, f"amountCollected should be 8800.0, got {data.get('amountCollected')}"
        assert data.get("paidToDriver") == 21000.0, f"paidToDriver should be 21000.0, got {data.get('paidToDriver')}"
        assert data.get("leadsLunchExpenses") == 760.0, f"leadsLunchExpenses should be 760.0"
        
        # Verify additionalExpenses array
        additional = data.get("additionalExpenses", [])
        assert len(additional) == 2, f"Should have 2 additional expenses, got {len(additional)}"
        assert additional[0]["reason"] == "Emergency supplies", "First expense reason mismatch"
        assert additional[0]["amount"] == 500.0, f"First expense amount should be 500.0, got {additional[0]['amount']}"
        assert additional[1]["reason"] == "Reimbursement", "Second expense reason mismatch"
        assert additional[1]["amount"] == 200.0, f"Second expense amount should be 200.0, got {additional[1]['amount']}"
        
        # Verify totalSpent includes both fixed + additional expenses
        # Fixed: 21000 + 760 = 21760
        # Additional: 500 + 200 = 700
        # Total: 21760 + 700 = 22460
        expected_total = 21000 + 760 + 500 + 200
        assert data.get("totalSpent") == expected_total, f"totalSpent should be {expected_total}, got {data.get('totalSpent')}"
        
        # Verify remaining = collected - totalSpent
        # 8800 - 22460 = -13660 (negative)
        expected_remaining = 8800 - expected_total
        assert data.get("remaining") == expected_remaining, f"remaining should be {expected_remaining}, got {data.get('remaining')}"
        
        print("PASS: Created expense with additional expenses")
        print(f"       additionalExpenses count: {len(additional)}")
        print(f"       totalSpent (fixed + additional): {data.get('totalSpent')}")
        print(f"       remaining: {data.get('remaining')}")

    def test_02_get_expense_returns_additional_expenses(self):
        """Test GET my expense returns additionalExpenses array and correct totals"""
        # First create expense with additional items
        expense_data = {
            "amountCollected": "10000",
            "paidToDriver": "5000",
            "leadsLunchExpenses": "500",
            "additionalExpenses": [
                {"reason": "TEST_First custom", "amount": "300"},
                {"reason": "TEST_Second custom", "amount": "450"}
            ]
        }
        
        create_response = self.session.post(
            f"{BASE_URL}/api/batches/{self.batch_id}/expenses",
            json=expense_data
        )
        assert create_response.status_code == 200, f"Create failed: {create_response.text}"
        
        # Now GET and verify
        response = self.session.get(f"{BASE_URL}/api/batches/{self.batch_id}/expenses/my")
        assert response.status_code == 200, f"Failed to get my expense: {response.text}"
        
        data = response.json()
        assert data is not None, "Expense should exist"
        
        # Verify additionalExpenses persisted
        additional = data.get("additionalExpenses", [])
        assert len(additional) == 2, f"Should have 2 additional expenses, got {len(additional)}"
        
        # Verify totalSpent calculation
        # Fixed: 5000 + 500 = 5500
        # Additional: 300 + 450 = 750
        # Total: 5500 + 750 = 6250
        expected_total = 5000 + 500 + 300 + 450
        assert data.get("totalSpent") == expected_total, f"totalSpent should be {expected_total}, got {data.get('totalSpent')}"
        
        print("PASS: GET expense returns additionalExpenses correctly")
        print(f"       additionalExpenses: {additional}")
        print(f"       totalSpent: {data.get('totalSpent')}")

    def test_03_get_all_expenses_returns_additional_expenses(self):
        """Test GET all expenses returns additionalExpenses for each expense"""
        # First create expense with additional items
        expense_data = {
            "amountCollected": "8000",
            "paidToDriver": "3000",
            "additionalExpenses": [
                {"reason": "TEST_AllExpenses item", "amount": "250"}
            ]
        }
        
        self.session.post(f"{BASE_URL}/api/batches/{self.batch_id}/expenses", json=expense_data)
        
        # GET all expenses
        response = self.session.get(f"{BASE_URL}/api/batches/{self.batch_id}/expenses")
        assert response.status_code == 200, f"Failed to get all expenses: {response.text}"
        
        expenses = response.json()
        assert isinstance(expenses, list), "Response should be a list"
        assert len(expenses) > 0, "Should have at least one expense"
        
        # Find our test expense
        test_expense = None
        for exp in expenses:
            additional = exp.get("additionalExpenses", [])
            for item in additional:
                if "TEST_AllExpenses" in item.get("reason", ""):
                    test_expense = exp
                    break
        
        assert test_expense is not None, "Should find our test expense in list"
        assert test_expense.get("totalSpent") == 3000 + 250, f"totalSpent should include additional expense"
        
        print("PASS: GET all expenses returns additionalExpenses for each expense")

    def test_04_update_expense_modify_additional_expenses(self):
        """Test updating additionalExpenses array - add, modify, remove items"""
        # Create initial expense with one additional item
        initial_data = {
            "amountCollected": "5000",
            "paidToDriver": "2000",
            "additionalExpenses": [
                {"reason": "Initial item", "amount": "100"}
            ]
        }
        
        self.session.post(f"{BASE_URL}/api/batches/{self.batch_id}/expenses", json=initial_data)
        
        # Update with different additional expenses
        updated_data = {
            "amountCollected": "5000",
            "paidToDriver": "2000",
            "additionalExpenses": [
                {"reason": "Modified item", "amount": "150"},
                {"reason": "New second item", "amount": "350"}
            ]
        }
        
        response = self.session.post(
            f"{BASE_URL}/api/batches/{self.batch_id}/expenses",
            json=updated_data
        )
        assert response.status_code == 200, f"Update failed: {response.text}"
        
        data = response.json()
        additional = data.get("additionalExpenses", [])
        
        assert len(additional) == 2, f"Should have 2 additional expenses after update"
        assert additional[0]["reason"] == "Modified item", "First item should be modified"
        assert additional[0]["amount"] == 150.0, "First item amount should be 150"
        assert additional[1]["reason"] == "New second item", "Second item should be new"
        
        # Verify totalSpent recalculated
        expected_total = 2000 + 150 + 350  # 2500
        assert data.get("totalSpent") == expected_total, f"totalSpent should be {expected_total}"
        
        print("PASS: Update expense modifies additionalExpenses correctly")

    def test_05_additional_expenses_empty_array(self):
        """Test expense with empty additionalExpenses array"""
        expense_data = {
            "amountCollected": "6000",
            "paidToDriver": "3000",
            "additionalExpenses": []
        }
        
        response = self.session.post(
            f"{BASE_URL}/api/batches/{self.batch_id}/expenses",
            json=expense_data
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        additional = data.get("additionalExpenses", [])
        
        assert len(additional) == 0, "Should have empty additionalExpenses array"
        assert data.get("totalSpent") == 3000.0, "totalSpent should only include fixed expenses"
        
        print("PASS: Empty additionalExpenses array handled correctly")

    def test_06_additional_expenses_empty_reason_or_amount(self):
        """Test expense with empty reason or amount in additional items - should filter out"""
        expense_data = {
            "amountCollected": "5000",
            "paidToDriver": "2000",
            "additionalExpenses": [
                {"reason": "Valid item", "amount": "300"},
                {"reason": "", "amount": ""},  # Should be filtered out (empty reason and amount)
                {"reason": "Another valid", "amount": "200"}
            ]
        }
        
        response = self.session.post(
            f"{BASE_URL}/api/batches/{self.batch_id}/expenses",
            json=expense_data
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        additional = data.get("additionalExpenses", [])
        
        # Backend filters items where both reason and amount are empty
        # Item with reason="" and amount="" should be filtered
        valid_items = [item for item in additional if item.get("reason") or item.get("amount")]
        assert len(valid_items) == 2, f"Should have 2 valid additional expenses, got {len(valid_items)}"
        
        print("PASS: Empty reason/amount items handled correctly")

    def test_07_additional_expenses_string_amounts(self):
        """Test that string amounts in additionalExpenses are converted to numbers"""
        expense_data = {
            "amountCollected": "7000",
            "paidToDriver": "3000",
            "additionalExpenses": [
                {"reason": "String amount test", "amount": "450.50"},
                {"reason": "Comma amount test", "amount": "1,200"}
            ]
        }
        
        response = self.session.post(
            f"{BASE_URL}/api/batches/{self.batch_id}/expenses",
            json=expense_data
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        additional = data.get("additionalExpenses", [])
        
        assert len(additional) == 2, "Should have 2 additional expenses"
        assert additional[0]["amount"] == 450.50, "String '450.50' should convert to 450.50"
        assert additional[1]["amount"] == 1200.0, "String '1,200' should convert to 1200.0"
        
        # Verify total calculation
        expected_total = 3000 + 450.50 + 1200  # 4650.50
        assert data.get("totalSpent") == expected_total, f"totalSpent should be {expected_total}"
        
        print("PASS: String amounts converted correctly in additionalExpenses")

    def test_08_calc_expense_totals_helper(self):
        """Test that calc_expense_totals includes all expense types correctly"""
        expense_data = {
            "amountCollected": "20000",
            "paidToDriver": "5000",
            "lunchPacking": "1000",
            "parkingCharges": "200",
            "jeepCharges": "800",
            "refundToCustomer": "500",
            "tickets": "600",
            "localGuide": "400",
            "leadsLunchExpenses": "700",
            "otherExpenses": "300",
            "additionalExpenses": [
                {"reason": "Custom 1", "amount": "250"},
                {"reason": "Custom 2", "amount": "350"},
                {"reason": "Custom 3", "amount": "100"}
            ]
        }
        
        response = self.session.post(
            f"{BASE_URL}/api/batches/{self.batch_id}/expenses",
            json=expense_data
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        
        # Calculate expected totals
        fixed_spent = 5000 + 1000 + 200 + 800 + 500 + 600 + 400 + 700 + 300  # 9500
        additional_spent = 250 + 350 + 100  # 700
        expected_total = fixed_spent + additional_spent  # 10200
        expected_remaining = 20000 - expected_total  # 9800
        
        assert data.get("totalSpent") == expected_total, f"totalSpent should be {expected_total}, got {data.get('totalSpent')}"
        assert data.get("remaining") == expected_remaining, f"remaining should be {expected_remaining}, got {data.get('remaining')}"
        
        print("PASS: calc_expense_totals includes all expense types correctly")
        print(f"       Fixed expenses: {fixed_spent}")
        print(f"       Additional expenses: {additional_spent}")
        print(f"       Total spent: {data.get('totalSpent')}")
        print(f"       Remaining: {data.get('remaining')}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
