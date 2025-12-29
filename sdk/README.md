# Click API SDKs

Official SDKs for the Click API in multiple languages.

## Available SDKs

### JavaScript/TypeScript
- **Package**: `@click/api-client`
- **Location**: `sdk/javascript/`
- **Installation**: `npm install @click/api-client`
- **Documentation**: [JavaScript SDK README](./javascript/README.md)

### Python
- **Package**: `click-api-client`
- **Location**: `sdk/python/`
- **Installation**: `pip install click-api-client`
- **Documentation**: [Python SDK README](./python/README.md)

## Quick Start

### JavaScript

```javascript
import ClickClient from '@click/api-client';

const client = new ClickClient({
  apiKey: 'your-api-key',
  version: 'v1',
});

const content = await client.getContent();
```

### Python

```python
from click_api import ClickClient

client = ClickClient(api_key='your-api-key', version='v1')
content = client.get_content()
```

## Features

- ✅ Full TypeScript/Python type definitions
- ✅ Automatic token management
- ✅ Error handling
- ✅ API versioning support
- ✅ Request/response interceptors
- ✅ Rate limit handling

## Contributing

SDKs are generated from the OpenAPI specification. To update:

1. Update OpenAPI spec in `server/config/swagger.js`
2. Regenerate SDKs using code generators
3. Update documentation

## License

MIT






