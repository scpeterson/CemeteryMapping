import { useContext, type ComponentProps } from "react";
import { EditingOptionsContext } from "./editingOptionsContext";
export function LookupForm({ children, onSubmit, ...props }: ComponentProps<"form">) {
  const { loading, error, retry } = useContext(EditingOptionsContext);
  return <form {...props} onSubmit={(event) => {
    if (loading || error) { event.preventDefault(); return; }
    onSubmit?.(event);
  }}>
    {loading || error ? <div className="burial-wide-field" role={error ? "alert" : "status"}>
      <p>{loading ? "Loading editing options…" : `Editing options couldn't be loaded. ${error}`}</p>
      {error && !loading ? <button type="button" onClick={retry}>Retry editing options</button> : null}
    </div> : null}
    {children}
  </form>;
}
export function LookupSelect(props: ComponentProps<"select">) {
  const { loading, error } = useContext(EditingOptionsContext);
  return <select {...props} disabled={props.disabled || loading || Boolean(error)} />;
}
export function LookupSaveButton(props: ComponentProps<"button">) {
  const { loading, error } = useContext(EditingOptionsContext);
  return <button {...props} disabled={props.disabled || loading || Boolean(error)} />;
}
