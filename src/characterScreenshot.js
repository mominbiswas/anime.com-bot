import sharp from "sharp";
import { PNG } from "pngjs";
import gifenc from "gifenc";

const { GIFEncoder, applyPalette, quantize } = gifenc;

const PROFILE_URL = "https://www.anime.com/u/";
const VIEWPORT = {
  width: 1440,
  height: 1100,
  deviceScaleFactor: 1
};
const SELECTOR = [
  "canvas",
  "model-viewer",
  "video",
  "img",
  "[class*='character']",
  "[class*='avatar']",
  "[class*='scene']",
  "[data-testid*='character']",
  "[data-testid*='avatar']"
].join(",");

async function loadPuppeteer() {
  try {
    return await import("puppeteer");
  } catch {
    throw new Error(
      "Character captures need the `puppeteer` package installed. Run `npm install` and redeploy if needed."
    );
  }
}

function buildProfileUrl(username) {
  return `${PROFILE_URL}${encodeURIComponent(username.trim().replace(/^@/, ""))}`;
}

async function launchBrowser() {
  const puppeteerModule = await loadPuppeteer();
  const puppeteer = puppeteerModule.default ?? puppeteerModule;

  return puppeteer.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage"
    ]
  });
}

async function wait(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function openProfilePage(browser, username) {
  const page = await browser.newPage();
  await page.setViewport(VIEWPORT);
  await page.goto(buildProfileUrl(username), {
    waitUntil: "networkidle2",
    timeout: 60000
  });
  await wait(3500);
  return page;
}

async function detectCharacterClip(page) {
  return page.evaluate((selector) => {
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const elements = [...document.querySelectorAll(selector)];
    const scored = elements
      .map((element) => {
        const rect = element.getBoundingClientRect();
        const styles = window.getComputedStyle(element);
        const text = `${element.tagName} ${element.className ?? ""} ${element.id ?? ""} ${(element.getAttribute("alt") ?? "")} ${(element.getAttribute("aria-label") ?? "")}`.toLowerCase();

        if (
          rect.width < 80 ||
          rect.height < 80 ||
          styles.display === "none" ||
          styles.visibility === "hidden" ||
          Number(styles.opacity) === 0 ||
          rect.bottom <= 0 ||
          rect.right <= 0 ||
          rect.top >= viewportHeight ||
          rect.left >= viewportWidth
        ) {
          return null;
        }

        const width = Math.min(rect.width, viewportWidth - Math.max(rect.left, 0));
        const height = Math.min(rect.height, viewportHeight - Math.max(rect.top, 0));
        const area = width * height;
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const rightBias = centerX / viewportWidth;
        const topBias = 1 - Math.min(centerY / viewportHeight, 1);
        const portraitBias = rect.height >= rect.width ? 1.15 : 0.9;
        const keywordBoost = /(character|avatar|scene|model|room)/.test(text) ? 1.4 : 1;
        const score = area * rightBias * topBias * portraitBias * keywordBoost;

        return {
          x: rect.left,
          y: rect.top,
          width: rect.width,
          height: rect.height,
          score
        };
      })
      .filter(Boolean)
      .sort((left, right) => right.score - left.score);

    if (!scored.length) {
      return null;
    }

    const best = scored[0];
    const padding = 24;

    return {
      x: Math.max(0, Math.floor(best.x - padding)),
      y: Math.max(0, Math.floor(best.y - padding)),
      width: Math.min(
        viewportWidth - Math.max(0, Math.floor(best.x - padding)),
        Math.ceil(best.width + padding * 2)
      ),
      height: Math.min(
        viewportHeight - Math.max(0, Math.floor(best.y - padding)),
        Math.ceil(best.height + padding * 2)
      )
    };
  }, SELECTOR);
}

function normalizeBrowserError(error) {
  if (
    /Could not find Chrome|Failed to launch|Executable doesn't exist|Browser was not found/i.test(
      error.message
    )
  ) {
    return new Error(
      "The browser for character captures is not installed yet. On Railway, make sure Puppeteer can download Chromium during build."
    );
  }

  return error;
}

async function getClipForUsername(username) {
  const browser = await launchBrowser();

  try {
    const page = await openProfilePage(browser, username);
    const clip = await detectCharacterClip(page);

    if (!clip) {
      throw new Error("I couldn't find a visible character model on that public Anime.com profile.");
    }

    return {
      browser,
      page,
      clip
    };
  } catch (error) {
    await browser.close();
    throw normalizeBrowserError(error);
  }
}

async function resizeFrame(buffer) {
  return sharp(buffer)
    .resize({
      width: 360,
      fit: "inside",
      withoutEnlargement: true
    })
    .png()
    .toBuffer();
}

async function tightenCharacterFrame(buffer) {
  const metadata = await sharp(buffer).metadata();
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;

  if (!width || !height || width <= height * 1.15) {
    return buffer;
  }

  const extractWidth = Math.max(220, Math.floor(width * 0.42));
  const extractHeight = Math.max(260, Math.floor(height * 0.82));
  const left = Math.max(0, Math.floor((width - extractWidth) / 2));
  const top = Math.max(0, Math.floor(height * 0.08));
  const finalWidth = Math.min(extractWidth, width - left);
  const finalHeight = Math.min(extractHeight, height - top);

  return sharp(buffer)
    .extract({
      left,
      top,
      width: finalWidth,
      height: finalHeight
    })
    .png()
    .toBuffer();
}

function pngBufferToRgba(buffer) {
  const png = PNG.sync.read(buffer);
  return {
    width: png.width,
    height: png.height,
    rgba: new Uint8Array(png.data)
  };
}

function encodeGif(frames, width, height) {
  const encoder = GIFEncoder();

  for (const frame of frames) {
    const palette = quantize(frame.rgba, 256, { format: "rgba4444", oneBitAlpha: true });
    const index = applyPalette(frame.rgba, palette, "rgba4444");
    encoder.writeFrame(index, width, height, {
      palette,
      delay: frame.delay,
      transparent: true,
      transparentIndex: 0
    });
  }

  encoder.finish();
  return Buffer.from(encoder.bytesView());
}

export async function captureCharacterScreenshot(username) {
  const { browser, page, clip } = await getClipForUsername(username);

  try {
    return await page.screenshot({
      type: "png",
      clip
    });
  } finally {
    await browser.close();
  }
}

export async function captureCharacterGif(username) {
  const { browser, page, clip } = await getClipForUsername(username);

  try {
    const frameCount = 20;
    const captureIntervalMs = 110;
    const playbackDelayMs = 170;
    const rawFrames = [];

    for (let index = 0; index < frameCount; index += 1) {
      const frameBuffer = await page.screenshot({
        type: "png",
        clip
      });
      rawFrames.push(frameBuffer);

      if (index < frameCount - 1) {
        await wait(captureIntervalMs);
      }
    }

    const tightenedFrames = await Promise.all(rawFrames.map((frame) => tightenCharacterFrame(frame)));
    const resizedFrames = await Promise.all(tightenedFrames.map((frame) => resizeFrame(frame)));
    const parsedFrames = resizedFrames.map((frame, index) => ({
      ...pngBufferToRgba(frame),
      delay: playbackDelayMs
    }));

    const firstFrame = parsedFrames[0];
    const consistentFrames = parsedFrames.map((frame) => ({
      rgba: frame.rgba,
      delay: frame.delay
    }));

    return encodeGif(consistentFrames, firstFrame.width, firstFrame.height);
  } finally {
    await browser.close();
  }
}
