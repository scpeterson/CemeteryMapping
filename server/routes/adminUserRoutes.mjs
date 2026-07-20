export function registerAdminUserRoutes(app, context) {
  const {
    Auth0ProvisioningNotConfiguredError, auth0ManagementClient, createUser, listAssignableRoles,
    listRoles, listUsers, pool, requireAdmin, updateUser, validateAdminUserPayload,
    validateAuth0UserResolutionPayload, validateUuid,
  } = context;
      app.get("/api/admin/roles", requireAdmin, async (_request, response, next) => {
        try {
          response.json(await listRoles(pool));
        } catch (error) {
          next(error);
        }
      });
    
      app.get("/api/admin/users", requireAdmin, async (_request, response, next) => {
        try {
          response.json(await listUsers(pool));
        } catch (error) {
          next(error);
        }
      });
    
      app.post("/api/admin/auth0-users/resolve", requireAdmin, async (request, response, next) => {
        try {
          const user = validateAuth0UserResolutionPayload(request.body);
          response.json(await auth0ManagementClient.resolveOrCreateUser(user));
        } catch (error) {
          if (error instanceof Auth0ProvisioningNotConfiguredError) {
            response.status(400).json({ error: error.message });
            return;
          }
          next(error);
        }
      });
    
      app.post("/api/admin/users", requireAdmin, async (request, response, next) => {
        try {
          const roles = await listAssignableRoles(pool);
          const user = validateAdminUserPayload(request.body, roles);
          response.status(201).json(await createUser(pool, { ...user, actorUser: request.user }));
        } catch (error) {
          next(error);
        }
      });
    
      app.put("/api/admin/users/:id", requireAdmin, async (request, response, next) => {
        try {
          const id = validateUuid(request.params.id, "User id");
          const roles = await listAssignableRoles(pool);
          const user = validateAdminUserPayload(request.body, roles);
          const updated = await updateUser(pool, id, { ...user, actorUser: request.user });
          if (!updated) {
            response.status(404).json({ error: "User not found" });
            return;
          }
          response.json(updated);
        } catch (error) {
          next(error);
        }
      });
    
}
