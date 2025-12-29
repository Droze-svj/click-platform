# Click API Python SDK

Official Python SDK for the Click API.

## Installation

```bash
pip install click-api-client
```

## Usage

### Basic Setup

```python
from click_api import ClickClient

client = ClickClient(
    api_key='your-api-key',
    base_url='https://api.click.com',
    version='v1'
)
```

### Authentication

```python
# Register
client.register('user@example.com', 'password123', 'User Name')

# Login
response = client.login('user@example.com', 'password123')
# Token is automatically stored

# Get current user
user = client.get_current_user()
```

### Content Management

```python
# Get all content
content = client.get_content()

# Get specific content
item = client.get_content('content-id')

# Create content
new_content = client.create_content(
    title='My Content',
    content_type='article',
    text='Content text here...',
    platforms=['twitter', 'linkedin']
)

# Update content
client.update_content('content-id', {'title': 'Updated Title'})

# Delete content
client.delete_content('content-id')
```

### Video Upload

```python
video = client.upload_video(
    'path/to/video.mp4',
    title='My Video',
    description='Video description'
)
```

### Search

```python
results = client.search('query', content_type='video', limit=20)
```

### Analytics

```python
analytics = client.get_analytics(period=30)  # 30 days
```

## Error Handling

```python
from click_api import ClickAPIError, ClickAuthError

try:
    content = client.get_content('invalid-id')
except ClickAuthError:
    print('Authentication failed')
except ClickAPIError as e:
    print(f'API Error: {e}')
```

## License

MIT






