import { Auth0Provider, useAuth0 } from "@auth0/auth0-react";
import { useLayoutEffect, useState } from "react";
import { auth0Audience, auth0ClientId, auth0Domain, auth0Scope, isAuth0Enabled } from "../../config/environment";
import { fetchCurrentUser, setAccessTokenProvider } from "../../api/cemeteryApi";
import type { CurrentUser } from "../../types";
import { Notice } from "../ui/Feedback";

type Props={onConnected:(user:CurrentUser)=>Promise<void>;disabled?:boolean};
function ConnectButton({onConnected,disabled}:Props){
  const [busy,setBusy]=useState(false),[error,setError]=useState("");
  return <><button type="button" disabled={busy||disabled} onClick={async()=>{setBusy(true);setError("");try{await onConnected(await fetchCurrentUser());}catch(e){setError(e instanceof Error?e.message:"Unable to verify this account.");}finally{setBusy(false);}}}>{busy?"Checking access…":"Connect to cemetery records"}</button>{error&&<Notice tone="error">{error}</Notice>}</>;
}
function AuthenticatedConnection(props:Props){
  const {isAuthenticated,isLoading,loginWithPopup,getAccessTokenSilently,error}=useAuth0();
  const [message,setMessage]=useState("");
  useLayoutEffect(()=>{if(isAuthenticated)setAccessTokenProvider(()=>getAccessTokenSilently());return()=>setAccessTokenProvider(undefined);},[isAuthenticated,getAccessTokenSilently]);
  if(isLoading)return <Notice>Checking sign-in…</Notice>;
  return <>{error&&<Notice tone="error">Unable to connect to sign-in. Your device work remains available.</Notice>}{message&&<Notice tone="error">{message}</Notice>}
    {isAuthenticated?<ConnectButton {...props}/>:<button type="button" disabled={props.disabled} onClick={async()=>{setMessage("");try{await loginWithPopup();}catch(e){setMessage(e instanceof Error?e.message:"Sign-in was not completed.");}}}>Sign in to synchronize</button>}
  </>;
}
export function FieldConnection(props:Props){
  if(!isAuth0Enabled)return <ConnectButton {...props}/>;
  return <Auth0Provider domain={auth0Domain} clientId={auth0ClientId} authorizationParams={{audience:auth0Audience,redirect_uri:window.location.origin,scope:auth0Scope}}><AuthenticatedConnection {...props}/></Auth0Provider>;
}
