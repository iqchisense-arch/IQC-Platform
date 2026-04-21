function setTheme(theme){

localStorage.setItem("appTheme", theme);

document.documentElement.setAttribute("data-theme", theme);

}

function toggleTheme(){

const current = localStorage.getItem("appTheme") || "dark";

const newTheme = current === "dark" ? "light" : "dark";

setTheme(newTheme);

}

function loadTheme(){

const theme = localStorage.getItem("appTheme") || "dark";

document.documentElement.setAttribute("data-theme", theme);

}

document.addEventListener("DOMContentLoaded", loadTheme);