# PAN Parrot 🦜

> **Internal HTTP Webhook Inspection & Mocking Platform for Palo Alto Networks**

PAN Parrot is a self-hosted clone of Beeceptor, designed specifically for internal use at Palo Alto Networks. It allows developers to create custom HTTP endpoints, capture requests in real-time, inspect payloads, and configure mock responses for API development and testing.

![PAN Parrot Demo](https://img.shields.io/badge/Status-Production%20Ready-green)
![Tech Stack](https://img.shields.io/badge/Tech-React%20%7C%20Express%20%7C%20TypeScript-blue)
![License](https://img.shields.io/badge/License-Internal%20Use-red)

## 🎯 Features

- **Dynamic Endpoint Creation** - Generate custom or UUID-based endpoints instantly
- **Real-time Request Capture** - Monitor HTTP requests with live streaming
- **Request Inspection** - Full payload analysis (headers, body, query params, IP, timestamp)
- **Request Replay** - Modify and replay captured requests with custom parameters
- **Mock Response Configuration** - Set up conditional responses with delays and custom status codes
- **User Management** - Admin panel for user account management
- **Role-based Access Control** - Admin vs User permissions
- **Rate Limiting** - Built-in protection against abuse
- **Internal Security** - Designed for corporate network deployment

## 🏗️ Architecture

### Tech Stack

**Frontend:**

- **React 18** with TypeScript
- **React Router 6** (SPA mode)
- **TailwindCSS 3** for styling
- **Radix UI** component library
- **Vite** for build tooling
- **Tanstack Query** for data fetching

**Backend:**

- **Express.js** with TypeScript
- **Zod** for validation
- **CORS** enabled
- **In-memory storage** (easily replaceable with database)

**Development:**

- **Vitest** for testing
- **ESLint** + **Prettier** for code quality
- **Hot reload** for both client and server

### System Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Web Client    │◄──►│   Express API    │◄──►│   Data Store    │
│  (React SPA)    │    │  (TypeScript)    │    │  (In-Memory)    ��
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │                       │
         │              ┌────────▼────────┐             │
         │              │  Dynamic Routes │             │
         │              │ /catch/:path    │             │
         │              └─────────────────┘             │
         │                                              │
         └──────────────────────────────────────────────┘
                    Real-time Updates (HTTP Polling)
```

## 🚀 Quick Start

### Prerequisites

- **Node.js 18+**
- **npm** or **yarn**
- **Git**

### Development Setup

```bash
# 1. Clone the repository
git clone <repository-url>
cd pan-parrot

# 2. Install dependencies
npm install

# 3. Start development server
npm run dev

# 4. Access the application
open http://localhost:8080
```

### Default Credentials

```
Admin Account:
- Email: ashamah@paloaltonetworks.com
- Password: admin2024!

Test Account:
- Email: test@paloaltonetworks.com
- Password: test123
```

## 📁 Project Structure

```
pan-parrot/
├── client/                    # React frontend
│   ├── components/           # Reusable UI components
│   │   ├── ui/              # Radix UI components
│   │   ├── Logo.tsx         # PAN Parrot branding
│   │   ├── CreateEndpointDialog.tsx
│   │   ├── RequestReplayDialog.tsx
│   │   └── MockResponseDialog.tsx
│   ├── hooks/               # Custom React hooks
│   │   ├── use-auth.tsx     # Authentication context
│   │   └── use-toast.ts     # Toast notifications
│   ├── lib/                 # Utility libraries
│   │   ├── api.ts           # API client functions
│   │   └── utils.ts         # General utilities
│   ├── pages/               # Route components
│   │   ├── Index.tsx        # Homepage
│   │   ├── Login.tsx        # Authentication
│   │   ├── Dashboard.tsx    # Main app interface
│   │   ├── Admin.tsx        # User management
│   │   ├── Docs.tsx         # Documentation
│   │   └── NotFound.tsx     # 404 page
│   ├── App.tsx              # Main app component & routing
│   └── global.css           # TailwindCSS & theme
├── server/                  # Express backend
│   ├── routes/              # API route handlers
│   │   ├── admin.ts         # User management endpoints
│   │   ├── parrot.ts        # Core HTTP inspection logic
│   │   └── demo.ts          # Example endpoint
│   ├── index.ts             # Express server setup
│   └── node-build.ts        # Production build entry
├── shared/                  # Shared TypeScript types
│   └── api.ts               # API interfaces
├── scripts/                 # Deployment & maintenance
│   └── backup.sh            # Backup/restore script
├── k8s/                     # Kubernetes manifests
│   └── deployment.yaml      # K8s deployment config
├── deploy.sh                # Automated deployment script
├── docker-compose.yml       # Docker composition
├── Dockerfile               # Container definition
└── nginx.conf               # Reverse proxy config
```

## 🔌 API Reference

### Authentication Endpoints

```typescript
POST /api/auth/login
Body: { email: string, password: string }
Response: { user: User, token: string }

GET /api/auth/user
Headers: { Authorization: "Bearer <token>" }
Response: User
```

### Endpoint Management

```typescript
POST /api/endpoints
Headers: { Authorization: "Bearer <token>" }
Body: { name: string, customPath?: string, description?: string }
Response: UserEndpoint

GET /api/endpoints
Headers: { Authorization: "Bearer <token>" }
Response: UserEndpoint[]

DELETE /api/endpoints/:endpointId
Headers: { Authorization: "Bearer <token>" }
Response: { message: string }

POST /api/endpoints/:endpointId/mock
Headers: { Authorization: "Bearer <token>" }
Body: MockResponseConfig
Response: { message: string }
```

### Request Capture

```typescript
GET /api/requests
Headers: { Authorization: "Bearer <token>" }
Response: CapturedRequest[]

GET /api/requests/:requestId
Headers: { Authorization: "Bearer <token>" }
Response: CapturedRequest

ALL /catch/:path
// Captures any HTTP method to user-defined endpoints
Response: Configured mock response or default JSON
```

### Admin Endpoints

```typescript
GET /api/admin/users        # List all users (admin only)
POST /api/admin/users       # Create user (admin only)
PUT /api/admin/users/:id    # Update user (admin only)
DELETE /api/admin/users/:id # Delete user (admin only)
POST /api/admin/users/:id/reset-password # Reset password (admin only)
```

## 🔐 Authentication System

### How It Works

1. **Login Process**:

   - User submits credentials to `/api/auth/login`
   - Server validates against in-memory user store
   - Returns user object and token (currently user ID)
   - Frontend stores in React context + localStorage

2. **Authorization**:

   - All API requests include `Authorization: Bearer <token>` header
   - Server extracts user ID from token
   - User isolation enforced at data level

3. **Role-based Access**:
   - **Admin**: Full user management access
   - **User**: Can only manage own endpoints and requests

### Authentication Context

```typescript
// client/hooks/use-auth.tsx
interface User {
  id: string;
  email: string;
  name: string;
  role?: "user" | "admin";
}

interface AuthContextType {
  user: User | null;
  login: (user: User) => void;
  logout: () => void;
  isLoading: boolean;
}
```

## 🎨 Component Architecture

### Key Frontend Components

**Layout Components:**

- `Logo.tsx` - PAN Parrot branding with configurable sizes
- `ProtectedRoute.tsx` - Route wrapper for authenticated pages

**Feature Components:**

- `CreateEndpointDialog.tsx` - Modal for creating new endpoints
- `RequestReplayDialog.tsx` - Interface for modifying and replaying requests
- `MockResponseDialog.tsx` - Configuration UI for mock responses

**Page Components:**

- `Dashboard.tsx` - Main interface with endpoint management and request console
- `Admin.tsx` - User management interface (admin only)
- `Login.tsx` - Authentication form with test user quick-login

### State Management

**Global State:**

- Authentication: React Context (`useAuth`)
- Toast notifications: Radix UI (`useToast`)

**Local State:**

- Component state with `useState`
- API data fetching with `useEffect`
- Form state managed locally

**Data Fetching:**

- Custom API functions in `client/lib/api.ts`
- Real-time updates via polling (2-second intervals when streaming enabled)
- Error handling with try/catch and user feedback

## 🛠️ Development Workflows

### Adding New Features

1. **Backend First Approach**:

   ```bash
   # 1. Add API route in server/routes/
   # 2. Update shared types in shared/api.ts
   # 3. Add API client function in client/lib/api.ts
   # 4. Create/update React components
   # 5. Add routing if needed
   ```

2. **Component Development**:
   ```bash
   # 1. Create component in appropriate directory
   # 2. Follow existing patterns (props, styling, error handling)
   # 3. Add to parent component/page
   # 4. Test functionality
   ```

### Code Style & Conventions

**TypeScript:**

- Strict mode enabled
- Explicit return types for functions
- Interface definitions in shared types
- No `any` types in production code

**React:**

- Functional components with hooks
- Custom hooks for reusable logic
- Props interfaces for all components
- Error boundaries for production

**Styling:**

- TailwindCSS utility classes
- Radix UI components as base
- Consistent color scheme via CSS variables
- Responsive design with mobile-first approach

### Testing Strategy

```bash
# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Type checking
npm run typecheck
```

**Testing Approach:**

- Unit tests for utility functions
- Integration tests for API endpoints
- Component testing for complex UI logic
- Manual testing for user workflows

## 🔄 Data Flow

### Request Capture Flow

```
1. User creates endpoint via CreateEndpointDialog
   ↓ POST /api/endpoints
2. Server stores endpoint with user association
   ↓
3. External service makes request to /catch/:path
   ↓
4. Server captures request data + user context
   ↓
5. Request stored in memory with user ID
   ↓
6. Frontend polls GET /api/requests every 2s
   ↓
7. New requests appear in Dashboard console
   ↓
8. User can inspect, replay, or configure mocks
```

### User Management Flow

```
1. Admin accesses /admin page (role checked)
   ↓ GET /api/admin/users
2. Admin creates user via form
   ↓ POST /api/admin/users
3. User credentials stored in server memory
   ↓
4. New user can login with provided credentials
   ↓ POST /api/auth/login
5. User gets isolated access to own data
```

## 🚀 Deployment

### Development

```bash
npm run dev    # Start dev server (port 8080)
npm run build  # Production build
npm run start  # Start production server
```

### Production Options

1. **Docker Compose** (Recommended for single server):

   ```bash
   sudo ./deploy.sh
   ```

2. **Kubernetes** (Enterprise deployment):

   ```bash
   kubectl apply -f k8s/deployment.yaml
   ```

3. **Traditional VM**:
   ```bash
   npm ci --production
   npm run build
   npm start
   ```

See `DEPLOYMENT.md` for detailed deployment instructions.

## 🔒 Security Considerations

### Network Security

- **Internal Use Only** - Never expose to public internet
- **IP Whitelisting** - Restrict to internal network ranges
- **Rate Limiting** - Built-in protection against abuse
- **CORS Configuration** - Limited to internal domains

### Application Security

- **Input Validation** - Zod schemas for API endpoints
- **XSS Protection** - React's built-in escaping
- **CSRF Protection** - SameSite cookies and CORS
- **Authentication** - Token-based with user isolation

### Data Security

- **User Isolation** - All data scoped to user ID
- **No Data Persistence** - Memory-only storage (configurable)
- **Request Sanitization** - Large payloads handled gracefully
- **Admin Protection** - Cannot delete last admin user

## 🐛 Debugging & Troubleshooting

### Common Development Issues

1. **Port Conflicts**:

   ```bash
   # Check what's using port 8080
   lsof -i :8080
   ```

2. **Build Errors**:

   ```bash
   # Clear node modules and reinstall
   rm -rf node_modules package-lock.json
   npm install
   ```

3. **TypeScript Errors**:
   ```bash
   # Run type checking
   npm run typecheck
   ```

### Production Debugging

1. **Check Application Health**:

   ```bash
   curl http://localhost:3000/api/ping
   ```

2. **View Logs**:

   ```bash
   docker-compose logs -f pan-parrot
   # or
   journalctl -u pan-parrot -f
   ```

3. **Memory Usage**:
   ```bash
   docker stats pan-parrot
   ```

## 🤝 Contributing

### Development Setup

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/new-feature`
3. Make changes and test thoroughly
4. Follow existing code patterns and conventions
5. Update documentation if needed
6. Submit a pull request

### Code Review Guidelines

- **Functionality**: Does it work as expected?
- **Security**: No vulnerabilities introduced?
- **Performance**: Efficient implementation?
- **Maintainability**: Clean, readable code?
- **Testing**: Adequate test coverage?

### Release Process

1. Update version in `package.json`
2. Update `CHANGELOG.md`
3. Create release tag
4. Build and test production deployment
5. Deploy to staging environment
6. Deploy to production

## 📊 Performance Considerations

### Current Limitations

- **In-Memory Storage**: Data lost on restart
- **No Horizontal Scaling**: Single instance only
- **Request Polling**: 2-second intervals (not WebSocket)
- **No Request Pagination**: All requests loaded at once

### Optimization Opportunities

1. **Database Integration**:

   - Replace in-memory storage with PostgreSQL/MongoDB
   - Add request pagination and search
   - Implement data retention policies

2. **Real-time Updates**:

   - WebSocket connection for live updates
   - Server-sent events (SSE) alternative
   - Reduce polling frequency

3. **Caching**:

   - Redis for session storage
   - Request response caching
   - API response caching

4. **Monitoring**:
   - Application metrics (Prometheus)
   - Error tracking (Sentry)
   - Performance monitoring

## 🎯 Roadmap

### Short Term (1-2 months)

- [ ] WebSocket integration for real-time updates
- [ ] Database persistence layer
- [ ] Request search and filtering
- [ ] Bulk endpoint operations
- [ ] Export/import functionality

### Medium Term (3-6 months)

- [ ] API versioning
- [ ] Webhook forwarding
- [ ] Request transformation rules
- [ ] Custom response templating
- [ ] Advanced user permissions

### Long Term (6+ months)

- [ ] GraphQL support
- [ ] Plugin system
- [ ] Integration with PAN tools
- [ ] Advanced analytics
- [ ] Multi-tenant support

## 📚 Additional Resources

- [Deployment Guide](DEPLOYMENT.md) - Complete deployment instructions
- [API Documentation](docs/api.md) - Detailed API reference
- [Contributing Guidelines](CONTRIBUTING.md) - How to contribute
- [Security Guide](docs/security.md) - Security best practices

## 🆘 Support

For development questions or issues:

1. Check this README and documentation
2. Review existing GitHub issues
3. Ask in the team Slack channel
4. Contact the development team

---

**Built with ❤️ for Palo Alto Networks developers** 🦜

_PAN Parrot - Making HTTP debugging fun again!_
