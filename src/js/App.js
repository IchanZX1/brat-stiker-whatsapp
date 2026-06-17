export class BratGenerator {
  constructor() {
    this.isGreenTheme = false;
    this.currentFontSize = 200;
    this.friedLevel = 80;
    
    this.fontFamily = '"Archivo Narrow", Arial, sans-serif';

    this.initializeElements();
    this.bindEvents();
    this.setupTextFit();
    this.render();
  }

  initializeElements() {
    this.textInput = document.getElementById("textInput");
    this.textOverlay = document.getElementById("textOverlay");
    this.fontSizeSlider = document.getElementById("fontSizeSlider");
    this.fontSizeValue = document.getElementById("fontSizeValue");
    this.friedLevelSlider = document.getElementById("friedLevel");
    this.friedValue = document.getElementById("friedValue");
    this.memeContainer = document.getElementById("memeContainer");
    this.memeImage = document.getElementById("memeImage");
  }

  bindEvents() {
    this.textInput.addEventListener("input", () => {
      this.updateText();
      this.fitText();
    });

    this.fontSizeSlider.addEventListener("input", (e) => {
      this.currentFontSize = parseInt(e.target.value);
      this.fontSizeValue.textContent = this.currentFontSize + "px";
      this.fitText();
    });

    this.friedLevelSlider.addEventListener("input", (e) => {
      this.friedLevel = parseInt(e.target.value);
      this.friedValue.textContent = this.friedLevel + "%";

      const blurAmount = (this.friedLevel / 100) * 3;
      this.textOverlay.style.filter = `blur(${blurAmount}px)`;
    });

    window.addEventListener("resize", () => {
      setTimeout(() => this.fitText(), 100);
    });
  }

  updateText() {
    const text = this.textInput.value.toLowerCase() || "brat";
    this.textOverlay.textContent = text;

    this.textOverlay.style.textAlign = "left";
    this.textOverlay.style.display = "block";
    this.textOverlay.style.position = "absolute";
    this.textOverlay.style.top = "2rem";
    this.textOverlay.style.left = "2rem";
    this.textOverlay.style.width = "calc(100% - 4rem)";
    this.textOverlay.style.transform = "none";

    const blurAmount = (this.friedLevel / 100) * 3;
    this.textOverlay.style.filter = `blur(${blurAmount}px)`;
    
    this.textOverlay.style.fontFamily = this.fontFamily;
    this.textOverlay.style.fontWeight = "900";
    this.textOverlay.style.lineHeight = "0.9";
  }

  setupTextFit() {
    this.fitText = () => {
      const container = this.memeContainer;
      const textElement = this.textOverlay;
      const text = textElement.textContent;

      if (!text || !container) return;

      const containerRect = container.getBoundingClientRect();
      const maxWidth = containerRect.width - 64;
      const maxHeight = containerRect.height - 64;

      let fontSize = this.currentFontSize;
      textElement.style.fontSize = fontSize + "px";
      textElement.style.fontWeight = "200";

      while (fontSize > 20) {
        textElement.style.fontSize = fontSize + "px";

        const textRect = textElement.getBoundingClientRect();
        const textHeight = textElement.scrollHeight;

        if (textHeight <= maxHeight && textElement.scrollWidth <= maxWidth) {
          break;
        }

        fontSize -= 5;
      }

      textElement.style.fontSize = fontSize + "px";
    };
  }

  render() {
    this.updateText();
    this.fitText();
  }

  async createCanvasWithBackground() {
    const container = this.memeContainer;
    const containerRect = container.getBoundingClientRect();

    const size = 600;

    this.fitText();

    if (document.fonts && document.fonts.ready) {
      await document.fonts.ready;
    }

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const scale = size / containerRect.width;
    const styles = window.getComputedStyle(this.textOverlay);
    const containerStyles = window.getComputedStyle(container);
    const fontSize = parseFloat(styles.fontSize) * scale;
    const lineHeight = fontSize * parseFloat(styles.lineHeight) / parseFloat(styles.fontSize);
    const fontWeight = styles.fontWeight || "200";
    const fontFamily = styles.fontFamily || this.fontFamily;
    const letterSpacing = this.parseCssLength(styles.letterSpacing, fontSize);
    const padding = 32 * scale;
    const maxWidth = size - padding * 2;
    const blurAmount = (this.friedLevel / 100) * 3 * scale;
    const radius =
      this.parseCssLength(containerStyles.borderRadius, size) || 20 * scale;
    const lines = this.wrapTextForCanvas(
      ctx,
      this.textOverlay.textContent,
      maxWidth,
      fontWeight,
      fontSize,
      fontFamily,
      letterSpacing,
    );

    canvas.width = size;
    canvas.height = size;

    ctx.save();
    this.roundRect(ctx, 0, 0, size, size, radius);
    ctx.clip();
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, size, size);

    ctx.fillStyle = "#000000";
    ctx.textBaseline = "top";
    ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
    ctx.filter = `blur(${blurAmount}px)`;
    if ("letterSpacing" in ctx) {
      ctx.letterSpacing = `${letterSpacing}px`;
    }

    let y = padding;
    lines.forEach((line) => {
      this.fillTextWithLetterSpacing(ctx, line, padding, y, letterSpacing);
      y += lineHeight;
    });

    ctx.restore();

    return canvas;
  }

  parseCssLength(value, fontSize) {
    if (!value || value === "normal") return 0;
    if (value.endsWith("em")) return parseFloat(value) * fontSize;
    if (value.endsWith("px")) return parseFloat(value);
    return parseFloat(value) || 0;
  }

  roundRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }

  measureTextWithLetterSpacing(ctx, text, letterSpacing) {
    const extraSpacing = Math.max(0, text.length - 1) * letterSpacing;
    return ctx.measureText(text).width + extraSpacing;
  }

  fillTextWithLetterSpacing(ctx, text, x, y, letterSpacing) {
    if ("letterSpacing" in ctx) {
      ctx.fillText(text, x, y);
      return;
    }

    let currentX = x;
    for (const char of text) {
      ctx.fillText(char, currentX, y);
      currentX += ctx.measureText(char).width + letterSpacing;
    }
  }

  wrapTextForCanvas(
    ctx,
    text,
    maxWidth,
    fontWeight,
    fontSize,
    fontFamily,
    letterSpacing,
  ) {
    ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;

    const words = text.split(/\s+/).filter(Boolean);
    const lines = [];
    let currentLine = "";

    words.forEach((word) => {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const testWidth = this.measureTextWithLetterSpacing(ctx, testLine, letterSpacing);

      if (testWidth <= maxWidth || !currentLine) {
        currentLine = testLine;
      } else {
        lines.push(currentLine);
        currentLine = word;
      }
    });

    if (currentLine) lines.push(currentLine);

    return lines;
  }

  calculateOptimalFontSize(ctx, text, maxWidth, maxHeight, baseFontSize) {
    let fontSize = baseFontSize;
    let lines = [];

    for (let size = fontSize; size >= 20; size -= 5) {
      // Gunakan font family yang konsisten
      ctx.font = `900 ${size}px ${this.fontFamily}`;
      lines = this.wrapText(ctx, text, maxWidth);

      const lineHeight = size * 0.85;
      const totalHeight = lines.length * lineHeight;

      if (totalHeight <= maxHeight) {
        fontSize = size;
        break;
      }
    }

    return { fontSize, lines };
  }

  wrapText(ctx, text, maxWidth) {
    const words = text.split(" ");
    const lines = [];

    if (words.length === 1) {
      const width = ctx.measureText(text).width;
      if (width <= maxWidth) {
        lines.push(text);
      } else {
        let currentLine = "";
        for (const char of text) {
          const testLine = currentLine + char;
          const testWidth = ctx.measureText(testLine).width;
          if (testWidth <= maxWidth) {
            currentLine = testLine;
          } else {
            if (currentLine) lines.push(currentLine);
            currentLine = char;
          }
        }
        if (currentLine) lines.push(currentLine);
      }
      return lines;
    }

    let currentLine = words[0];

    for (let i = 1; i < words.length; i++) {
      const word = words[i];
      const testLine = currentLine + " " + word;
      const width = ctx.measureText(testLine).width;

      if (width <= maxWidth) {
        currentLine = testLine;
      } else {
        lines.push(currentLine);
        currentLine = word;
      }
    }
    lines.push(currentLine);

    return lines;
  }

  async downloadImage() {
    const button = event.target;
    button.classList.add("loading");
    button.textContent = "Generating...";

    try {
      const canvas = await this.createCanvasWithBackground();

      const dataURL = canvas.toDataURL("image/png");

      const link = document.createElement("a");
      link.href = dataURL;
      link.download = `brat-${Date.now()}.png`;
      link.click();
    } catch (error) {
      console.error("Download failed:", error);
    } finally {
      button.classList.remove("loading");
      button.textContent = "Download";
    }
  }

  async previewImage() {
    const button = event.target;
    button.classList.add("loading");
    button.textContent = "Previewing...";

    try {
      const canvas = await this.createCanvasWithBackground();

      const dataURL = canvas.toDataURL("image/png");

      const newWindow = window.open("about:blank");
      const img = newWindow.document.createElement("img");
      img.src = dataURL;
      img.style.maxWidth = "100%";
      img.style.height = "auto";
      newWindow.document.body.appendChild(img);
      newWindow.document.body.style.margin = "0";
      newWindow.document.body.style.padding = "20px";
      newWindow.document.body.style.background = "#000";
      newWindow.document.body.style.display = "flex";
      newWindow.document.body.style.justifyContent = "center";
      newWindow.document.body.style.alignItems = "center";
      newWindow.document.body.style.minHeight = "100vh";
    } catch (error) {
      console.error("Preview failed:", error);
    } finally {
      button.classList.remove("loading");
      button.textContent = "Preview";
    }
  }
}
