export {};
// What shape does visit-jax actually emit for startDate?
const url = "https://www.visitjacksonville.com/events/stryper/";
const html = await (await fetch(url, { headers: { "user-agent": "Mozilla/5.0 (jax-events)" } })).text();
const m = html.match(/"startDate"\s*:\s*"([^"]+)"/);
console.log("  raw startDate:", m?.[1] ?? "(not found)");
const m2 = html.match(/"endDate"\s*:\s*"([^"]+)"/);
console.log("  raw endDate:  ", m2?.[1] ?? "(not found)");
