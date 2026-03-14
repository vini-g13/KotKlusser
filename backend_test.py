#!/usr/bin/env python3
"""
Comprehensive Backend API Testing for KotMelding System
Tests all authentication, ticket management, messaging, and stats endpoints
"""

import requests
import sys
import json
from datetime import datetime
import base64
import io

class KotMeldingAPITester:
    def __init__(self, base_url="https://kot-quick.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.student_token = None
        self.landlord_token = None
        self.student_user = None
        self.landlord_user = None
        self.test_ticket_id = None
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []

    def log_test(self, name, success, message="", response_data=None):
        """Log test results"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name}: {message}")
        else:
            self.failed_tests.append({"name": name, "error": message})
            print(f"❌ {name}: {message}")
            if response_data:
                print(f"   Response: {response_data}")

    def make_request(self, method, endpoint, data=None, token=None, files=None):
        """Make API request with proper headers"""
        url = f"{self.base_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        
        if token:
            headers['Authorization'] = f'Bearer {token}'
        
        if files:
            # Remove content-type for multipart
            headers.pop('Content-Type', None)
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers)
            elif method == 'POST':
                if files:
                    response = requests.post(url, files=files, headers=headers)
                else:
                    response = requests.post(url, json=data, headers=headers)
            elif method == 'PATCH':
                response = requests.patch(url, json=data, headers=headers)
            else:
                response = requests.request(method, url, json=data, headers=headers)
            
            return response.status_code, response.json() if response.content else {}
        except requests.exceptions.RequestException as e:
            return 500, {"error": str(e)}
        except json.JSONDecodeError:
            return response.status_code, {"error": "Invalid JSON response"}

    # ============ AUTHENTICATION TESTS ============
    
    def test_health_check(self):
        """Test API health endpoint"""
        status, response = self.make_request('GET', '')
        success = status == 200 and "KotMelding API is running" in response.get('message', '')
        self.log_test("Health Check", success, f"Status: {status}", response)
        return success

    def test_register_student(self):
        """Test student registration"""
        test_data = {
            "email": f"student_{datetime.now().strftime('%H%M%S')}@test.com",
            "password": "TestPass123!",
            "name": "Test Student",
            "role": "student",
            "phone": "+32 123 456 789"
        }
        
        status, response = self.make_request('POST', 'auth/register', test_data)
        success = status == 200 and 'token' in response and 'user' in response
        
        if success:
            self.student_token = response['token']
            self.student_user = response['user']
            self.log_test("Student Registration", True, f"User ID: {self.student_user['id']}")
        else:
            self.log_test("Student Registration", False, f"Status {status}", response)
        
        return success

    def test_register_landlord(self):
        """Test landlord registration"""
        test_data = {
            "email": f"landlord_{datetime.now().strftime('%H%M%S')}@test.com",
            "password": "TestPass123!",
            "name": "Test Landlord",
            "role": "landlord",
            "phone": "+32 987 654 321"
        }
        
        status, response = self.make_request('POST', 'auth/register', test_data)
        success = status == 200 and 'token' in response and 'user' in response
        
        if success:
            self.landlord_token = response['token']
            self.landlord_user = response['user']
            self.log_test("Landlord Registration", True, f"User ID: {self.landlord_user['id']}")
        else:
            self.log_test("Landlord Registration", False, f"Status {status}", response)
        
        return success

    def test_login_student(self):
        """Test student login"""
        if not self.student_user:
            self.log_test("Student Login", False, "No student user to login")
            return False
        
        test_data = {
            "email": self.student_user['email'],
            "password": "TestPass123!"
        }
        
        status, response = self.make_request('POST', 'auth/login', test_data)
        success = status == 200 and 'token' in response
        
        if success:
            self.log_test("Student Login", True, "Login successful")
        else:
            self.log_test("Student Login", False, f"Status {status}", response)
        
        return success

    def test_get_current_user(self):
        """Test get current user endpoint"""
        if not self.student_token:
            self.log_test("Get Current User", False, "No student token")
            return False
        
        status, response = self.make_request('GET', 'auth/me', token=self.student_token)
        success = status == 200 and 'id' in response and 'email' in response
        
        if success:
            self.log_test("Get Current User", True, f"User: {response['name']}")
        else:
            self.log_test("Get Current User", False, f"Status {status}", response)
        
        return success

    # ============ TICKET MANAGEMENT TESTS ============
    
    def test_create_ticket(self):
        """Test ticket creation"""
        if not self.student_token:
            self.log_test("Create Ticket", False, "No student token")
            return False
        
        test_data = {
            "title": "Test Defect - Lekkende Kraan",
            "description": "De kraan in de badkamer lekt en druppelt continu. Het probleem bestaat al sinds gisteren.",
            "category": "sanitair",
            "location": "badkamer",
            "urgency": "normaal"
        }
        
        status, response = self.make_request('POST', 'tickets', test_data, self.student_token)
        success = status == 200 and 'ticket_number' in response and 'id' in response
        
        if success:
            self.test_ticket_id = response['id']
            ticket_number = response['ticket_number']
            self.log_test("Create Ticket", True, f"Ticket {ticket_number} created")
        else:
            self.log_test("Create Ticket", False, f"Status {status}", response)
        
        return success

    def test_get_tickets_student(self):
        """Test getting tickets as student"""
        if not self.student_token:
            self.log_test("Get Student Tickets", False, "No student token")
            return False
        
        status, response = self.make_request('GET', 'tickets', token=self.student_token)
        success = status == 200 and isinstance(response, list)
        
        if success:
            ticket_count = len(response)
            self.log_test("Get Student Tickets", True, f"Found {ticket_count} tickets")
        else:
            self.log_test("Get Student Tickets", False, f"Status {status}", response)
        
        return success

    def test_get_tickets_landlord(self):
        """Test getting tickets as landlord"""
        if not self.landlord_token:
            self.log_test("Get Landlord Tickets", False, "No landlord token")
            return False
        
        status, response = self.make_request('GET', 'tickets', token=self.landlord_token)
        success = status == 200 and isinstance(response, list)
        
        if success:
            ticket_count = len(response)
            self.log_test("Get Landlord Tickets", True, f"Found {ticket_count} tickets")
        else:
            self.log_test("Get Landlord Tickets", False, f"Status {status}", response)
        
        return success

    def test_get_specific_ticket(self):
        """Test getting specific ticket details"""
        if not self.test_ticket_id or not self.student_token:
            self.log_test("Get Specific Ticket", False, "No ticket ID or token")
            return False
        
        status, response = self.make_request('GET', f'tickets/{self.test_ticket_id}', token=self.student_token)
        success = status == 200 and 'id' in response and 'ticket_number' in response
        
        if success:
            self.log_test("Get Specific Ticket", True, f"Ticket: {response['title']}")
        else:
            self.log_test("Get Specific Ticket", False, f"Status {status}", response)
        
        return success

    def test_update_ticket_status(self):
        """Test updating ticket status (landlord only)"""
        if not self.test_ticket_id or not self.landlord_token:
            self.log_test("Update Ticket Status", False, "No ticket ID or landlord token")
            return False
        
        test_data = {
            "status": "in_behandeling",
            "notes": "Reparateur is op de hoogte gebracht"
        }
        
        status, response = self.make_request('PATCH', f'tickets/{self.test_ticket_id}', test_data, self.landlord_token)
        success = status == 200 and response.get('status') == 'in_behandeling'
        
        if success:
            self.log_test("Update Ticket Status", True, f"Status updated to {response['status']}")
        else:
            self.log_test("Update Ticket Status", False, f"Status {status}", response)
        
        return success

    def test_ticket_filters(self):
        """Test ticket filtering"""
        if not self.landlord_token:
            self.log_test("Test Ticket Filters", False, "No landlord token")
            return False
        
        # Test filter by status
        status, response = self.make_request('GET', 'tickets?status=in_behandeling', token=self.landlord_token)
        success = status == 200 and isinstance(response, list)
        
        if success:
            self.log_test("Test Ticket Filters", True, f"Filtered tickets: {len(response)}")
        else:
            self.log_test("Test Ticket Filters", False, f"Status {status}", response)
        
        return success

    # ============ MESSAGING TESTS ============
    
    def test_send_message_student(self):
        """Test sending message as student"""
        if not self.test_ticket_id or not self.student_token:
            self.log_test("Send Message (Student)", False, "No ticket ID or student token")
            return False
        
        test_data = {
            "content": "Wanneer kan de reparateur langskomen? Het probleem wordt erger."
        }
        
        status, response = self.make_request('POST', f'tickets/{self.test_ticket_id}/messages', test_data, self.student_token)
        success = status == 200 and 'content' in response and 'sender_role' in response
        
        if success:
            self.log_test("Send Message (Student)", True, "Message sent successfully")
        else:
            self.log_test("Send Message (Student)", False, f"Status {status}", response)
        
        return success

    def test_send_message_landlord(self):
        """Test sending message as landlord"""
        if not self.test_ticket_id or not self.landlord_token:
            self.log_test("Send Message (Landlord)", False, "No ticket ID or landlord token")
            return False
        
        test_data = {
            "content": "De reparateur komt morgenochtend tussen 9:00 en 12:00 langs."
        }
        
        status, response = self.make_request('POST', f'tickets/{self.test_ticket_id}/messages', test_data, self.landlord_token)
        success = status == 200 and 'content' in response and 'sender_role' in response
        
        if success:
            self.log_test("Send Message (Landlord)", True, "Message sent successfully")
        else:
            self.log_test("Send Message (Landlord)", False, f"Status {status}", response)
        
        return success

    def test_get_messages(self):
        """Test getting ticket messages"""
        if not self.test_ticket_id or not self.student_token:
            self.log_test("Get Messages", False, "No ticket ID or token")
            return False
        
        status, response = self.make_request('GET', f'tickets/{self.test_ticket_id}/messages', token=self.student_token)
        success = status == 200 and isinstance(response, list)
        
        if success:
            message_count = len(response)
            self.log_test("Get Messages", True, f"Found {message_count} messages")
        else:
            self.log_test("Get Messages", False, f"Status {status}", response)
        
        return success

    # ============ STATS AND DASHBOARD TESTS ============
    
    def test_dashboard_stats(self):
        """Test dashboard statistics (landlord only)"""
        if not self.landlord_token:
            self.log_test("Dashboard Stats", False, "No landlord token")
            return False
        
        status, response = self.make_request('GET', 'stats/dashboard', token=self.landlord_token)
        success = status == 200 and 'total' in response and 'open' in response
        
        if success:
            stats = f"Total: {response['total']}, Open: {response['open']}, Resolved: {response['resolved']}"
            self.log_test("Dashboard Stats", True, stats)
        else:
            self.log_test("Dashboard Stats", False, f"Status {status}", response)
        
        return success

    def test_send_reminders(self):
        """Test sending reminders (landlord only)"""
        if not self.landlord_token:
            self.log_test("Send Reminders", False, "No landlord token")
            return False
        
        status, response = self.make_request('POST', 'admin/send-reminders', token=self.landlord_token)
        success = status == 200 and 'message' in response
        
        if success:
            self.log_test("Send Reminders", True, response['message'])
        else:
            self.log_test("Send Reminders", False, f"Status {status}", response)
        
        return success

    # ============ PHOTO UPLOAD TESTS ============
    
    def test_photo_upload(self):
        """Test photo upload to ticket"""
        if not self.test_ticket_id or not self.student_token:
            self.log_test("Photo Upload", False, "No ticket ID or token")
            return False
        
        # Create a small test image
        import io
        from PIL import Image
        
        try:
            # Create a simple test image
            img = Image.new('RGB', (100, 100), color='red')
            img_buffer = io.BytesIO()
            img.save(img_buffer, format='JPEG')
            img_buffer.seek(0)
            
            files = {'file': ('test.jpg', img_buffer, 'image/jpeg')}
            
            url = f"{self.base_url}/tickets/{self.test_ticket_id}/photos"
            headers = {'Authorization': f'Bearer {self.student_token}'}
            
            response = requests.post(url, files=files, headers=headers)
            
            success = response.status_code == 200 and 'photo' in response.json()
            
            if success:
                self.log_test("Photo Upload", True, "Photo uploaded successfully")
            else:
                self.log_test("Photo Upload", False, f"Status {response.status_code}", response.json())
            
            return success
            
        except ImportError:
            self.log_test("Photo Upload", False, "PIL not available, skipping photo test")
            return False
        except Exception as e:
            self.log_test("Photo Upload", False, f"Upload error: {str(e)}")
            return False

    # ============ ERROR HANDLING TESTS ============
    
    def test_unauthorized_access(self):
        """Test unauthorized access to protected endpoints"""
        status, response = self.make_request('GET', 'tickets')  # No token
        success = status == 403 or status == 401
        
        if success:
            self.log_test("Unauthorized Access", True, f"Correctly rejected with status {status}")
        else:
            self.log_test("Unauthorized Access", False, f"Unexpected status {status}")
        
        return success

    def test_invalid_ticket_access(self):
        """Test access to non-existent ticket"""
        if not self.student_token:
            self.log_test("Invalid Ticket Access", False, "No token")
            return False
        
        fake_ticket_id = "non-existent-ticket-id"
        status, response = self.make_request('GET', f'tickets/{fake_ticket_id}', token=self.student_token)
        success = status == 404
        
        if success:
            self.log_test("Invalid Ticket Access", True, "Correctly returned 404 for non-existent ticket")
        else:
            self.log_test("Invalid Ticket Access", False, f"Unexpected status {status}")
        
        return success

    def test_role_restrictions(self):
        """Test role-based access restrictions"""
        if not self.student_token:
            self.log_test("Role Restrictions", False, "No student token")
            return False
        
        # Student should not access dashboard stats
        status, response = self.make_request('GET', 'stats/dashboard', token=self.student_token)
        success = status == 403
        
        if success:
            self.log_test("Role Restrictions", True, "Student correctly denied access to landlord stats")
        else:
            self.log_test("Role Restrictions", False, f"Unexpected status {status}")
        
        return success

    # ============ MAIN TEST RUNNER ============
    
    def run_all_tests(self):
        """Run all tests in sequence"""
        print(f"\n🚀 Starting KotMelding Backend API Tests")
        print(f"📡 Testing API at: {self.base_url}")
        print("=" * 60)
        
        # Basic connectivity
        if not self.test_health_check():
            print("❌ Health check failed - API may be down")
            return False
        
        # Authentication tests
        print("\n📝 Authentication Tests")
        self.test_register_student()
        self.test_register_landlord()
        self.test_login_student()
        self.test_get_current_user()
        
        # Ticket management tests
        print("\n🎫 Ticket Management Tests")
        self.test_create_ticket()
        self.test_get_tickets_student()
        self.test_get_tickets_landlord()
        self.test_get_specific_ticket()
        self.test_update_ticket_status()
        self.test_ticket_filters()
        
        # Messaging tests
        print("\n💬 Messaging Tests")
        self.test_send_message_student()
        self.test_send_message_landlord()
        self.test_get_messages()
        
        # Dashboard and stats
        print("\n📊 Dashboard & Stats Tests")
        self.test_dashboard_stats()
        self.test_send_reminders()
        
        # Photo upload
        print("\n📸 Photo Upload Tests")
        self.test_photo_upload()
        
        # Security tests
        print("\n🔒 Security & Error Handling Tests")
        self.test_unauthorized_access()
        self.test_invalid_ticket_access()
        self.test_role_restrictions()
        
        # Results summary
        print("\n" + "=" * 60)
        print(f"📊 TEST RESULTS SUMMARY")
        print(f"✅ Passed: {self.tests_passed}/{self.tests_run}")
        print(f"❌ Failed: {len(self.failed_tests)}/{self.tests_run}")
        print(f"📈 Success Rate: {(self.tests_passed/self.tests_run*100):.1f}%")
        
        if self.failed_tests:
            print(f"\n❌ FAILED TESTS:")
            for test in self.failed_tests:
                print(f"   • {test['name']}: {test['error']}")
        
        # Return success if at least 80% pass
        success_rate = self.tests_passed / self.tests_run
        return success_rate >= 0.8

def main():
    """Main test runner"""
    try:
        tester = KotMeldingAPITester()
        success = tester.run_all_tests()
        return 0 if success else 1
    except Exception as e:
        print(f"💥 Test runner failed: {str(e)}")
        return 1

if __name__ == "__main__":
    sys.exit(main())