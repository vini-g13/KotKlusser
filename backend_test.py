#!/usr/bin/env python3
"""
Comprehensive Backend API Testing for KotKlusser System
Tests all authentication, ticket management, messaging, and stats endpoints
"""

import os
import requests
import sys
import json
from datetime import datetime
import base64
import io

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), 'backend', 'tests'))
from conftest import create_confirmed_test_user, unique_test_email  # noqa: E402

DEFAULT_BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'http://localhost:8000').rstrip('/') + '/api'


class KotKlusserAPITester:
    def __init__(self, base_url=DEFAULT_BASE_URL):
        self.base_url = base_url
        self.student_token = None
        self.landlord_token = None
        self.student_user = None
        self.landlord_user = None
        self.test_ticket_id = None
        self.test_property_id = None
        self.test_join_code = None
        self.test_tenant_id = None
        self.test_email_request_id = None
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
        success = status == 200 and "KotKlusser API is running" in response.get('message', '')
        self.log_test("Health Check", success, f"Status: {status}", response)
        return success

    def test_register_student(self):
        """Test student registration via Supabase Auth"""
        email = unique_test_email("student")
        try:
            user_id, token = create_confirmed_test_user(
                role="student", email=email, password="TestPass123!", name="Test Student",
                phone="+32 123 456 789",
            )
            self.student_token = token
            self.student_user = {"id": user_id, "email": email, "name": "Test Student"}
            self.log_test("Student Registration", True, f"User ID: {user_id}")
            return True
        except Exception as e:
            self.log_test("Student Registration", False, str(e))
            return False

    def test_register_landlord(self):
        """Test landlord registration via Supabase Auth"""
        email = unique_test_email("landlord")
        try:
            user_id, token = create_confirmed_test_user(
                role="landlord", email=email, password="TestPass123!", name="Test Landlord",
                phone="+32 987 654 321",
            )
            self.landlord_token = token
            self.landlord_user = {"id": user_id, "email": email, "name": "Test Landlord"}
            self.log_test("Landlord Registration", True, f"User ID: {user_id}")
            return True
        except Exception as e:
            self.log_test("Landlord Registration", False, str(e))
            return False

    def test_login_student(self):
        """Test student re-authentication (Supabase sign-in for an already-confirmed account)"""
        if not self.student_user:
            self.log_test("Student Login", False, "No student user to login")
            return False

        try:
            _, token = create_confirmed_test_user(
                role="student", email=self.student_user['email'], password="TestPass123!",
                name="Test Student",
            )
            success = bool(token)
            self.log_test("Student Login", success, "Login successful" if success else "No token returned")
            return success
        except Exception as e:
            self.log_test("Student Login", False, str(e))
            return False

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

    # ============ PROPERTY MANAGEMENT TESTS ============
    
    def test_create_property(self):
        """Test property creation by landlord"""
        if not self.landlord_token:
            self.log_test("Create Property", False, "No landlord token")
            return False
        
        test_data = {
            "name": f"Test Property {datetime.now().strftime('%H%M%S')}",
            "address": "Teststraat 123, 3000 Leuven"
        }
        
        status, response = self.make_request('POST', 'properties', test_data, self.landlord_token)
        success = status == 200 and 'id' in response and 'join_code' in response
        
        if success:
            self.test_property_id = response['id']
            self.test_join_code = response['join_code']
            self.log_test("Create Property", True, f"Property created: {response['name']}, Code: {self.test_join_code}")
        else:
            self.log_test("Create Property", False, f"Status {status}", response)
        
        return success

    def test_get_properties(self):
        """Test getting landlord properties"""
        if not self.landlord_token:
            self.log_test("Get Properties", False, "No landlord token")
            return False
        
        status, response = self.make_request('GET', 'properties', token=self.landlord_token)
        success = status == 200 and isinstance(response, list)
        
        if success:
            self.log_test("Get Properties", True, f"Retrieved {len(response)} properties")
        else:
            self.log_test("Get Properties", False, f"Status {status}", response)
        
        return success

    def test_get_property_detail(self):
        """Test getting specific property details"""
        if not self.landlord_token or not self.test_property_id:
            self.log_test("Get Property Detail", False, "No landlord token or property ID")
            return False
        
        status, response = self.make_request('GET', f'properties/{self.test_property_id}', token=self.landlord_token)
        success = status == 200 and response.get('id') == self.test_property_id
        
        if success:
            self.log_test("Get Property Detail", True, f"Property: {response['name']}, Tenants: {response['tenant_count']}")
        else:
            self.log_test("Get Property Detail", False, f"Status {status}", response)
        
        return success

    def test_regenerate_join_code(self):
        """Test regenerating join code"""
        if not self.landlord_token or not self.test_property_id:
            self.log_test("Regenerate Join Code", False, "No landlord token or property ID")
            return False
        
        old_code = self.test_join_code
        status, response = self.make_request('POST', f'properties/{self.test_property_id}/regenerate-code', token=self.landlord_token)
        success = status == 200 and response.get('join_code') != old_code
        
        if success:
            self.test_join_code = response['join_code']
            self.log_test("Regenerate Join Code", True, f"New code: {self.test_join_code}")
        else:
            self.log_test("Regenerate Join Code", False, f"Status {status}", response)
        
        return success

    def test_verify_join_code(self):
        """Test public join code verification"""
        if not self.test_join_code:
            self.log_test("Verify Join Code", False, "No join code available")
            return False
        
        status, response = self.make_request('GET', f'properties/by-code/{self.test_join_code}')
        success = status == 200 and 'property_name' in response
        
        if success:
            self.log_test("Verify Join Code", True, f"Code verified for: {response['property_name']}")
        else:
            self.log_test("Verify Join Code", False, f"Status {status}", response)
        
        return success

    def test_student_join_property(self):
        """Test student joining property via API"""
        if not self.student_token or not self.test_join_code:
            self.log_test("Student Join Property", False, "No student token or join code")
            return False
        
        test_data = {
            "join_code": self.test_join_code,
            "room_number": "101",
            "floor": "1"
        }
        
        status, response = self.make_request('POST', 'properties/join', test_data, self.student_token)
        success = status == 200 and 'property_id' in response
        
        if success:
            self.log_test("Student Join Property", True, f"Joined: {response['property_name']}")
        else:
            self.log_test("Student Join Property", False, f"Status {status}", response)
        
        return success

    def test_get_property_tenants(self):
        """Test getting property tenants"""
        if not self.landlord_token or not self.test_property_id:
            self.log_test("Get Property Tenants", False, "No landlord token or property ID")
            return False
        
        status, response = self.make_request('GET', f'properties/{self.test_property_id}/tenants', token=self.landlord_token)
        success = status == 200 and isinstance(response, list)
        
        if success:
            if len(response) > 0:
                self.test_tenant_id = response[0]['id']
                tenant_info = f"{response[0]['name']} in room {response[0]['room_number']}"
                self.log_test("Get Property Tenants", True, f"Found {len(response)} tenants: {tenant_info}")
            else:
                self.log_test("Get Property Tenants", True, "No tenants found (expected)")
        else:
            self.log_test("Get Property Tenants", False, f"Status {status}", response)
        
        return success

    def test_property_filtered_tickets(self):
        """Test getting tickets filtered by property"""
        if not self.landlord_token or not self.test_property_id:
            self.log_test("Property Filtered Tickets", False, "No landlord token or property ID")
            return False
        
        status, response = self.make_request('GET', f'tickets?property_id={self.test_property_id}', token=self.landlord_token)
        success = status == 200 and isinstance(response, list)
        
        if success:
            self.log_test("Property Filtered Tickets", True, f"Found {len(response)} tickets for property")
        else:
            self.log_test("Property Filtered Tickets", False, f"Status {status}", response)
        
        return success

    def test_dashboard_stats_with_property_filter(self):
        """Test dashboard stats with property filter"""
        if not self.landlord_token or not self.test_property_id:
            self.log_test("Dashboard Stats Property Filter", False, "No landlord token or property ID")
            return False
        
        status, response = self.make_request('GET', f'stats/dashboard?property_id={self.test_property_id}', token=self.landlord_token)
        success = status == 200 and 'total' in response
        
        if success:
            stats = f"Total: {response['total']}, Open: {response['open']}, Resolved: {response['resolved']}"
            self.log_test("Dashboard Stats Property Filter", True, stats)
        else:
            self.log_test("Dashboard Stats Property Filter", False, f"Status {status}", response)
        
        return success

    def test_remove_tenant(self):
        """Test removing tenant from property"""
        if not self.landlord_token or not self.test_property_id or not self.test_tenant_id:
            self.log_test("Remove Tenant", False, "Missing landlord token, property ID, or tenant ID")
            return False
        
        status, response = self.make_request('DELETE', f'properties/{self.test_property_id}/tenants/{self.test_tenant_id}', token=self.landlord_token)
        success = status == 200
        
        if success:
            self.log_test("Remove Tenant", True, "Tenant removed successfully")
        else:
            self.log_test("Remove Tenant", False, f"Status {status}", response)
        
        return success

    def test_property_access_control(self):
        """Test property access control - students can't create properties"""
        if not self.student_token:
            self.log_test("Property Access Control", False, "No student token")
            return False
        
        test_data = {
            "name": "Unauthorized Property",
            "address": "Should not work"
        }
        
        status, response = self.make_request('POST', 'properties', test_data, self.student_token)
        success = status == 403
        
        if success:
            self.log_test("Property Access Control", True, "Student correctly denied property creation")
        else:
            self.log_test("Property Access Control", False, f"Unexpected status {status}")
        
        return success

    def test_invalid_join_code(self):
        """Test invalid join code handling"""
        status, response = self.make_request('GET', 'properties/by-code/INVALID')
        success = status == 404
        
        if success:
            self.log_test("Invalid Join Code", True, "Invalid code correctly rejected")
        else:
            self.log_test("Invalid Join Code", False, f"Unexpected status {status}")
        
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

    # ============ PROFILE MANAGEMENT TESTS ============
    
    def test_get_profile(self):
        """Test getting user profile with split names"""
        if not self.student_token:
            self.log_test("Get Profile", False, "No student token")
            return False
        
        status, response = self.make_request('GET', 'profile', token=self.student_token)
        success = status == 200 and 'first_name' in response and 'last_name' in response and 'email' in response
        
        if success:
            self.log_test("Get Profile", True, f"Profile retrieved: {response['first_name']} {response['last_name']}")
        else:
            self.log_test("Get Profile", False, f"Status {status}", response)
        
        return success
    
    def test_update_profile_names(self):
        """Test updating profile names"""
        if not self.student_token:
            self.log_test("Update Profile Names", False, "No student token")
            return False
        
        test_data = {
            "first_name": "John",
            "last_name": "Doe Updated"
        }
        
        status, response = self.make_request('PATCH', 'profile', test_data, self.student_token)
        success = status == 200 and response.get('first_name') == 'John' and response.get('last_name') == 'Doe Updated'
        
        if success:
            self.log_test("Update Profile Names", True, f"Names updated: {response['first_name']} {response['last_name']}")
        else:
            self.log_test("Update Profile Names", False, f"Status {status}", response)
        
        return success
    
    def test_update_profile_phone(self):
        """Test updating profile phone number"""
        if not self.student_token:
            self.log_test("Update Profile Phone", False, "No student token")
            return False
        
        test_data = {
            "phone": "+32 987 654 321"
        }
        
        status, response = self.make_request('PATCH', 'profile', test_data, self.student_token)
        success = status == 200 and response.get('phone') == '+32 987 654 321'
        
        if success:
            self.log_test("Update Profile Phone", True, f"Phone updated: {response['phone']}")
        else:
            self.log_test("Update Profile Phone", False, f"Status {status}", response)
        
        return success
    
    def test_request_email_change(self):
        """Test requesting email address change"""
        if not self.student_token:
            self.log_test("Request Email Change", False, "No student token")
            return False
        
        test_data = {
            "new_email": f"newemail_{datetime.now().strftime('%H%M%S')}@test.com"
        }
        
        status, response = self.make_request('POST', 'profile/request-email-change', test_data, self.student_token)
        success = status == 200 and 'request_id' in response and 'new_email' in response
        
        if success:
            self.test_email_request_id = response['request_id']
            self.log_test("Request Email Change", True, f"Email change requested: {response['new_email']}")
        else:
            self.log_test("Request Email Change", False, f"Status {status}", response)
        
        return success
    
    def test_get_email_change_requests(self):
        """Test getting user's email change request history"""
        if not self.student_token:
            self.log_test("Get Email Change Requests", False, "No student token")
            return False
        
        status, response = self.make_request('GET', 'profile/email-change-requests', token=self.student_token)
        success = status == 200 and isinstance(response, list)
        
        if success:
            self.log_test("Get Email Change Requests", True, f"Found {len(response)} email change requests")
        else:
            self.log_test("Get Email Change Requests", False, f"Status {status}", response)
        
        return success
    
    def test_cancel_email_change_request(self):
        """Test canceling pending email change request"""
        if not self.student_token:
            self.log_test("Cancel Email Change Request", False, "No student token")
            return False
        
        status, response = self.make_request('DELETE', 'profile/email-change-request', token=self.student_token)
        success = status == 200 and 'message' in response
        
        if success:
            self.log_test("Cancel Email Change Request", True, response['message'])
        else:
            self.log_test("Cancel Email Change Request", False, f"Status {status}", response)
        
        return success
    
    def test_get_pending_email_requests_landlord(self):
        """Test getting pending email change requests as landlord"""
        if not self.landlord_token:
            self.log_test("Get Pending Email Requests (Landlord)", False, "No landlord token")
            return False
        
        status, response = self.make_request('GET', 'email-change-requests/pending', token=self.landlord_token)
        success = status == 200 and isinstance(response, list)
        
        if success:
            self.log_test("Get Pending Email Requests (Landlord)", True, f"Found {len(response)} pending requests")
        else:
            self.log_test("Get Pending Email Requests (Landlord)", False, f"Status {status}", response)
        
        return success
    
    def test_profile_with_pending_email_change(self):
        """Test profile response includes pending email change info"""
        if not self.student_token:
            self.log_test("Profile with Pending Email Change", False, "No student token")
            return False
        
        # First make a new email change request
        test_data = {"new_email": f"pending_{datetime.now().strftime('%H%M%S')}@test.com"}
        self.make_request('POST', 'profile/request-email-change', test_data, self.student_token)
        
        # Now get profile and check for pending request
        status, response = self.make_request('GET', 'profile', token=self.student_token)
        success = status == 200 and response.get('pending_email_change') is not None
        
        if success:
            pending = response['pending_email_change']
            self.log_test("Profile with Pending Email Change", True, f"Pending email: {pending['new_email']}")
        else:
            self.log_test("Profile with Pending Email Change", False, f"Status {status}", response)
        
        return success
    
    def test_duplicate_email_change_request(self):
        """Test preventing duplicate email change requests"""
        if not self.student_token:
            self.log_test("Duplicate Email Change Request", False, "No student token")
            return False
        
        test_data = {"new_email": f"duplicate_{datetime.now().strftime('%H%M%S')}@test.com"}
        
        # This should fail since there's already a pending request
        status, response = self.make_request('POST', 'profile/request-email-change', test_data, self.student_token)
        success = status == 400 and 'openstaand wijzigingsverzoek' in response.get('detail', '')
        
        if success:
            self.log_test("Duplicate Email Change Request", True, "Correctly prevented duplicate request")
        else:
            self.log_test("Duplicate Email Change Request", False, f"Status {status}", response)
        
        return success

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
        print(f"\n🚀 Starting KotKlusser Backend API Tests")
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
        
        # Property management tests
        print("\n🏢 Property Management Tests")
        self.test_create_property()
        self.test_get_properties()
        self.test_get_property_detail()
        self.test_regenerate_join_code()
        self.test_verify_join_code()
        self.test_student_join_property()
        self.test_get_property_tenants()
        self.test_property_access_control()
        self.test_invalid_join_code()
        
        # Profile management tests
        print("\n👤 Profile Management Tests")
        self.test_get_profile()
        self.test_update_profile_names()
        self.test_update_profile_phone()
        self.test_request_email_change()
        self.test_get_email_change_requests()
        self.test_profile_with_pending_email_change()
        self.test_duplicate_email_change_request()
        self.test_get_pending_email_requests_landlord()
        self.test_cancel_email_change_request()
        
        # Ticket management tests
        print("\n🎫 Ticket Management Tests")
        self.test_create_ticket()
        self.test_get_tickets_student()
        self.test_get_tickets_landlord()
        self.test_get_specific_ticket()
        self.test_update_ticket_status()
        self.test_ticket_filters()
        self.test_property_filtered_tickets()
        
        # Messaging tests
        print("\n💬 Messaging Tests")
        self.test_send_message_student()
        self.test_send_message_landlord()
        self.test_get_messages()
        
        # Dashboard and stats
        print("\n📊 Dashboard & Stats Tests")
        self.test_dashboard_stats()
        self.test_dashboard_stats_with_property_filter()
        self.test_send_reminders()
        
        # Photo upload
        print("\n📸 Photo Upload Tests")
        self.test_photo_upload()
        
        # Security tests
        print("\n🔒 Security & Error Handling Tests")
        self.test_unauthorized_access()
        self.test_invalid_ticket_access()
        self.test_role_restrictions()
        self.test_remove_tenant()
        
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
        tester = KotKlusserAPITester()
        success = tester.run_all_tests()
        return 0 if success else 1
    except Exception as e:
        print(f"💥 Test runner failed: {str(e)}")
        return 1

if __name__ == "__main__":
    sys.exit(main())