import "./styles/main.css";

import { BratGenerator } from "./js/App.js";
import "./js/textFit.js";

function toggleTheme() {
  const memeContainer = document.getElementById("memeContainer");
  const generator = window.bratGenerator;

  if (memeContainer.classList.contains("green-theme")) {
    memeContainer.classList.remove("green-theme");
    generator.isGreenTheme = false;
  } else {
    memeContainer.classList.add("green-theme");
    generator.isGreenTheme = true;
  }
}

function downloadImage() {
  window.bratGenerator.downloadImage();
}

function previewImage() {
  window.bratGenerator.previewImage();
}

window.toggleTheme = toggleTheme;
window.downloadImage = downloadImage;
window.previewImage = previewImage;

document.addEventListener("DOMContentLoaded", () => {
  window.bratGenerator = new BratGenerator();
});
