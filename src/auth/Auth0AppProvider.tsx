import { Auth0Provider, useAuth0 } from "@auth0/auth0-react";
import { ReactNode, useEffect } from "react";
import { setAccessTokenProvider } from "../api/cemeteryApi";
import { auth0Audience, auth0ClientId, auth0Domain, auth0Scope, isAuth0Enabled } from "../config/environment";

type Auth0AppProviderProps = {
  children: ReactNode;
};

function AuthenticatedShell({ children }: Auth0AppProviderProps) {
  const { error, getAccessTokenSilently, isAuthenticated, isLoading, loginWithRedirect, logout, user } = useAuth0();

  useEffect(() => {
    if (!isAuthenticated) {
      setAccessTokenProvider(undefined);
      return undefined;
    }

    setAccessTokenProvider(() => getAccessTokenSilently());
    return () => setAccessTokenProvider(undefined);
  }, [getAccessTokenSilently, isAuthenticated]);

  if (isLoading) {
    return (
      <main className="auth-screen" role="status">
        Connecting to cemetery access...
      </main>
    );
  }

  if (error) {
    return (
      <main className="auth-screen auth-screen-error" role="alert">
        <h1>Unable to sign in</h1>
        <p>{error.message}</p>
        <button type="button" onClick={() => void loginWithRedirect()}>
          Try again
        </button>
      </main>
    );
  }

  if (!isAuthenticated) {
    return (
      <main className="auth-screen">
        <h1>Cemetery Mapping</h1>
        <p>Sign in with the configured Auth0 tenant to access cemetery records.</p>
        <button type="button" onClick={() => void loginWithRedirect()}>
          Sign in
        </button>
      </main>
    );
  }

  return (
    <>
      <div className="auth-session" aria-label="Signed in user">
        <span>{user?.email ?? user?.name ?? "Signed in"}</span>
        <button type="button" onClick={() => logout({ logoutParams: { returnTo: window.location.origin } })}>
          Sign out
        </button>
      </div>
      {children}
    </>
  );
}

export function Auth0AppProvider({ children }: Auth0AppProviderProps) {
  if (!isAuth0Enabled) return children;

  return (
    <Auth0Provider
      domain={auth0Domain}
      clientId={auth0ClientId}
      authorizationParams={{
        audience: auth0Audience,
        redirect_uri: window.location.origin,
        scope: auth0Scope,
      }}
    >
      <AuthenticatedShell>{children}</AuthenticatedShell>
    </Auth0Provider>
  );
}
