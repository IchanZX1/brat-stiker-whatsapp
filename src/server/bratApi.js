const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const IMAGE_SIZE = 600;
const DEFAULT_FONT_SIZE = 120;
const PADDING = 32;
const TEXT_AREA = IMAGE_SIZE - PADDING * 2;
const FONT_PATH = path.join(__dirname, "..", "fonts", "arialnarrow.ttf");

const fontData = fs.readFileSync(FONT_PATH).toString("base64");

const API_TYPES = {
  brat: {
    fontSize: 190,
    friedLevel: 99,
    filename: "brat.jpg",
  },
  brathd: {
    fontSize: 190,
    friedLevel: 22,
    filename: "brathd.jpg",
  },
};

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function createBratSvg(text, friedLevel, fontSize = DEFAULT_FONT_SIZE) {
  const blurAmount = (friedLevel / 100) * 3;
  const safeText = escapeHtml(text || "brat");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${IMAGE_SIZE}" height="${IMAGE_SIZE}" viewBox="0 0 ${IMAGE_SIZE} ${IMAGE_SIZE}">
  <defs>
    <style>
      @font-face {
        font-family: "BratApiNarrow";
        src: url("data:font/woff;base64,${fontData}") format("woff");
        font-weight: 200 900;
      }
    </style>
    <filter id="fried">
      <feGaussianBlur stdDeviation="${blurAmount}" />
    </filter>
  </defs>
  <rect width="${IMAGE_SIZE}" height="${IMAGE_SIZE}" fill="#ffffff" />
  <foreignObject x="${PADDING}" y="${PADDING}" width="${TEXT_AREA}" height="${TEXT_AREA}">
    <div xmlns="http://www.w3.org/1999/xhtml" style="
      color: #000;
      font-family: BratApiNarrow, 'Arial Narrow', Arial, sans-serif;
      font-size: ${fontSize}px;
      font-weight: 200;
      letter-spacing: -0.05em;
      line-height: 0.85;
      text-align: left;
      text-transform: lowercase;
      overflow-wrap: break-word;
      word-wrap: break-word;
      white-space: normal;
      filter: blur(${blurAmount}px);
    ">${safeText}</div>
  </foreignObject>
</svg>`;
}

async function measureTextWidth(text, fontSize) {
  const metadata = await sharp({
    text: {
      text: escapeHtml(text),
      font: `Arial Narrow ${fontSize}`,
      fontfile: FONT_PATH,
      rgba: true,
    },
  }).metadata();

  return metadata.width || 0;
}

async function wrapTextByFont(text, fontSize) {
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let currentLine = "";

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const testWidth = await measureTextWidth(testLine, fontSize);

    if (testWidth <= TEXT_AREA || !currentLine) {
      currentLine = testLine;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  }

  if (currentLine) lines.push(currentLine);
  return lines;
}

function createRasterSvg(lines, blurAmount, fontSize) {
  const lineHeight = fontSize * 0.85;
  const tspans = lines
    .map((line, index) => {
      const y = PADDING + fontSize + index * lineHeight;
      return `<text x="${PADDING}" y="${y}">${escapeHtml(line)}</text>`;
    })
    .join("\n      ");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${IMAGE_SIZE}" height="${IMAGE_SIZE}" viewBox="0 0 ${IMAGE_SIZE} ${IMAGE_SIZE}">
  <defs>
    <style>
      @font-face {
        font-family: "BratApiNarrow";
        src: url("data:font/truetype;base64,${fontData}") format("truetype");
        font-weight: 200 900;
      }
    </style>
    <filter id="fried">
      <feGaussianBlur stdDeviation="${blurAmount}" />
    </filter>
  </defs>
  <rect width="${IMAGE_SIZE}" height="${IMAGE_SIZE}" fill="#ffffff" />
  <g filter="url(#fried)"
     fill="#000000"
     font-family="BratApiNarrow, Arial Narrow, Arial, sans-serif"
     font-size="${fontSize}"
     font-weight="200"
     letter-spacing="-6"
     dominant-baseline="alphabetic">
      ${tspans}
  </g>
</svg>`;
}

async function createBratJpgBuffer(text, type) {
  const config = API_TYPES[type] || API_TYPES.brat;
  const fontSize = config.fontSize || DEFAULT_FONT_SIZE;
  const normalizedText = String(text || "brat").toLowerCase();
  const blurAmount = (config.friedLevel / 100) * 3;
  const lines = await wrapTextByFont(normalizedText, fontSize);
  const svg = createRasterSvg(lines, blurAmount, fontSize);

  return sharp(Buffer.from(svg))
    .jpeg({ quality: 95 })
    .toBuffer();
}

async function sendBratImage(req, res, type) {
  const config = API_TYPES[type] || API_TYPES.brat;
  const text = typeof req.query.text === "string" ? req.query.text : "brat";
  const jpgBuffer = await createBratJpgBuffer(text, type);

  res.setHeader("Content-Type", "image/jpeg");
  res.setHeader("Content-Disposition", `inline; filename="${config.filename}"`);
  res.setHeader("Cache-Control", "no-store");
  res.send(jpgBuffer);
}

function asyncRoute(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

function registerBratApi(app) {
  app.get(["/brat", "/brat/"], asyncRoute((req, res) => sendBratImage(req, res, "brat")));
  app.get(["/brathd", "/brathd/"], asyncRoute((req, res) => sendBratImage(req, res, "brathd")));
  app.get("/api", (req, res) => {
    res.json({
      endpoints: {
        brat: "/brat/?text=your%20text",
        brathd: "/brathd/?text=your%20text",
      },
      config: {
        brat: {
          fontSize: `${API_TYPES.brat.fontSize}px`,
          friedLevel: `${API_TYPES.brat.friedLevel}%`,
        },
        brathd: {
          fontSize: `${API_TYPES.brathd.fontSize}px`,
          friedLevel: `${API_TYPES.brathd.friedLevel}%`,
        },
      },
    });
  });
}

module.exports = {
  createBratJpgBuffer,
  API_TYPES,
  registerBratApi,
};
