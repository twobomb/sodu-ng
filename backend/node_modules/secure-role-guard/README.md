# secure-role-guard

> Zero-dependency RBAC authorization for React & Node.js. Define roles once, use everywhere.

[![npm version](https://img.shields.io/npm/v/secure-role-guard.svg)](https://www.npmjs.com/package/secure-role-guard)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![Zero Dependencies](https://img.shields.io/badge/dependencies-0-brightgreen.svg)](https://www.npmjs.com/package/secure-role-guard)
[![Tests & CI](https://img.shields.io/github/actions/workflow/status/Sohel-Rahaman-Developer/secure-role-guard/ci.yml?label=tests)](https://github.com/Sohel-Rahaman-Developer/secure-role-guard/actions)

**Author:** Sohel Rahaman

---

## 🚀 Quick Overview

| Custom Code (Without Package)       | With secure-role-guard      |
| ----------------------------------- | --------------------------- |
| Write permission logic everywhere   | Define once, use everywhere |
| Handle null/undefined edge cases    | Built-in, tested            |
| Different code for frontend/backend | Same API everywhere         |
| 2-4 hours setup                     | 10 minutes setup            |

---

## 📦 Installation

```bash
npm install secure-role-guard
# or
pnpm add secure-role-guard
# or
yarn add secure-role-guard
```

---

## 📖 Usage Guide

Choose your setup:

| I want to use in...         | Jump to                         |
| --------------------------- | ------------------------------- |
| **React/Next.js only**      | [Frontend Only](#frontend-only) |
| **Express/Node.js only**    | [Backend Only](#backend-only)   |
| **Both Frontend + Backend** | [Full Stack](#full-stack)       |

---

## Frontend Only

### Step 1: Define Roles

```typescript
// lib/roles.ts
import { defineRoles } from "secure-role-guard";

export const roleRegistry = defineRoles({
  admin: ["user.create", "user.read", "user.update", "user.delete"],
  manager: ["user.read", "user.update"],
  viewer: ["user.read"],
});
```

### Step 2: Setup Provider

```tsx
// app/providers.tsx (Next.js App Router)
// or src/App.tsx (Vite/CRA)
"use client";

import { PermissionProvider } from "secure-role-guard/react";
import { roleRegistry } from "@/lib/roles";

export function Providers({ children, user }) {
  // user = { roles: ['admin'], permissions: [] } from your auth
  return (
    <PermissionProvider user={user} registry={roleRegistry}>
      {children}
    </PermissionProvider>
  );
}
```

### Step 3: Use in Components

```tsx
import { Can, useCan } from "secure-role-guard/react";

function Dashboard() {
  const canDelete = useCan("user.delete");

  return (
    <div>
      {/* Method 1: Component */}
      <Can permission="user.create">
        <button>Add User</button>
      </Can>

      <Can permission="user.update">
        <button>Edit User</button>
      </Can>

      {/* Method 2: Hook */}
      {canDelete && <button>Delete User</button>}

      {/* With fallback */}
      <Can permission="admin.access" fallback={<p>Access Denied</p>}>
        <AdminPanel />
      </Can>

      {/* Multiple permissions (ANY) */}
      <Can permissions={["user.update", "user.delete"]} anyOf>
        <UserActions />
      </Can>
    </div>
  );
}
```

**That's it for frontend!** ✅

---

## Backend Only

### Step 1: Define Roles

```typescript
// lib/roles.ts
import { defineRoles } from "secure-role-guard/core";

export const roleRegistry = defineRoles({
  admin: ["user.create", "user.read", "user.update", "user.delete"],
  manager: ["user.read", "user.update"],
  viewer: ["user.read"],
});
```

### Step 2: Use in Express

```typescript
// server.ts
import express from "express";
import { requirePermission } from "secure-role-guard/adapters/express";
import { roleRegistry } from "./lib/roles";

const app = express();

// Your auth middleware (sets req.user)
app.use(yourAuthMiddleware);

// Protected routes
app.get(
  "/api/users",
  requirePermission("user.read", roleRegistry),
  (req, res) => {
    res.json({ users: [] });
  },
);

app.post(
  "/api/users",
  requirePermission("user.create", roleRegistry),
  (req, res) => {
    res.json({ created: true });
  },
);

app.delete(
  "/api/users/:id",
  requirePermission("user.delete", roleRegistry),
  (req, res) => {
    res.json({ deleted: true });
  },
);
```

### Manual Check (Without Middleware)

```typescript
import { canUser } from "secure-role-guard/core";

app.put("/api/users/:id", (req, res) => {
  if (!canUser(req.user, "user.update", roleRegistry)) {
    return res.status(403).json({ error: "Forbidden" });
  }
  // ... your logic
});
```

**That's it for backend!** ✅

---

## Full Stack

Use **same role definitions** for both:

```typescript
// shared/roles.ts (shared between frontend & backend)
import { defineRoles } from "secure-role-guard";

export const roleRegistry = defineRoles({
  admin: ["*"], // Full access
  manager: ["user.read", "user.update", "report.*"],
  support: ["ticket.read", "ticket.reply"],
  viewer: ["user.read"],
});
```

**Frontend:** Follow [Frontend Only](#frontend-only) steps  
**Backend:** Follow [Backend Only](#backend-only) steps

> 💡 **Pro tip:** Keep roles in a shared package or copy to both projects.

---

## 📚 API Reference

### Core Functions

| Function                                  | Description             |
| ----------------------------------------- | ----------------------- |
| `defineRoles(roles)`                      | Create role registry    |
| `canUser(user, permission, registry)`     | Check single permission |
| `canUserAll(user, permissions, registry)` | Check ALL permissions   |
| `canUserAny(user, permissions, registry)` | Check ANY permission    |

### React Components

| Component                   | Description         |
| --------------------------- | ------------------- |
| `<PermissionProvider>`      | Wrap your app       |
| `<Can permission="...">`    | Show if allowed     |
| `<Cannot permission="...">` | Show if NOT allowed |

### React Hooks

| Hook                     | Returns   |
| ------------------------ | --------- |
| `useCan(permission)`     | `boolean` |
| `useCanAll(permissions)` | `boolean` |
| `useCanAny(permissions)` | `boolean` |

### User Context Shape

```typescript
const user = {
  userId: "user-123", // Optional
  roles: ["admin", "manager"], // Role names
  permissions: ["custom.perm"], // Direct permissions (bypass roles)
  meta: { tenantId: "..." }, // Optional metadata
};
```

### Wildcard Permissions

| Pattern          | Grants                                           |
| ---------------- | ------------------------------------------------ |
| `*`              | Everything                                       |
| `user.*`         | `user.read`, `user.update`, etc.                 |
| `report.admin.*` | `report.admin.view`, `report.admin.export`, etc. |

---

## 🔄 Dynamic Roles (From Database)

If admin creates roles at runtime:

```typescript
// Fetch roles from your database
const rolesFromDB = await fetchRolesFromDB();

// Transform to: { roleName: ['permission1', 'permission2'] }
const roleDefinition = {};
rolesFromDB.forEach((role) => {
  roleDefinition[role.name] = role.permissions;
});

// Create registry
const registry = defineRoles(roleDefinition);
```

Works with **any database**: MongoDB, PostgreSQL, MySQL, SQLite, etc.

---

## ⚠️ Important Notes

### This Package Does NOT:

- ❌ Handle authentication (JWT, sessions, cookies)
- ❌ Make API/database calls
- ❌ Store global state

**You provide:** User with roles → **We check:** Permissions

### Security

- ✅ Deny by default (undefined = false)
- ✅ Zero dependencies in core
- ✅ Immutable configurations
- ✅ Pure functions (no side effects)

---

## 🔒 Backward Compatibility

| Version       | Meaning                                    |
| ------------- | ------------------------------------------ |
| 1.0.x → 1.0.y | Bug fixes, safe to update                  |
| 1.x.0 → 1.y.0 | New features, no breaking changes          |
| 1.x.x → 2.0.0 | Breaking changes, migration guide provided |

**Promise:** v1.x APIs will never break. Update with confidence.

---

## 📄 License

MIT © [Sohel Rahaman](https://github.com/sohelrahaman)

---

## 🔗 Links

- [GitHub Repository](https://github.com/Sohel-Rahaman-Developer/secure-role-guard)
- [NPM Package](https://www.npmjs.com/package/secure-role-guard)
- [Report Issues](https://github.com/Sohel-Rahaman-Developer/secure-role-guard/issues)
