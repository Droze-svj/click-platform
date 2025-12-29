"""
Click API Python Client
"""

import requests
from typing import Optional, Dict, Any, List
from .exceptions import ClickAPIError, ClickAuthError, ClickRateLimitError


class ClickClient:
    """Click API Client for Python"""
    
    def __init__(
        self,
        api_key: str,
        base_url: str = "http://localhost:5001/api",
        version: str = "v1",
        timeout: int = 30
    ):
        self.api_key = api_key
        self.base_url = base_url.rstrip('/')
        self.version = version
        self.timeout = timeout
        
        self.session = requests.Session()
        self.session.headers.update({
            'Authorization': f'Bearer {self.api_key}',
            'X-API-Version': self.version,
            'Content-Type': 'application/json',
        })
    
    def _request(
        self,
        method: str,
        endpoint: str,
        data: Optional[Dict] = None,
        params: Optional[Dict] = None,
        files: Optional[Dict] = None
    ) -> Dict[str, Any]:
        """Make API request"""
        url = f"{self.base_url}/{self.version}/{endpoint.lstrip('/')}"
        
        try:
            response = self.session.request(
                method=method,
                url=url,
                json=data,
                params=params,
                files=files,
                timeout=self.timeout
            )
            
            if response.status_code == 401:
                raise ClickAuthError("Authentication failed")
            elif response.status_code == 429:
                raise ClickRateLimitError("Rate limit exceeded")
            elif response.status_code >= 400:
                error_msg = response.json().get('error', 'Unknown error')
                raise ClickAPIError(f"API Error: {error_msg}")
            
            return response.json()
        except requests.exceptions.RequestException as e:
            raise ClickAPIError(f"Request failed: {str(e)}")
    
    # Authentication
    def register(self, email: str, password: str, name: str) -> Dict[str, Any]:
        """Register a new user"""
        return self._request('POST', '/auth/register', data={
            'email': email,
            'password': password,
            'name': name,
        })
    
    def login(self, email: str, password: str) -> Dict[str, Any]:
        """Login user"""
        response = self._request('POST', '/auth/login', data={
            'email': email,
            'password': password,
        })
        # Update API key if token is returned
        if 'token' in response.get('data', {}):
            self.api_key = response['data']['token']
            self.session.headers['Authorization'] = f'Bearer {self.api_key}'
        return response
    
    def get_current_user(self) -> Dict[str, Any]:
        """Get current user"""
        return self._request('GET', '/auth/me')
    
    # Content
    def get_content(self, content_id: Optional[str] = None) -> Dict[str, Any]:
        """Get content"""
        if content_id:
            return self._request('GET', f'/content/{content_id}')
        return self._request('GET', '/content')
    
    def create_content(
        self,
        title: str,
        content_type: str,
        text: Optional[str] = None,
        platforms: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """Create content"""
        return self._request('POST', '/content/generate', data={
            'title': title,
            'type': content_type,
            'text': text,
            'platforms': platforms or [],
        })
    
    def update_content(self, content_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
        """Update content"""
        return self._request('PUT', f'/content/{content_id}', data=data)
    
    def delete_content(self, content_id: str) -> Dict[str, Any]:
        """Delete content"""
        return self._request('DELETE', f'/content/{content_id}')
    
    # Video
    def upload_video(
        self,
        file_path: str,
        title: Optional[str] = None,
        description: Optional[str] = None
    ) -> Dict[str, Any]:
        """Upload video"""
        with open(file_path, 'rb') as f:
            files = {'video': f}
            data = {}
            if title:
                data['title'] = title
            if description:
                data['description'] = description
            return self._request('POST', '/video/upload', data=data, files=files)
    
    # Analytics
    def get_analytics(self, period: int = 30) -> Dict[str, Any]:
        """Get analytics"""
        return self._request('GET', '/analytics/content', params={'period': period})
    
    # Search
    def search(
        self,
        query: str,
        content_type: Optional[str] = None,
        limit: int = 20
    ) -> Dict[str, Any]:
        """Search content"""
        params = {'query': query, 'limit': limit}
        if content_type:
            params['type'] = content_type
        return self._request('GET', '/search', params=params)






