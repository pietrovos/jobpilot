import { createContext } from "react";

export const TimeZoneContext = createContext("UTC");
export const subscribeTimeZone = () => () => {};
export const browserTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
export const serverTimeZone = () => "UTC";
