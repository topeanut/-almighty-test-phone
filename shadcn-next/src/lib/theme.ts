export const THEME_KEY = "test-phone-theme";

// Runs before first paint (see layout.tsx): dark unless this browser chose light.
export const themeInitScript = `try{if(localStorage.getItem("${THEME_KEY}")==="light")document.documentElement.classList.remove("dark")}catch(e){}`;
