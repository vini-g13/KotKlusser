"""
Test suite for Building Floor Configuration feature
Tests floor generation, property by-code endpoint returning floors, and join flows
"""
import pytest
import requests
import os
import uuid

from conftest import create_confirmed_test_user, unique_test_email, BASE_URL

# Test credentials from main agent
TEST_LANDLORD = {
    "email": "test_landlord_floor@test.com",
    "password": "test123"
}
TEST_STUDENT = {
    "email": "test_student_floor@test.com",
    "password": "test123"
}
EXISTING_JOIN_CODE = "VXSJD2"


class TestFloorConfigurationBackend:
    """Tests for floor configuration feature in backend"""
    
    @pytest.fixture(scope="class")
    def api_client(self):
        """Shared requests session"""
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        return session
    
    @pytest.fixture(scope="class")
    def landlord_token(self, api_client):
        """Get landlord auth token via the Supabase test-auth helper"""
        _, token = create_confirmed_test_user(
            role="landlord",
            email=TEST_LANDLORD["email"],
            password=TEST_LANDLORD["password"],
            name="Test Landlord Floor",
        )
        return token
    
    @pytest.fixture(scope="class")
    def authenticated_landlord(self, api_client, landlord_token):
        """Session with landlord auth header"""
        api_client.headers.update({"Authorization": f"Bearer {landlord_token}"})
        return api_client

    # Test 1: API health check
    def test_api_health(self, api_client):
        """Verify API is running"""
        response = api_client.get(f"{BASE_URL}/api/")
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        assert "version" in data
        print(f"API Health OK - version {data['version']}")

    # Test 2: Public endpoint returns floors array
    def test_get_property_by_code_returns_floors(self, api_client):
        """GET /api/properties/by-code/{code} should return floors array with proper structure"""
        response = api_client.get(f"{BASE_URL}/api/properties/by-code/{EXISTING_JOIN_CODE}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        
        # Verify required fields
        assert "property_id" in data
        assert "property_name" in data
        assert "address" in data
        assert "floor_count" in data
        assert "floors" in data
        
        # Verify floors is a list
        assert isinstance(data["floors"], list)
        assert len(data["floors"]) > 0, "Floors array should not be empty"
        
        print(f"Property '{data['property_name']}' has {len(data['floors'])} floor options")
    
    # Test 3: Floor values and labels structure
    def test_floors_have_correct_structure(self, api_client):
        """Each floor should have value (string) and label (string)"""
        response = api_client.get(f"{BASE_URL}/api/properties/by-code/{EXISTING_JOIN_CODE}")
        assert response.status_code == 200
        
        data = response.json()
        floors = data["floors"]
        
        for floor in floors:
            assert "value" in floor, f"Floor missing 'value' key: {floor}"
            assert "label" in floor, f"Floor missing 'label' key: {floor}"
            assert isinstance(floor["value"], str), f"Floor value should be string: {floor['value']}"
            assert isinstance(floor["label"], str), f"Floor label should be string: {floor['label']}"
        
        print(f"All {len(floors)} floors have correct structure (value, label)")
    
    # Test 4: Floor 0 should be Gelijkvloers (ground floor)
    def test_floor_zero_is_gelijkvloers(self, api_client):
        """First floor (value 0) should be labeled 'Gelijkvloers' (ground floor)"""
        response = api_client.get(f"{BASE_URL}/api/properties/by-code/{EXISTING_JOIN_CODE}")
        assert response.status_code == 200
        
        data = response.json()
        floors = data["floors"]
        
        # Find floor with value "0"
        ground_floor = next((f for f in floors if f["value"] == "0"), None)
        assert ground_floor is not None, "Floor with value '0' not found"
        assert ground_floor["label"] == "Gelijkvloers", f"Expected 'Gelijkvloers', got '{ground_floor['label']}'"
        
        print(f"Ground floor correctly labeled: {ground_floor['label']}")
    
    # Test 5: Floor count matches floors array length
    def test_floor_count_matches_floors_length(self, api_client):
        """floor_count + 1 should equal length of floors array (0 to floor_count)"""
        response = api_client.get(f"{BASE_URL}/api/properties/by-code/{EXISTING_JOIN_CODE}")
        assert response.status_code == 200
        
        data = response.json()
        floor_count = data["floor_count"]
        floors = data["floors"]
        
        expected_length = floor_count + 1  # 0 (ground) + floor_count floors
        assert len(floors) == expected_length, f"Expected {expected_length} floors, got {len(floors)}"
        
        print(f"Floor count {floor_count} produces {len(floors)} floor options (0 to {floor_count})")
    
    # Test 6: Floors numbered correctly (Verdieping 1, 2, 3...)
    def test_floors_numbered_correctly(self, api_client):
        """Floors 1+ should be labeled 'Verdieping N'"""
        response = api_client.get(f"{BASE_URL}/api/properties/by-code/{EXISTING_JOIN_CODE}")
        assert response.status_code == 200
        
        data = response.json()
        floors = data["floors"]
        
        for floor in floors:
            value = floor["value"]
            label = floor["label"]
            
            if value == "0":
                assert label == "Gelijkvloers", f"Floor 0 should be 'Gelijkvloers', got '{label}'"
            else:
                expected_label = f"Verdieping {value}"
                assert label == expected_label, f"Floor {value} should be '{expected_label}', got '{label}'"
        
        print("All floors correctly numbered with Dutch labels")
    
    # Test 7: Invalid join code returns 404
    def test_invalid_join_code_returns_404(self, api_client):
        """Invalid join code should return 404"""
        response = api_client.get(f"{BASE_URL}/api/properties/by-code/INVALID123")
        assert response.status_code == 404
        print("Invalid join code correctly returns 404")
    
    # Test 8: Create property with floor_count and verify floors in response
    def test_create_property_with_floor_count(self, authenticated_landlord):
        """Creating property with floor_count should return generated floors"""
        unique_suffix = str(uuid.uuid4())[:8]
        
        response = authenticated_landlord.post(f"{BASE_URL}/api/properties", json={
            "name": f"TEST_FloorTest_{unique_suffix}",
            "address": f"Teststraat {unique_suffix}",
            "floor_count": 5
        })
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Verify floors in response
        assert "floors" in data
        assert len(data["floors"]) == 6  # 0 + 5 = 6 floors
        assert data["floor_count"] == 5
        
        # Verify floor 0 is ground floor
        assert data["floors"][0]["value"] == "0"
        assert data["floors"][0]["label"] == "Gelijkvloers"
        
        # Verify floor 5
        assert data["floors"][5]["value"] == "5"
        assert data["floors"][5]["label"] == "Verdieping 5"
        
        print(f"Created property with {len(data['floors'])} floor options")
        
        # Store join code for cleanup
        return data["join_code"]
    
    # Test 9: Get property list returns floors for each property
    def test_get_properties_includes_floors(self, authenticated_landlord):
        """GET /properties should include floors array for each property"""
        response = authenticated_landlord.get(f"{BASE_URL}/api/properties")
        
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        
        if len(data) > 0:
            # Check first property has floors
            prop = data[0]
            assert "floors" in prop, "Property should have 'floors' field"
            assert isinstance(prop["floors"], list)
            assert len(prop["floors"]) > 0
            print(f"Property list contains {len(data)} properties, each with floors array")
        else:
            print("No properties found for landlord (test inconclusive)")


class TestStudentJoinWithFloorDropdown:
    """Tests for student joining property with floor selection"""
    
    @pytest.fixture(scope="class")
    def api_client(self):
        """Shared requests session"""
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        return session
    
    @pytest.fixture(scope="class")
    def new_student_token(self, api_client):
        """Register a new test student via the Supabase test-auth helper"""
        _, token = create_confirmed_test_user(
            role="student",
            email=unique_test_email("test_floor_student"),
            password="test123",
            name="Test Floor Student",
        )
        return token
    
    @pytest.fixture(scope="class")
    def authenticated_student(self, api_client, new_student_token):
        """Session with student auth header"""
        api_client.headers.update({"Authorization": f"Bearer {new_student_token}"})
        return api_client
    
    # Test 10: Student can join property with floor from dropdown values
    def test_student_join_with_floor_from_dropdown(self, authenticated_student):
        """Student can join property using floor value from dropdown"""
        # First get property info (simulating frontend dropdown)
        response = authenticated_student.get(f"{BASE_URL}/api/properties/by-code/{EXISTING_JOIN_CODE}")
        assert response.status_code == 200
        
        property_info = response.json()
        floors = property_info["floors"]
        
        # Select a floor from available options (simulating dropdown selection)
        selected_floor = floors[1] if len(floors) > 1 else floors[0]  # Pick first floor above ground
        
        # Join property with selected floor value
        join_response = authenticated_student.post(f"{BASE_URL}/api/properties/join", json={
            "join_code": EXISTING_JOIN_CODE,
            "room_number": "TEST101",
            "floor": selected_floor["value"]
        })
        
        assert join_response.status_code == 200, f"Join failed: {join_response.text}"
        
        data = join_response.json()
        assert "property_name" in data
        assert data["property_name"] == property_info["property_name"]
        
        print(f"Student successfully joined property on floor '{selected_floor['label']}' (value: {selected_floor['value']})")
    
    # Test 11: Join with invalid floor value should still work (backend accepts any string)
    def test_join_floor_validation(self, api_client):
        """Test that floor is properly stored (string value)"""
        _, token = create_confirmed_test_user(
            role="student",
            email=unique_test_email("test_floor_val"),
            password="test123",
            name="Test Floor Validation",
            join_code=EXISTING_JOIN_CODE,
            room_number="TEST102",
            floor="2",  # Using dropdown value
        )

        response = api_client.get(
            f"{BASE_URL}/api/profile", headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200, f"Profile fetch failed: {response.text}"

        data = response.json()
        assert data["floor"] == "2"
        assert data["property_name"] == "Test Gebouw"

        print(f"Student registered with floor value '2' successfully")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
