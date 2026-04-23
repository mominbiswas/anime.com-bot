const PROFILE_URL = "https://www.anime.com/u/";

async function loadPuppeteer() {
  try {
    return await import("puppeteer");
  } catch (error) {
    throw new Error(
      "Character screenshots need the `puppeteer` package installed. Run `npm install` and redeploy if needed."
    );
  }
}

function buildProfileUrl(username) {
  return `${PROFILE_URL}${encodeURIComponent(username.trim().replace(/^@/, ""))}`;
}

export async function captureCharacterScreenshot(username) {
  const puppeteerModule = await loadPuppeteer();
  const puppeteer = puppeteerModule.default ?? puppeteerModule;
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage"
    ]
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({
      width: 1440,
      height: 1100,
      deviceScaleFactor: 1
    });
    await page.goto(buildProfileUrl(username), {
      waitUntil: "networkidle2",
      timeout: 60000
    });
    await new Promise((resolve) => setTimeout(resolve, 3500));

    const clip = await page.evaluate(() => {
      const selector = [
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
    });

    if (!clip) {
      throw new Error("I couldn't find a visible character model on that public Anime.com profile.");
    }

    return await page.screenshot({
      type: "png",
      clip
    });
  } catch (error) {
    if (
      /Could not find Chrome|Failed to launch|Executable doesn't exist|Browser was not found/i.test(
        error.message
      )
    ) {
      throw new Error(
        "The browser for character screenshots is not installed yet. On Railway, make sure Puppeteer can download Chromium during build."
      );
    }

    throw error;
  } finally {
    await browser.close();
  }
}
