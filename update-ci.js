const fs = require('fs');
const ciPath = '.github/workflows/ci.yml';
let content = fs.readFileSync(ciPath, 'utf8');

// We will insert the E2E job
const e2eJob = `
  e2e:
    runs-on: ubuntu-latest
    services:
      mongodb:
        image: mongo:7
        ports:
          - 27017:27017
        options: >-
          --health-cmd "mongosh --eval 'db.adminCommand(\"ping\")'"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
      redis:
        image: redis:7
        ports:
          - 6379:6379
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
    - uses: actions/checkout@v3

    - name: Install pnpm
      uses: pnpm/action-setup@v2
      with:
        version: 8

    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '20'
        cache: 'pnpm'

    - name: Install dependencies
      run: pnpm install --no-frozen-lockfile

    - name: Build application
      run: pnpm run build
      env:
        NODE_ENV: production

    - name: Install Playwright Browsers
      run: pnpm dlx playwright install --with-deps chromium

    - name: Run E2E tests
      run: |
        # Start the application in production mode in the background
        pnpm run start:prod &
        # Wait for the backend and frontend to be ready
        npx wait-on http://localhost:5001/api/health http://localhost:3010
        # Run playwright tests
        pnpm run test:critical
      env:
        NODE_ENV: test
        MONGODB_URI: mongodb://localhost:27017/click-test
        JWT_SECRET: test-secret-key
        REDIS_URL: redis://localhost:6379
        E2E_BASE_URL: http://localhost:3010
        E2E_API_URL: http://localhost:5001/api/health

    - uses: actions/upload-artifact@v4
      if: always()
      with:
        name: playwright-report
        path: playwright-report/
        retention-days: 14
`;

if (!content.includes('e2e:')) {
  // append it before `build:` job
  content = content.replace('\n  build:', '\n' + e2eJob + '\n  build:');
  fs.writeFileSync(ciPath, content, 'utf8');
  console.log('Added e2e job to ci.yml');
} else {
  console.log('e2e job already exists');
}
