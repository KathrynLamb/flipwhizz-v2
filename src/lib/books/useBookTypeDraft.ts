"use client";
import { useEffect, useState, useCallback, useSyncExternalStore } from "react";
import { isBookType, type BookType } from "./bookType";
const KEY = "flipwhizz_book_type_v1";
const EVENT = "flipwhizz-book-type-changed";
function subscribe(notify: () => void) {
  window.addEventListener(EVENT, notify);
  window.addEventListener("storage", notify);
  return () => { window.removeEventListener(EVENT, notify); window.removeEventListener("storage", notify); };
}
function readDraft(): BookType {
  try { const value = sessionStorage.getItem(KEY); return isBookType(value) ? value : "storybook"; }
  catch { return "storybook"; }
}
function writeDraft(value: BookType) {
  try { sessionStorage.setItem(KEY, value); window.dispatchEvent(new Event(EVENT)); } catch { /* Optional browser persistence. */ }
}
function serverDraft(): BookType { return "storybook"; }
export function useBookTypeDraft(queryValue: string | null, projectMode = false) {
  const draft = useSyncExternalStore(subscribe, readDraft, serverDraft);
  const [selection, setSelection] = useState<BookType | null>(() => !projectMode && isBookType(queryValue) ? queryValue : null);
  // Persist an explicit landing-page choice across the sign-in redirect.
  useEffect(() => { if (!projectMode && isBookType(queryValue)) writeDraft(queryValue); }, [queryValue, projectMode]);
  const selectBookType = useCallback((value: BookType) => {
    setSelection(value);
    if (!projectMode) writeDraft(value);
  }, [projectMode]);
  return { bookType: selection ?? (projectMode ? "storybook" : draft), selectBookType };
}
