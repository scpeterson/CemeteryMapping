import { useEffect, useRef, useState } from "react";

const remainingItemsPreferenceKey = "cemetery-mapping:inspection-remaining-items-open";
const restoredDefaultsPreferenceKey = "cemetery-mapping:inspection-restored-defaults-open";
const resetKeyboardHelpPreferenceKey = "cemetery-mapping:inspection-reset-keyboard-help-open";
const keyboardHelpPreferenceKey = "cemetery-mapping:inspection-keyboard-help-open";
const displayPreferenceSettings = [
  {key:"remainingItems",id:remainingItemsPreferenceKey,label:"Remaining items",controlLabel:"remaining items",defaultOpen:true},
  {key:"keyboardHelp",id:keyboardHelpPreferenceKey,label:"Inspection keyboard hint",controlLabel:"Keyboard shortcuts",defaultOpen:false},
  {key:"resetKeyboardHelp",id:resetKeyboardHelpPreferenceKey,label:"Reset confirmation keyboard hint",controlLabel:"Keyboard shortcuts",defaultOpen:false},
  {key:"restoredDefaults",id:restoredDefaultsPreferenceKey,label:"Restored-defaults list",controlLabel:"Restored defaults",defaultOpen:false},
] as const;
type DisplayPreferenceKey = typeof displayPreferenceSettings[number]["key"];
const displayPreferenceSetting = (key:DisplayPreferenceKey) => displayPreferenceSettings.find(setting=>setting.key===key)!;
const readDisplayPreference = (key:DisplayPreferenceKey) => {
  const setting=displayPreferenceSetting(key);
  try {
    const stored=window.localStorage.getItem(setting.id);
    return stored==="true" ? true : stored==="false" ? false : setting.defaultOpen;
  } catch { return setting.defaultOpen; }
};
const saveDisplayPreference = (key:DisplayPreferenceKey,open:boolean) => {
  try { window.localStorage.setItem(displayPreferenceSetting(key).id,String(open)); }
  catch { /* Keep the in-session choice when browser storage is unavailable. */ }
};

export function useInspectionDisplayPreferences() {
  const [displayPreferencesReset,setDisplayPreferencesReset] = useState(false);
  const [restoredDefaultsOpen,setRestoredDefaultsOpen] = useState(()=>readDisplayPreference("restoredDefaults"));
  const rememberRestoredDefaults = (open:boolean) => {
    setRestoredDefaultsOpen(open);
    saveDisplayPreference("restoredDefaults",open);
  };
  const [resetKeyboardHelpOpen,setResetKeyboardHelpOpen] = useState(()=>readDisplayPreference("resetKeyboardHelp"));
  const rememberResetKeyboardHelp = (open:boolean) => {
    setResetKeyboardHelpOpen(open);
    saveDisplayPreference("resetKeyboardHelp",open);
  };
  const displayResetButton = useRef<HTMLButtonElement | null>(null);
  const displayResetNotice = useRef<HTMLDivElement | null>(null);
  const displayResetTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(()=>()=>clearTimeout(displayResetTimeout.current),[]);
  const [remainingItemsOpen,setRemainingItemsOpen] = useState(()=>readDisplayPreference("remainingItems"));
  const [correctionCollapsed,setCorrectionCollapsed] = useState(!remainingItemsOpen);
  const rememberRemainingItems = (open:boolean) => {
    setDisplayPreferencesReset(false);
    setRemainingItemsOpen(open);
    setCorrectionCollapsed(!open);
    saveDisplayPreference("remainingItems",open);
  };
  const [keyboardHelpOpen,setKeyboardHelpOpen] = useState(()=>readDisplayPreference("keyboardHelp"));
  const rememberKeyboardHelp = (open:boolean) => {
    setDisplayPreferencesReset(false);
    setKeyboardHelpOpen(open);
    saveDisplayPreference("keyboardHelp",open);
  };
  const displayPreferenceWriters = {
    remainingItems:rememberRemainingItems,
    keyboardHelp:rememberKeyboardHelp,
    resetKeyboardHelp:rememberResetKeyboardHelp,
    restoredDefaults:rememberRestoredDefaults,
  } satisfies Record<DisplayPreferenceKey,(open:boolean)=>void>;
  const displayPreferenceValues = {
    remainingItems:!correctionCollapsed,
    keyboardHelp:keyboardHelpOpen,
    resetKeyboardHelp:resetKeyboardHelpOpen,
    restoredDefaults:restoredDefaultsOpen,
  } satisfies Record<DisplayPreferenceKey,boolean>;
  const restoredDisplayDefaults = displayPreferenceSettings.map(setting=>({
    ...setting,open:displayPreferenceValues[setting.key],apply:displayPreferenceWriters[setting.key],
  }));
  const preferenceControl = (key:DisplayPreferenceKey) => restoredDisplayDefaults.find(setting=>setting.key===key)!;
  const remainingItemsControl=preferenceControl("remainingItems");
  const keyboardHelpControl=preferenceControl("keyboardHelp");
  const resetKeyboardHelpControl=preferenceControl("resetKeyboardHelp");
  const restoredDefaultsControl=preferenceControl("restoredDefaults");
  const pendingItemListFocusRef = useRef<string | null>(null);
  const dismissDisplayReset = (restoreFocus=false) => {
    clearTimeout(displayResetTimeout.current);
    setDisplayPreferencesReset(false);
    if(restoreFocus || displayResetNotice.current?.contains(document.activeElement)) displayResetButton.current?.focus({preventScroll:true});
  };
  const resetDisplayPreferences = () => {
    pendingItemListFocusRef.current=null;
    restoredDisplayDefaults.forEach(setting=>setting.apply(setting.defaultOpen));
    setDisplayPreferencesReset(true);
    clearTimeout(displayResetTimeout.current);
    displayResetTimeout.current=setTimeout(()=>dismissDisplayReset(),4000);
  };
  return { displayPreferencesReset, setDisplayPreferencesReset, remainingItemsOpen, correctionCollapsed, setCorrectionCollapsed, remainingItemsControl, keyboardHelpControl, resetKeyboardHelpControl, restoredDefaultsControl, restoredDisplayDefaults, displayResetButton, displayResetNotice, pendingItemListFocusRef, dismissDisplayReset, resetDisplayPreferences };
}
