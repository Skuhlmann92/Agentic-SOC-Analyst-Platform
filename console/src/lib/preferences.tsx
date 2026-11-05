"use client";
import {createContext,useContext,useEffect,useState,type ReactNode} from "react";

export type Locale="de"|"en";
export type Appearance="dark"|"light";
type PreferenceContextValue={
 locale:Locale;appearance:Appearance;setLocale:(value:Locale)=>void;setAppearance:(value:Appearance)=>void;
 t:(de:string,en:string)=>string;
};
const Context=createContext<PreferenceContextValue|undefined>(undefined);
export function PreferencesProvider({children}:{children:ReactNode}){
 const [locale,setLocale]=useState<Locale>("de");
 const [appearance,setAppearance]=useState<Appearance>("dark");
 useEffect(()=>{
  try {
   const savedLanguage=localStorage.getItem("soc-language");
   const savedTheme=localStorage.getItem("soc-theme");
   if(savedLanguage==="de"||savedLanguage==="en")setLocale(savedLanguage);
   if(savedTheme==="light"||savedTheme==="dark")setAppearance(savedTheme);
  }catch{}
 },[]);
 useEffect(()=>{
  document.documentElement.dataset.theme=appearance;
  document.documentElement.lang=locale;
  try{localStorage.setItem("soc-theme",appearance);localStorage.setItem("soc-language",locale);}catch{}
 },[appearance,locale]);
 return <Context.Provider value={{locale,appearance,setLocale,setAppearance,t:(de,en)=>locale==="de"?de:en}}>{children}</Context.Provider>;
}
export function usePreferences(){
 const prefs=useContext(Context);
 if(!prefs)throw new Error("PreferencesProvider missing");
 return prefs;
}
