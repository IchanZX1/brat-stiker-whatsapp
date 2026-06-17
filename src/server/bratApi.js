const fs = require("fs");
const https = require("https");
const path = require("path");
const emojiRegex = require("emoji-regex");
const sharp = require("sharp");
const twemoji = require("twemoji");

const IMAGE_SIZE = 600;
const DEFAULT_FONT_SIZE = 120;
const PADDING = 32;
const TEXT_AREA = IMAGE_SIZE - PADDING * 2;
const MIN_FONT_SIZE = 20;
const FONT_STEP = 5;
const FONT_PATH = path.join(__dirname, "..", "fonts", "arialnarrow.ttf");
const LOCAL_SAMSUNG_EMOJI_DIR = path.join(__dirname, "..", "emoji", "samsung");
const NOTO_EMOJI_BASE_URL = "https://cdn.jsdelivr.net/gh/googlefonts/noto-emoji@main/svg";
const TWEMOJI_BASE_URL = "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg";
const EMOJI_STYLE = (process.env.EMOJI_STYLE || "noto").toLowerCase();

const fontData = fs.readFileSync(FONT_PATH).toString("base64");
const emojiCache = new Map();
const emojiHttpsAgent = new https.Agent({ rejectUnauthorized: false });

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
  if (!text) return 0;
  if (!String(text).trim()) return fontSize * 0.25;

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

function splitEmojiSegments(value) {
  const regex = emojiRegex();
  const segments = [];
  let cursor = 0;
  let match;

  while ((match = regex.exec(value)) !== null) {
    if (match.index > cursor) {
      segments.push({ type: "text", value: value.slice(cursor, match.index) });
    }

    segments.push({ type: "emoji", value: match[0] });
    cursor = match.index + match[0].length;
  }

  if (cursor < value.length) {
    segments.push({ type: "text", value: value.slice(cursor) });
  }

  return segments;
}

async function getSegmentWidth(segment, fontSize) {
  if (segment.type === "emoji") return fontSize * 0.92;
  return measureTextWidth(segment.value, fontSize);
}

async function createMeasuredWord(word, fontSize) {
  const segments = splitEmojiSegments(word);
  let width = 0;

  for (const segment of segments) {
    segment.width = await getSegmentWidth(segment, fontSize);
    width += segment.width;
  }

  return { segments, width };
}

async function wrapTextByFont(text, fontSize, allowWordSplit = true) {
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let currentWords = [];
  let currentWidth = 0;
  const spaceWidth = await measureTextWidth(" ", fontSize);

  for (const word of words) {
    const measuredWord = await createMeasuredWord(word, fontSize);
    const testWidth =
      currentWidth + (currentWords.length ? spaceWidth : 0) + measuredWord.width;

    if (measuredWord.width > TEXT_AREA) {
      if (!allowWordSplit) return null;

      if (currentWords.length) {
        lines.push({ words: currentWords, spaceWidth });
        currentWords = [];
        currentWidth = 0;
      }

      const splitLines = await splitLongWord(measuredWord, fontSize, spaceWidth);
      lines.push(...splitLines.slice(0, -1));
      const lastLine = splitLines[splitLines.length - 1];
      currentWords = lastLine ? lastLine.words : [];
      currentWidth = getLineWidth(lastLine);
    } else if (testWidth <= TEXT_AREA || !currentWords.length) {
      currentWords.push(measuredWord);
      currentWidth = testWidth;
    } else {
      lines.push({ words: currentWords, spaceWidth });
      currentWords = [measuredWord];
      currentWidth = measuredWord.width;
    }
  }

  if (currentWords.length) lines.push({ words: currentWords, spaceWidth });
  return lines;
}

function getLineWidth(line) {
  if (!line || !line.words.length) return 0;

  return line.words.reduce((total, word, index) => {
    return total + word.width + (index ? line.spaceWidth : 0);
  }, 0);
}

async function splitLongWord(word, fontSize, spaceWidth) {
  const lines = [];
  let currentSegments = [];
  let currentWidth = 0;

  for (const segment of word.segments) {
    const pieces =
      segment.type === "emoji"
        ? [segment]
        : Array.from(segment.value).map((char) => ({ type: "text", value: char }));

    for (const piece of pieces) {
      const measuredPiece = { ...piece };
      measuredPiece.width = await getSegmentWidth(measuredPiece, fontSize);

      if (currentWidth + measuredPiece.width > TEXT_AREA && currentSegments.length) {
        lines.push({
          words: [{ segments: currentSegments, width: currentWidth }],
          spaceWidth,
        });
        currentSegments = [];
        currentWidth = 0;
      }

      currentSegments.push(measuredPiece);
      currentWidth += measuredPiece.width;
    }
  }

  if (currentSegments.length) {
    lines.push({
      words: [{ segments: currentSegments, width: currentWidth }],
      spaceWidth,
    });
  }

  return lines;
}

async function fitTextByFont(text, baseFontSize) {
  for (let fontSize = baseFontSize; fontSize >= MIN_FONT_SIZE; fontSize -= FONT_STEP) {
    const lines = await wrapTextByFont(text, fontSize, false);
    if (!lines) continue;

    const lineHeight = fontSize * 0.85;
    const totalHeight = lines.length * lineHeight;
    const maxLineWidth = Math.max(0, ...lines.map(getLineWidth));

    if (totalHeight <= TEXT_AREA && maxLineWidth <= TEXT_AREA) {
      return { fontSize, lines };
    }
  }

  return {
    fontSize: MIN_FONT_SIZE,
    lines: await wrapTextByFont(text, MIN_FONT_SIZE, true),
  };
}

function createRasterSvg(lines, blurAmount, fontSize) {
  const lineHeight = fontSize * 0.85;
  const textNodes = [];
  const emojiLayers = [];
  const emojiSize = Math.round(fontSize * 0.92);

  lines.forEach((line, index) => {
    const y = PADDING + fontSize + index * lineHeight;
    let x = PADDING;

    line.words.forEach((word, wordIndex) => {
      if (wordIndex) x += line.spaceWidth;

      word.segments.forEach((segment) => {
        if (segment.type === "emoji") {
          emojiLayers.push({
            emoji: segment.value,
            left: Math.round(x),
            top: Math.round(y - emojiSize + fontSize * 0.2),
            size: emojiSize,
          });
        } else {
          textNodes.push(
            `<text x="${x}" y="${y}">${escapeHtml(segment.value)}</text>`,
          );
        }

        x += segment.width;
      });
    });
  });

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
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
      ${textNodes.join("\n      ")}
  </g>
</svg>`;

  return { emojiLayers, svg };
}

function fetchBuffer(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { agent: emojiHttpsAgent }, (response) => {
        if (response.statusCode !== 200) {
          response.resume();
          reject(new Error(`Failed to fetch ${url}: ${response.statusCode}`));
          return;
        }

        const chunks = [];
        response.on("data", (chunk) => chunks.push(chunk));
        response.on("end", () => resolve(Buffer.concat(chunks)));
      })
      .on("error", reject);
  });
}

async function getEmojiSvgBuffer(emoji) {
  const codePoint = twemoji.convert.toCodePoint(emoji);
  const notoCodePoint = codePoint.replace(/-/g, "_");

  if (!emojiCache.has(codePoint)) {
    emojiCache.set(
      codePoint,
      resolveEmojiBuffer(codePoint, notoCodePoint),
    );
  }

  return emojiCache.get(codePoint);
}

function getLocalSamsungEmojiPath(codePoint, notoCodePoint) {
  const candidates = [
    `${codePoint}.svg`,
    `${codePoint}.png`,
    `emoji_u${notoCodePoint}.svg`,
    `emoji_u${notoCodePoint}.png`,
  ];

  return candidates
    .map((filename) => path.join(LOCAL_SAMSUNG_EMOJI_DIR, filename))
    .find((filePath) => fs.existsSync(filePath));
}

async function resolveEmojiBuffer(codePoint, notoCodePoint) {
  const samsungEmojiPath = getLocalSamsungEmojiPath(codePoint, notoCodePoint);

  if (samsungEmojiPath) {
    return fs.promises.readFile(samsungEmojiPath);
  }

  const preferredUrls =
    EMOJI_STYLE === "twemoji"
      ? [
          `${TWEMOJI_BASE_URL}/${codePoint}.svg`,
          `${NOTO_EMOJI_BASE_URL}/emoji_u${notoCodePoint}.svg`,
        ]
      : [
          `${NOTO_EMOJI_BASE_URL}/emoji_u${notoCodePoint}.svg`,
          `${TWEMOJI_BASE_URL}/${codePoint}.svg`,
        ];

  let lastError;

  for (const url of preferredUrls) {
    try {
      return await fetchBuffer(url);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError;
}

async function createEmojiCompositeLayer(layer, blurAmount) {
  const emojiSvg = await getEmojiSvgBuffer(layer.emoji);
  const input = await sharp(emojiSvg)
    .resize(layer.size, layer.size, { fit: "contain" })
    .blur(blurAmount)
    .png()
    .toBuffer();

  return {
    input,
    left: layer.left,
    top: Math.max(0, layer.top),
  };
}

async function createBratJpgBuffer(text, type) {
  const config = API_TYPES[type] || API_TYPES.brat;
  const baseFontSize = config.fontSize || DEFAULT_FONT_SIZE;
  const normalizedText = String(text || "brat").toLowerCase();
  const blurAmount = (config.friedLevel / 100) * 3;
  const { fontSize, lines } = await fitTextByFont(normalizedText, baseFontSize);
  const { emojiLayers, svg } = createRasterSvg(lines, blurAmount, fontSize);
  const composites = await Promise.all(
    emojiLayers.map((layer) => createEmojiCompositeLayer(layer, blurAmount)),
  );

  return sharp(Buffer.from(svg))
    .composite(composites)
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
