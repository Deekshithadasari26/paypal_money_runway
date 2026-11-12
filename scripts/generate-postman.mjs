import { writeFileSync } from "node:fs";
const test = (lines) => ({
  listen: "test",
  script: { type: "text/javascript", exec: lines },
});
const pre = (lines) => ({
  listen: "prerequest",
  script: { type: "text/javascript", exec: lines },
});
function request(name, method, path, body, checks = []) {
  return {
    name,
    request: {
      method,
      header:
        body === undefined
          ? []
          : [{ key: "Content-Type", value: "application/json" }],
      url: "{{baseUrl}}" + path,
      ...(body === undefined
        ? {}
        : {
            body: {
              mode: "raw",
              raw: JSON.stringify(body, null, 2),
              options: { raw: { language: "json" } },
            },
          }),
    },
    event: [
      test([
        `pm.test('HTTP success',()=>pm.expect(pm.response.code).to.be.oneOf([200,201]));`,
        `const d=pm.response.json();`,
        ...checks,
      ]),
    ],
  };
}
const skip = (flag) =>
  pre([
    `if (String(pm.environment.get('${flag}')) !== 'true') pm.execution.skipRequest();`,
  ]);
const readOnly = [
  request("01 Health", "GET", "/api/health", undefined, [
    `pm.test('Health ready',()=>pm.expect(d.status).to.eql('ok'));`,
  ]),
  request(
    "02 Integration configuration (no secrets)",
    "GET",
    "/api/integrations/status",
    undefined,
    [
      `pm.test('Only safe status fields',()=>pm.expect(Object.keys(d).sort()).to.eql(['aiConfigured','paypalConfigured','paypalLastSync'].sort()));`,
    ],
  ),
  request("03 Today and integer money", "GET", "/api/today", undefined, [
    `pm.test('Allowance arithmetic',()=>{pm.expect(Number.isSafeInteger(d.spent)).to.eql(true);pm.expect(d.left).to.eql(d.allowance-d.spent);});`,
    `pm.test('INR cash ledger only',()=>d.transactions.forEach(t=>{pm.expect(t.currency).to.eql('INR');pm.expect(t.source.startsWith('PayPal')).to.eql(false);}));`,
    `if(String(pm.environment.get('expectSeed'))==='true')pm.test('Seeded 300 rupees remaining',()=>pm.expect(d.left).to.eql(30000));`,
    `pm.collectionVariables.set('demoDate',d.date);pm.collectionVariables.set('baselineLeft',d.left);`,
  ]),
  request("04 Payday plan reconciliation", "GET", "/api/plan", undefined, [
    `const t=d.projection.totals;pm.test('Exact end-date cash equation',()=>pm.expect(d.projection.projected).to.eql(t.opening+t.actualIncome-t.actualOutflow+t.plannedIncome-t.plannedOutflow-t.estimatedOutflow));`,
    `if(String(pm.environment.get('expectSeed'))==='true')pm.test('Seeded salary savings 18000 rupees',()=>pm.expect(d.savings).to.eql(1800000));`,
  ]),
  request(
    "05 Forecast and delayed-income scenario",
    "GET",
    "/api/forecast",
    undefined,
    [
      `pm.test('Thirty daily points',()=>{pm.expect(d.base.length).to.eql(30);pm.expect(d.delayed.length).to.eql(30);d.base.forEach(p=>pm.expect(Number.isSafeInteger(p.balance)).to.eql(true));});`,
      `pm.test('Buffer-safe extra capacity',()=>pm.expect(d.extra).to.eql(Math.max(0,Math.min(d.cash,d.baseMinimum)-d.buffer)));`,
      `if(String(pm.environment.get('expectSeed'))==='true')pm.test('Delay produces November 12 shortfall',()=>pm.expect(d.delayedShortfall.date).to.eql('2026-11-12'));`,
    ],
  ),
  request("06 Calendar daily math", "GET", "/api/calendar", undefined, [
    `pm.test('Calendar month length',()=>pm.expect(d.days.length).to.be.within(28,31));`,
    `pm.test('Today allowance math',()=>{const today=d.days.find(day=>day.date===d.date);pm.expect(today.left).to.eql(today.allowance-today.spent);});`,
  ]),
  request("07 Saved recaps", "GET", "/api/recaps", undefined, [
    `pm.test('Recaps list',()=>pm.expect(Array.isArray(d)).to.eql(true));`,
  ]),
];
const mutations = [
  request(
    "08 Add 350 rupee expense",
    "POST",
    "/api/expenses",
    {
      date: "{{demoDate}}",
      description: "Postman isolated demo dinner",
      amount: 35000,
      bucket: "everyday",
    },
    [
      `pm.test('Expense created',()=>pm.expect(d.id).to.be.a('number'));pm.collectionVariables.set('expenseId',d.id);`,
    ],
  ),
  request("09 Verify expense recalculation", "GET", "/api/today", undefined, [
    `pm.test('Daily left recalculated',()=>pm.expect(d.left).to.eql(Number(pm.collectionVariables.get('baselineLeft'))-35000));`,
    `if(String(pm.environment.get('expectSeed'))==='true')pm.test('Overspent by 50 rupees',()=>pm.expect(d.left).to.eql(-5000));`,
  ]),
  request(
    "10 Edit expense to 200 rupees",
    "PUT",
    "/api/expenses/{{expenseId}}",
    {
      date: "{{demoDate}}",
      description: "Postman isolated demo dinner",
      amount: 20000,
      bucket: "everyday",
    },
    [`pm.test('Expense updated',()=>pm.expect(d.ok).to.eql(true));`],
  ),
  request("11 Verify edit", "GET", "/api/today", undefined, [
    `pm.test('Edit recalculated daily left',()=>pm.expect(d.left).to.eql(Number(pm.collectionVariables.get('baselineLeft'))-20000));`,
  ]),
  request(
    "12 Import labeled INR CSV",
    "POST",
    "/api/import-csv",
    {
      csv: "id,date,description,amount,currency,bucket\npostman-fixture-01,{{demoDate}},Postman sample cinema,10.25,INR,fun",
    },
    [
      `pm.test('CSV processed',()=>pm.expect(d.imported+d.duplicates).to.eql(1));`,
    ],
  ),
  request(
    "13 Repeat CSV has no duplicates",
    "POST",
    "/api/import-csv",
    {
      csv: "id,date,description,amount,currency,bucket\npostman-fixture-01,{{demoDate}},Postman sample cinema,10.25,INR,fun",
    },
    [
      `pm.test('Repeat CSV skipped',()=>{pm.expect(d.imported).to.eql(0);pm.expect(d.duplicates).to.eql(1);});`,
    ],
  ),
  request("14 Load labeled PayPal sample", "POST", "/api/paypal/sample", {}, [
    `pm.test('Sample fixture processed',()=>pm.expect(d.imported+d.duplicates).to.eql(2));`,
  ]),
  request(
    "15 Repeat sample has no duplicates",
    "POST",
    "/api/paypal/sample",
    {},
    [
      `pm.test('Repeat sample skipped',()=>{pm.expect(d.imported).to.eql(0);pm.expect(d.duplicates).to.eql(2);});`,
    ],
  ),
  request(
    "16 Opening balance and original currency",
    "GET",
    "/api/paypal",
    undefined,
    [
      `const sample=d.transactions.filter(t=>t.source==='PayPal sample');pm.test('Two distinct labeled sample records',()=>pm.expect(sample.length).to.eql(2));`,
      `pm.test('T1900 opening balance retained in USD',()=>{const opening=sample.find(t=>t.event_code==='T1900');pm.expect(opening.kind).to.eql('opening');pm.expect(opening.currency).to.eql('USD');pm.expect(opening.amount).to.eql(500000);});`,
    ],
  ),
  request(
    "17 Save end-of-day recap",
    "POST",
    "/api/recap",
    { date: "{{demoDate}}" },
    [
      `pm.test('Recap generated',()=>pm.expect(d.body).to.include('Everyday'));`,
    ],
  ),
];
const sync = request(
  "18 Live PayPal Sandbox sync (backend owns OAuth)",
  "POST",
  "/api/paypal/sync",
  { start: "{{syncWindowStart}}", end: "{{syncWindowEnd}}" },
  [
    `pm.test('Live sync completed',()=>{pm.expect(d.pages).to.be.at.least(1);pm.expect(d.imported).to.be.at.least(0);});`,
  ],
);
sync.event.unshift(
  pre([
    `if(String(pm.environment.get('runLivePayPal'))!=='true'){pm.execution.skipRequest();}else{const now=Date.now();pm.collectionVariables.set('syncWindowStart',pm.environment.get('syncStart')||new Date(now-30*86400000).toISOString());pm.collectionVariables.set('syncWindowEnd',pm.environment.get('syncEnd')||new Date(now-60000).toISOString());}`,
  ]),
);
const livePaypal = [
  sync,
  request(
    "19 Repeat live sync, fixed window",
    "POST",
    "/api/paypal/sync",
    { start: "{{syncWindowStart}}", end: "{{syncWindowEnd}}" },
    [
      `pm.test('No new imports on repeat',()=>pm.expect(d.imported).to.eql(0));`,
    ],
  ),
  request("20 Last successful live sync", "GET", "/api/paypal", undefined, [
    `pm.test('Successful live sync timestamp recorded',()=>{pm.expect(d.configured).to.eql(true);pm.expect(d.lastSync.at).to.be.a('string');pm.expect(d.lastSync.start).to.eql(pm.collectionVariables.get('syncWindowStart'));});`,
    `pm.test('No duplicate external keys',()=>{const keys=d.transactions.map(t=>t.external_key);pm.expect(new Set(keys).size).to.eql(keys.length);});`,
  ]),
];
const liveAI = [
  request(
    "21 Actual AI response (fallback fails this check)",
    "POST",
    "/api/insights",
    {},
    [
      `pm.test('Actual model result, not fallback',()=>pm.expect(d.mode).to.eql('model'));`,
      `pm.test('Validated explanation and suggestions',()=>{pm.expect(d.result.explanation).to.be.a('string').and.not.empty;pm.expect(Array.isArray(d.result.categories)).to.eql(true);});`,
    ],
  ),
];
const collection = {
  info: {
    name: "PayPal Money Runway · judge checks",
    description:
      "Read-only checks run by default. Mutating sample checks require runMutations=true and must target a disposable local demo. Real Sandbox sync requires runLivePayPal=true; real paid model calls require runLiveAI=true. API secrets stay in the backend environment; this collection never requests or prints OAuth tokens, client secrets, or AI keys. No invoice approval or payment request is included.",
    schema:
      "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
  },
  auth: {
    type: "basic",
    basic: [
      { key: "username", value: "{{demoUsername}}", type: "string" },
      { key: "password", value: "{{demoPassword}}", type: "string" },
    ],
  },
  item: [
    { name: "1 · Read-only app checks", item: readOnly },
    {
      name: "2 · Disposable demo mutations",
      event: [skip("runMutations")],
      item: mutations,
    },
    {
      name: "3 · Optional live PayPal (no invoice creation)",
      event: [skip("runLivePayPal")],
      item: livePaypal,
    },
    {
      name: "4 · Optional live AI (may incur model usage)",
      event: [skip("runLiveAI")],
      item: liveAI,
    },
  ],
};
const values = {
  baseUrl: "http://127.0.0.1:3001",
  demoUsername: "judge",
  demoPassword: "",
  runMutations: "false",
  expectSeed: "false",
  runLivePayPal: "false",
  runLiveAI: "false",
  syncStart: "",
  syncEnd: "",
};
const environment = {
  name: "Money Runway · local (secret-free)",
  values: Object.entries(values).map(([key, value]) => ({
    key,
    value,
    type: key === "demoPassword" ? "secret" : "default",
    enabled: true,
  })),
  _postman_variable_scope: "environment",
};
writeFileSync(
  "postman/Money-Runway.postman_collection.json",
  JSON.stringify(collection, null, 2) + "\n",
);
writeFileSync(
  "postman/Local.postman_environment.json",
  JSON.stringify(environment, null, 2) + "\n",
);
console.log("Secret-free Postman collection and environment generated.");
