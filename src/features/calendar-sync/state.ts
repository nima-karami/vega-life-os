const CAL = "vega.gcal.calendarId";
const TOKEN = "vega.gcal.syncToken";
const ON = "vega.gcal.enabled";

export const getCalendarId = () => { try { return localStorage.getItem(CAL) ?? "primary"; } catch { return "primary"; } };
export const setCalendarId = (v: string) => { try { localStorage.setItem(CAL, v); } catch { /* ignore */ } };
export const getSyncToken = () => { try { return localStorage.getItem(TOKEN); } catch { return null; } };
export const setSyncToken = (v: string | null) => { try { v ? localStorage.setItem(TOKEN, v) : localStorage.removeItem(TOKEN); } catch { /* ignore */ } };
export const isEnabled = () => { try { return localStorage.getItem(ON) === "1"; } catch { return false; } };
export const setEnabled = (v: boolean) => { try { localStorage.setItem(ON, v ? "1" : "0"); } catch { /* ignore */ } };
