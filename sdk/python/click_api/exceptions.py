"""
Click API Exceptions
"""


class ClickAPIError(Exception):
    """Base exception for Click API errors"""
    pass


class ClickAuthError(ClickAPIError):
    """Authentication error"""
    pass


class ClickRateLimitError(ClickAPIError):
    """Rate limit exceeded"""
    pass






