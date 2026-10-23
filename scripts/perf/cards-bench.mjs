import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { chromium } from "@playwright/test";

const USAGE = `usage: npm run perf:cards -- <baseUrl> [sizes] [options]
  baseUrl            running app, e.g. http://localhost:5301 (build + preview, or dev)
  sizes              comma-separated card counts (default 1000)
  --mobile           390x844 touch viewport
  --throttle=N       CPU throttling rate (default 1)
  --skip-gallery     skip the gallery view
  --skip-brainwrite  skip /brainwrite
  --boot-only        stop after the cold /today load
  --profile=<dir>    write one .cpuprofile per size to <dir>
  --json=<path>      write the raw results as JSON`;

const OPTIONS = {
  help: { type: "boolean" },
  mobile: { type: "boolean" },
  throttle: { type: "string", default: "1" },
  "skip-gallery": { type: "boolean" },
  "skip-brainwrite": { type: "boolean" },
  "boot-only": { type: "boolean" },
  profile: { type: "string" },
  json: { type: "string" },
};

const NAVIGATION_TIMEOUT_MS = 300_000;
const SEARCH_BOX_NAME = "Search cards";

function readArguments() {
  const { values, positionals } = parseArgs({ options: OPTIONS, allowPositionals: true });
  if (values.help || positionals.length === 0) {
    console.log(USAGE);
    process.exit(values.help ? 0 : 1);
  }
  const [baseUrl, sizes = "1000"] = positionals;
  return {
    baseUrl: baseUrl.replace(/\/$/, ""),
    sizes: sizes.split(",").map(Number),
    mobile: Boolean(values.mobile),
    throttle: Number(values.throttle),
    skipGallery: Boolean(values["skip-gallery"]),
    skipBrainwrite: Boolean(values["skip-brainwrite"]),
    bootOnly: Boolean(values["boot-only"]),
    profileDir: values.profile,
    jsonPath: values.json,
  };
}

function installObservers() {
  localStorage.setItem("vega.gratitudeNudgeAckedThrough", "9999-12-31");
  window.__longTasks = [];
  window.__events = [];
  const observe = (type, options, record) => {
    try {
      new PerformanceObserver((list) => list.getEntries().forEach(record)).observe({
        type,
        buffered: true,
        ...options,
      });
    } catch (error) {
      console.warn(`${type} observer unavailable`, error);
    }
  };
  observe("longtask", {}, (entry) => window.__longTasks.push({ dur: entry.duration }));
  observe("event", { durationThreshold: 16 }, (entry) =>
    window.__events.push({ dur: entry.duration }),
  );
}

function seedCards(count) {
  const CATEGORIES = [
    "topic g",
    "topic c",
    "topic h",
    "topic i",
    "topic j",
    "topic d",
    "topic k",
    "topic b",
    "topic l",
    "topic e",
    "",
    "topic f",
  ];
  const TYPES = ["note", "quote", "prompt"];
  const SAMPLE_BODY =
    "Solve the problem backward. Instead of asking how to succeed, ask what would guarantee failure, then avoid those things. Removing the obvious blunders often beats chasing clever wins. ";
  const DAY_MS = 86400000;
  const today = new Date();
  const toIsoDay = (date) => date.toISOString().slice(0, 10);
  const daysFromToday = (days) => toIsoDay(new Date(today.getTime() + days * DAY_MS));
  const openDatabase = () =>
    new Promise((resolve, reject) => {
      const request = indexedDB.open("vega-life-os");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  const learningFields = (index, isLearning) => ({
    box: isLearning ? 1 + (index % 5) : null,
    lastReviewed: isLearning ? daysFromToday(-3) : null,
    nextDue: isLearning ? daysFromToday((index % 9) - 4) : null,
    reviewCount: isLearning ? index % 11 : 0,
  });
  const quoteFields = (isQuote) => ({
    author: isQuote ? "Marcus Aurelius" : null,
    work: isQuote ? "Meditations" : null,
  });
  const buildCard = (index) => {
    const type = TYPES[index % 3];
    return {
      id: `c_bench_${index}`,
      type,
      category: CATEGORIES[index % CATEGORIES.length],
      title: `Bench card ${index} ${["inversion", "second order", "leverage", "compounding"][index % 4]}`,
      body: SAMPLE_BODY.repeat(1 + (index % 3)),
      ...quoteFields(type === "quote"),
      locator: null,
      phonetic: null,
      language: null,
      examples: [],
      synonyms: [],
      hasRecall: type === "prompt",
      hiddenAt: index % 50 === 0 ? today.toISOString() : null,
      likedAt: index % 7 === 0 ? today.toISOString() : null,
      ...learningFields(index, index % 4 === 0 && type !== "quote"),
      updatedAt: "",
      fieldUpdatedAt: {},
      addedAt: daysFromToday(-(index % 900)),
    };
  };
  const countStored = (db) =>
    new Promise((resolve) => {
      const request = db.transaction("cards").objectStore("cards").count();
      request.onsuccess = () => resolve(request.result);
    });
  return (async () => {
    const db = await openDatabase();
    const transaction = db.transaction("cards", "readwrite");
    const store = transaction.objectStore("cards");
    store.clear();
    for (let index = 0; index < count; index++) store.put(buildCard(index));
    await new Promise((resolve, reject) => {
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error);
    });
    const stored = await countStored(db);
    db.close();
    return stored;
  })();
}

async function readMetrics(cdp) {
  const { metrics } = await cdp.send("Performance.getMetrics");
  return Object.fromEntries(metrics.map((metric) => [metric.name, metric.value]));
}

async function readHeapMegabytes(cdp) {
  await cdp.send("HeapProfiler.collectGarbage");
  const metrics = await readMetrics(cdp);
  return Number((metrics.JSHeapUsedSize / 1048576).toFixed(1));
}

const toMs = (value) => Math.round(value);

function drainObservers(page) {
  return page.evaluate(() => {
    const drained = { long: window.__longTasks, events: window.__events };
    window.__longTasks = [];
    window.__events = [];
    return drained;
  });
}

function summarizeLongTasks(tasks) {
  return {
    count: tasks.length,
    maxMs: toMs(Math.max(0, ...tasks.map((task) => task.dur))),
    totalMs: toMs(tasks.reduce((sum, task) => sum + task.dur, 0)),
  };
}

function navigateInApp(page, route) {
  return page.evaluate((target) => {
    window.history.pushState({}, "", target);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }, route);
}

async function measureSpan(page, cdp, action) {
  await drainObservers(page);
  const before = await readMetrics(cdp);
  const startedAt = Date.now();
  await action();
  const wallMs = Date.now() - startedAt;
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  );
  const after = await readMetrics(cdp);
  const { long, events } = await drainObservers(page);
  const secondsToMs = (name) => toMs((after[name] - before[name]) * 1000);
  return {
    wallMs,
    scriptMs: secondsToMs("ScriptDuration"),
    layoutMs: secondsToMs("LayoutDuration"),
    recalcStyleMs: secondsToMs("RecalcStyleDuration"),
    taskMs: secondsToMs("TaskDuration"),
    longTasks: summarizeLongTasks(long),
    maxEventMs: toMs(Math.max(0, ...events.map((event) => event.dur))),
    domNodes: after.Nodes,
    liveDom: await page.evaluate(() => document.getElementsByTagName("*").length),
  };
}

function scrollThroughPage() {
  const candidates = [
    document.scrollingElement,
    ...document.querySelectorAll("main, main *, [data-brainwrite-scroll]"),
  ];
  const isScrollable = (element) => {
    const overflowY = getComputedStyle(element).overflowY;
    return element === document.scrollingElement || overflowY === "auto" || overflowY === "scroll";
  };
  const overflow = (element) => element.scrollHeight - element.clientHeight;
  const scroller = candidates.filter(isScrollable).sort((a, b) => overflow(b) - overflow(a))[0];
  const frames = [];
  let last = performance.now();
  let isRunning = true;
  const tick = (time) => {
    frames.push(time - last);
    last = time;
    if (isRunning) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  const STEPS = 120;
  return (async () => {
    for (let step = 1; step <= STEPS; step++) {
      scroller.scrollTop = (overflow(scroller) * step) / STEPS;
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
    isRunning = false;
    const totalMs = frames.reduce((sum, frame) => sum + frame, 0);
    return {
      frames: frames.length,
      fps: Number(((frames.length / totalMs) * 1000).toFixed(1)),
      worstFrameMs: Math.round(Math.max(...frames)),
      scrollHeight: scroller.scrollHeight,
    };
  })();
}

async function measureScroll(page) {
  await drainObservers(page);
  const result = await page.evaluate(scrollThroughPage);
  const { long } = await drainObservers(page);
  return { ...result, longTasks: summarizeLongTasks(long) };
}

async function openContext(browser, options) {
  const context = await browser.newContext({
    serviceWorkers: "block",
    viewport: options.mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 },
    ...(options.mobile ? { isMobile: true, hasTouch: true, deviceScaleFactor: 3 } : {}),
  });
  await context.addInitScript(installObservers);
  const page = await context.newPage();
  page.setDefaultTimeout(NAVIGATION_TIMEOUT_MS);
  const cdp = await context.newCDPSession(page);
  await cdp.send("Performance.enable");
  if (options.throttle > 1)
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: options.throttle });
  return { page, cdp };
}

async function bootSandbox(page, baseUrl) {
  await page.goto(`${baseUrl}/`);
  const explore = page.getByRole("button", { name: /explore with sample data/i });
  await explore.or(page.locator("main")).first().waitFor();
  if (await explore.isVisible().catch(() => false)) {
    await explore.click();
    await page.locator("main").waitFor();
  }
  await page.waitForTimeout(1500);
}

async function measureColdBoot(page, cdp, options, result) {
  const startedAt = Date.now();
  await page.goto(`${options.baseUrl}/today`);
  await page.locator("main").waitFor();
  result.coldTodayMs = Date.now() - startedAt;
  await page.waitForTimeout(1000);
  result.heapTodayMB = await readHeapMegabytes(cdp);
  result.nodesToday = (await readMetrics(cdp)).Nodes;
  result.bootLongTasks = summarizeLongTasks((await drainObservers(page)).long);
}

async function measureCardsTable(page, cdp, options, result) {
  result.enterCards = await measureSpan(page, cdp, async () => {
    await navigateInApp(page, "/cards");
    await page.getByRole("searchbox", { name: SEARCH_BOX_NAME }).waitFor();
    await page.waitForFunction(
      () =>
        document.querySelectorAll("[data-card-row]").length > 0 ||
        document.querySelectorAll("main li").length > 0,
    );
  });
  result.rowsRendered = await page.evaluate(
    () => document.querySelectorAll("[data-card-row]").length,
  );
  result.heapCardsMB = await readHeapMegabytes(cdp);

  const search = page.getByRole("searchbox", { name: SEARCH_BOX_NAME });
  result.searchFirstChar = await measureSpan(page, cdp, async () => {
    await search.press("b");
    await page.waitForTimeout(50);
  });
  result.searchWord = await measureSpan(page, cdp, async () => {
    await search.pressSequentially("ench 1", { delay: 30 });
    await page.waitForTimeout(50);
  });
  result.searchClear = await measureSpan(page, cdp, async () => {
    await search.fill("");
    await page.waitForTimeout(50);
  });

  if (!options.mobile) {
    const firstCheckbox = page.locator("[data-card-row]").first().getByRole("checkbox");
    result.selectOne = await measureSpan(page, cdp, async () => {
      await firstCheckbox.click({ force: true });
      await page.waitForTimeout(50);
    });
    result.sortTitle = await measureSpan(page, cdp, async () => {
      await page.getByRole("button", { name: "Title", exact: true }).click();
      await page.waitForTimeout(50);
    });
  }
  result.scrollTable = await measureScroll(page);
}

async function measureGallery(page, cdp, result) {
  result.enterGallery = await measureSpan(page, cdp, async () => {
    await page.getByRole("button", { name: "Gallery view" }).click();
    await page.waitForFunction(
      () => document.querySelectorAll("figure, main button[aria-label$=', face']").length > 0,
    );
    await page.waitForTimeout(300);
  });
  result.heapGalleryMB = await readHeapMegabytes(cdp);
  result.scrollGallery = await measureScroll(page);
  await page.getByRole("button", { name: "Table view" }).click();
  await page.waitForTimeout(500);
}

async function measureCardPage(page, cdp, result) {
  await navigateInApp(page, "/cards");
  await page.waitForTimeout(300);
  result.enterCardPage = await measureSpan(page, cdp, async () => {
    await navigateInApp(page, "/cards/c_bench_7");
    await page.getByRole("textbox").first().waitFor();
  });
}

async function measureBrainwrite(page, cdp, result) {
  await navigateInApp(page, "/today");
  await page.waitForTimeout(500);
  result.enterBrainWrite = await measureSpan(page, cdp, async () => {
    await navigateInApp(page, "/brainwrite");
    await page.locator("[data-brainwrite-scroll] [data-index]").first().waitFor();
  });
  result.brainwriteSlots = await page.evaluate(
    () => document.querySelectorAll("[data-brainwrite-scroll] [data-index]").length,
  );
  result.heapBrainWriteMB = await readHeapMegabytes(cdp);
}

async function measureAfterBoot(page, cdp, options, result) {
  await measureCardsTable(page, cdp, options, result);
  if (!options.skipGallery) await measureGallery(page, cdp, result);
  await measureCardPage(page, cdp, result);
  if (!options.skipBrainwrite) await measureBrainwrite(page, cdp, result);
}

async function startProfile(cdp, options) {
  if (!options.profileDir) return;
  await cdp.send("Profiler.enable");
  await cdp.send("Profiler.setSamplingInterval", { interval: 200 });
  await cdp.send("Profiler.start");
}

async function stopProfile(cdp, options, count) {
  if (!options.profileDir) return;
  const { profile } = await cdp.send("Profiler.stop");
  mkdirSync(options.profileDir, { recursive: true });
  const suffix = options.mobile ? "-mobile" : "";
  writeFileSync(
    path.join(options.profileDir, `cards-${count}${suffix}.cpuprofile`),
    JSON.stringify(profile),
  );
}

async function runSize(count, options) {
  const browser = await chromium.launch();
  try {
    const { page, cdp } = await openContext(browser, options);
    const result = { n: count, mobile: options.mobile };
    await bootSandbox(page, options.baseUrl);
    result.seeded = await page.evaluate(seedCards, count);
    await measureColdBoot(page, cdp, options, result);
    if (options.bootOnly) return result;
    await startProfile(cdp, options);
    await measureAfterBoot(page, cdp, options, result);
    await stopProfile(cdp, options, count);
    return result;
  } finally {
    await browser.close();
  }
}

const SPAN_COLUMNS = [
  ["wall", "wallMs"],
  ["script", "scriptMs"],
  ["layout", "layoutMs"],
  ["style", "recalcStyleMs"],
  ["long#", "longTasks.count"],
  ["longMax", "longTasks.maxMs"],
  ["evtMax", "maxEventMs"],
  ["dom", "liveDom"],
];

const SCROLL_COLUMNS = [
  ["fps", "fps"],
  ["worstFrame", "worstFrameMs"],
  ["long#", "longTasks.count"],
  ["longMax", "longTasks.maxMs"],
];

const SPAN_KEYS = [
  "enterCards",
  "searchFirstChar",
  "searchWord",
  "searchClear",
  "selectOne",
  "sortTitle",
  "enterGallery",
  "enterCardPage",
  "enterBrainWrite",
];
const SCROLL_KEYS = ["scrollTable", "scrollGallery"];

const readPath = (source, dotted) => dotted.split(".").reduce((value, key) => value?.[key], source);

function renderTable(heading, columns, rows) {
  const header = [heading, ...columns.map(([label]) => label)];
  const body = rows.map(({ label, source }) => [
    label,
    ...columns.map(([, key]) => String(readPath(source, key) ?? "-")),
  ]);
  const widths = header.map((_, column) =>
    Math.max(...[header, ...body].map((row) => row[column].length)),
  );
  const format = (row) =>
    row
      .map((cell, column) =>
        column === 0 ? cell.padEnd(widths[0]) : cell.padStart(widths[column]),
      )
      .join("  ");
  return [format(header), ...body.map(format)].join("\n");
}

function renderResult(result) {
  if (result.error) return `N=${result.n}  ERROR ${result.error}`;
  const lines = [
    `N=${result.n}${result.mobile ? " (mobile)" : ""}  seeded=${result.seeded}  coldToday=${result.coldTodayMs}ms  bootLong=${result.bootLongTasks.count}x max ${result.bootLongTasks.maxMs}ms`,
  ];
  lines.push(
    `heap MB: today=${result.heapTodayMB} cards=${result.heapCardsMB ?? "-"} gallery=${result.heapGalleryMB ?? "-"} brainwrite=${result.heapBrainWriteMB ?? "-"}  rows=${result.rowsRendered ?? "-"} slots=${result.brainwriteSlots ?? "-"}`,
  );
  const spanRows = SPAN_KEYS.filter((key) => result[key]).map((key) => ({
    label: key,
    source: result[key],
  }));
  const scrollRows = SCROLL_KEYS.filter((key) => result[key]).map((key) => ({
    label: key,
    source: result[key],
  }));
  if (spanRows.length) lines.push(renderTable("span (ms)", SPAN_COLUMNS, spanRows));
  if (scrollRows.length) lines.push(renderTable("scroll", SCROLL_COLUMNS, scrollRows));
  return lines.join("\n");
}

async function main() {
  const options = readArguments();
  const results = [];
  for (const count of options.sizes) {
    try {
      results.push(await runSize(count, options));
    } catch (error) {
      results.push({ n: count, error: String(error).slice(0, 400) });
    }
    console.log(`${renderResult(results.at(-1))}\n`);
  }
  if (options.jsonPath) writeFileSync(options.jsonPath, `${JSON.stringify(results, null, 2)}\n`);
  if (results.some((result) => result.error)) process.exitCode = 1;
}

await main();
